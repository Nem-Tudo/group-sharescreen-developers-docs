// Uma imitação pequena da API do GoLive, só para testar os exemplos sem tocar
// na produção. Reproduz o que importa para um bot: o registro no WebSocket,
// os eventos de grupo e DM, as rotas de mensagens/reações/moderação e as
// mesmas validações (emoji padrão, corpo JSON vazio, dono não pode ser expulso)
// — e as regras que só valem para bots: não entrar em grupo sozinho, ser
// adicionado por quem gerencia o grupo, só puxar DM com quem divide um grupo
// ou já escreveu antes, ser desconectado (código 4004) quando o token muda, e
// ser suspenso pela administração (403 bot_suspended no HTTP, banned + 4003 no
// WebSocket).

import http from "node:http";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

const STANDARD_EMOJI_RE = new RegExp("^\\p{RGI_Emoji}$", "v");

const OFF = (keys) => Object.fromEntries(keys.map((k) => [k, false]));
const MANAGE = ["administrator", "manageGroup", "manageChannels", "manageRoles", "kickMembers", "banMembers", "manageMessages", "manageReactions", "createInvites"];
const BOT_SELF_JOIN = "Bots cannot join groups on their own. Someone with the \"manage group\" permission has to add the bot.";

export function createMockApi({ botToken }) {
  const events = new EventEmitter();
  const now = Date.now();
  const account = (id, username, displayName, extra = {}) => ({
    id, username, displayName, flags: [], bot: false, avatarUrl: null, bio: null, createdAt: now, ...extra,
  });
  const accounts = new Map();
  for (const a of [
    account("bot-1", "teste_bot", "Teste", { bot: true }),
    account("user-1", "dona", "Dona do Grupo", { bio: "Eu criei o grupo" }),
    account("user-2", "maria", "Maria"),
    account("user-3", "joao", "João"),
  ]) accounts.set(a.id, a);
  for (let i = 10; i < 32; i += 1) accounts.set(`user-${i}`, account(`user-${i}`, `pessoa${i}`, `Pessoa ${i}`));
  // Alguém de fora do grupo — para a regra de DM dos bots.
  accounts.set("user-99", account("user-99", "estranho", "Estranho"));

  const group = {
    id: "grp1",
    name: "Grupo Teste",
    ownerId: "user-1",
    permissions: { manage: OFF(MANAGE), general: { viewChannel: true }, text: { sendMessages: true, addReactions: true, react: true, mentionMembers: true, mentionEveryone: false, sendGifs: true, sendImages: true }, voice: {} },
    roles: [{ id: "mod", name: "Moderação", color: null, position: 1, hoist: true, mentionable: false, permissions: { manage: { ...OFF(MANAGE), kickMembers: true }, general: {}, text: {}, voice: {} } }],
  };
  const memberRoles = {};
  const members = new Set([...accounts.keys()].filter((id) => id !== "user-99"));
  const channel = { id: "chan1", kind: "text", name: "geral" };
  const messages = new Map();
  const dms = new Map();
  const dmSettings = new Map();
  const sockets = new Map();
  const requests = [];
  // A suspensão pela administração do GoLive — veja suspend() abaixo.
  let suspended = false;

  function send(userId, payload) {
    for (const ws of sockets.get(userId) ?? []) ws.send(JSON.stringify(payload));
  }
  const tellMembers = (payload) => { for (const id of members) send(id, payload); };

  function groupUser(id) {
    const a = accounts.get(id);
    return { id, name: a.displayName, username: a.username, avatarUrl: null, nameColor: null, flags: [], bot: a.bot, guest: false };
  }

  function publicMessage(m) {
    const reactions = [...m.reactions].filter(([, users]) => users.size > 0).map(([emoji, users]) => ({ emoji, users: [...users] }));
    const { reactions: _r, ...rest } = m;
    return reactions.length ? { ...rest, reactions } : rest;
  }

  // O formato que a API devolve (veja docs/referencia/objetos.md#embed), sem os limites dela.
  function mockEmbed(e) {
    const pic = (v) => (typeof v === "string" ? v : v?.url);
    const out = {
      title: e.title, description: e.description, url: e.url, color: e.color, timestamp: e.timestamp,
      author: e.author ? { name: e.author.name, url: e.author.url, iconUrl: e.author.icon_url ?? e.author.iconUrl } : undefined,
      footer: e.footer ? { text: e.footer.text, iconUrl: e.footer.icon_url ?? e.footer.iconUrl } : undefined,
      fields: Array.isArray(e.fields) ? e.fields.map((f) => ({ name: f.name, value: f.value, inline: Boolean(f.inline) })) : undefined,
      image: pic(e.image), thumbnail: pic(e.thumbnail),
    };
    return JSON.parse(JSON.stringify(out));
  }

  function createMessage(from, body) {
    const author = groupUser(from);
    const m = {
      id: randomUUID(), groupId: group.id, channelId: channel.id, from, fromName: author.name,
      text: String(body.text ?? "").trim().slice(0, 2000), kind: "text",
      ...(body.replyTo ? { replyTo: body.replyTo } : {}),
      // Só bots mandam embeds; a API de verdade valida e converte (icon_url → iconUrl, image: { url } → image).
      ...(author.bot && Array.isArray(body.embeds) && body.embeds.length ? { embeds: body.embeds.slice(0, 10).map(mockEmbed) } : {}),
      ts: Date.now(), reactions: new Map(),
    };
    messages.set(m.id, m);
    const message = publicMessage(m);
    tellMembers({ type: "group-message", message, author, mentioned: {}, ...(body.nonce ? { nonce: body.nonce } : {}) });
    events.emit("message", message);
    return { message, author };
  }

  // Quem chama a rota é o bot: é a permissão *dele* que a API confere.
  function canKick(userId) {
    if (userId === group.ownerId) return true;
    return (memberRoles[userId] ?? []).includes("mod");
  }

  const routes = [
    ["GET", /^\/auth\/me$/, (me) => ({ account: accounts.get(me) })],
    ["GET", /^\/users\/([^/]+)$/, (_me, [id]) => {
      const a = accounts.get(id) ?? [...accounts.values()].find((x) => x.username === id);
      return a ? { account: a, live: null } : [404, { error: "User not found." }];
    }],
    ["GET", /^\/groups$/, (me) => ({ groups: members.has(me) ? [{ id: group.id, name: group.name }] : [] })],
    // Bot nunca entra sozinho: nem por convite, nem num grupo público.
    ["POST", /^\/invites\/([^/]+)\/accept$/, (me) =>
      accounts.get(me)?.bot ? [403, { error: BOT_SELF_JOIN, reason: "bot_self_join" }] : { groupId: group.id }],
    ["POST", /^\/groups\/([^/]+)\/join$/, (me) =>
      accounts.get(me)?.bot ? [403, { error: BOT_SELF_JOIN, reason: "bot_self_join" }] : { groupId: group.id }],
    // Quem gerencia o grupo (aqui, a dona) adiciona o bot.
    ["POST", /^\/groups\/grp1\/bots$/, (me, _p, body) => {
      if (accounts.get(me)?.bot) return [403, { error: "Only a person signed in to their account can add bots." }];
      if (me !== group.ownerId) return [403, { error: "You do not have permission to manage the group." }];
      if (!accounts.get(body.botId)?.bot) return [404, { error: "Bot not found." }];
      if (!members.has(body.botId)) {
        members.add(body.botId);
        // O cargo próprio do bot (managedBy), como a API cria.
        const bits = Number.isInteger(body.permissions) ? body.permissions : 0;
        const roleId = `bot-${body.botId}`;
        group.roles = group.roles.filter((r) => r.managedBy !== body.botId);
        group.roles.push({
          id: roleId, name: accounts.get(body.botId).displayName, color: null, position: group.roles.length + 1,
          hoist: false, mentionable: false, managedBy: body.botId,
          permissions: { manage: { ...OFF(MANAGE), kickMembers: Boolean(bits & 16), manageMessages: Boolean(bits & 64) }, general: {}, text: {}, voice: {} },
        });
        memberRoles[body.botId] = [roleId];
        send(body.botId, { type: "group-added", groupId: group.id, addedBy: me });
        tellMembers({ type: "group-updated", groupId: group.id });
      }
      return { groupId: group.id };
    }],
    ["GET", /^\/groups\/grp1$/, () => ({ group: { ...group, memberCount: members.size }, channels: [channel], memberRoles })],
    ["GET", /^\/groups\/grp1\/members$/, () => ({
      members: [...members].map((id) => ({ ...groupUser(id), role: id === group.ownerId ? "owner" : "member", roleIds: memberRoles[id] ?? [], online: id === "bot-1", joinedAt: now })),
    })],
    ["GET", /^\/groups\/grp1\/channels\/chan1\/messages$/, (_me, _p, _b, query) => {
      const before = Number(query.get("before")) || Infinity;
      const page = [...messages.values()].filter((m) => m.ts < before).sort((a, b) => a.ts - b.ts).slice(-50).map(publicMessage);
      return { messages: page, authors: {} };
    }],
    ["POST", /^\/groups\/grp1\/channels\/chan1\/messages$/, (me, _p, body) => {
      if (!body.text && !body.url && !body.images?.length && !body.embeds?.length) return [400, { error: "Empty message." }];
      return createMessage(me, body);
    }],
    ["PATCH", /^\/groups\/grp1\/channels\/chan1\/messages\/([^/]+)$/, (me, [mid], body) => {
      const m = messages.get(mid);
      if (!m) return [404, { error: "Message not found." }];
      if (m.from !== me) return [403, { error: "You can only edit your own messages." }];
      if (m.kind === "gif") return [400, { error: "A GIF cannot be edited." }];
      if (typeof body.text !== "string") return [400, { error: "Missing text." }];
      const text = body.text.trim().slice(0, 2000);
      if (!text && !m.images?.length && !m.embeds?.length) return [400, { error: "Empty message." }];
      if (text === m.text) return { message: publicMessage(m) };
      m.text = text;
      m.editedAt = Date.now();
      const message = publicMessage(m);
      tellMembers({ type: "group-message-updated", groupId: group.id, channelId: channel.id, message, mentioned: {} });
      events.emit("edited", message);
      return { message };
    }],
    ["DELETE", /^\/groups\/grp1\/channels\/chan1\/messages\/([^/]+)$/, (me, [mid]) => {
      const m = messages.get(mid);
      if (!m) return [404, { error: "Message not found." }];
      if (m.from !== me) return [403, { error: "You can only delete your own messages." }];
      messages.delete(mid);
      tellMembers({ type: "group-message-deleted", groupId: group.id, channelId: channel.id, messageId: mid });
      events.emit("deleted", mid);
      return { ok: true };
    }],
    ["DELETE", /^\/groups\/grp1\/channels\/chan1\/messages\/([^/]+)\/reactions$/, (me, [mid], _body, params) => {
      const emoji = params.get("emoji") ?? "";
      if (!STANDARD_EMOJI_RE.test(emoji)) return [400, { error: "Invalid emoji." }];
      const target = params.get("userId") || me;
      const held = (memberRoles[me] ?? []).map((id) => group.roles.find((r) => r.id === id)).filter(Boolean);
      const allowed = me === group.ownerId || held.some((r) => r.permissions.manage.manageReactions || r.permissions.manage.administrator);
      if (target !== me && !allowed) return [403, { error: "You do not have permission to remove other people's reactions." }];
      const m = messages.get(mid);
      if (!m) return [404, { error: "Message not found." }];
      m.reactions.get(emoji)?.delete(target);
      const { reactions = [] } = publicMessage(m);
      tellMembers({ type: "group-message-reactions", groupId: group.id, channelId: channel.id, messageId: mid, reactions });
      return { reactions };
    }],
    ["GET", /^\/groups\/grp1\/channels\/chan1\/messages\/([^/]+)\/reactions$/, (_me, [mid], _body, params) => {
      const emoji = params.get("emoji") ?? "";
      if (!STANDARD_EMOJI_RE.test(emoji)) return [400, { error: "Invalid emoji." }];
      const m = messages.get(mid);
      if (!m) return [404, { error: "Message not found." }];
      let ids = [...(m.reactions.get(emoji) ?? [])];
      const sort = params.get("sort");
      if (sort === "name") ids.sort((a, b) => groupUser(a).name.localeCompare(groupUser(b).name));
      else if (sort !== "oldest") ids.reverse();
      const q = (params.get("q") ?? "").toLowerCase();
      if (q) ids = ids.filter((id) => groupUser(id).name.toLowerCase().includes(q));
      const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 100);
      const after = params.get("after");
      const from = after ? ids.indexOf(after) + 1 : 0;
      const page = ids.slice(from, from + limit);
      const next = from + limit < ids.length ? page[page.length - 1] : null;
      return { people: page.map(groupUser), total: ids.length, next };
    }],
    ["POST", /^\/groups\/grp1\/channels\/chan1\/messages\/([^/]+)\/reactions$/, (me, [mid], body) => {
      if (typeof body.emoji !== "string" || !STANDARD_EMOJI_RE.test(body.emoji)) return [400, { error: "Invalid emoji." }];
      const m = messages.get(mid);
      if (!m) return [404, { error: "Message not found." }];
      const users = m.reactions.get(body.emoji) ?? new Set();
      if (body.on === false) users.delete(me); else users.add(me);
      m.reactions.set(body.emoji, users);
      const { reactions = [] } = publicMessage(m);
      tellMembers({ type: "group-message-reactions", groupId: group.id, channelId: channel.id, messageId: mid, reactions });
      events.emit("reaction", { mid, emoji: body.emoji, userId: me, on: body.on !== false });
      return { reactions };
    }],
    ["POST", /^\/groups\/grp1\/channels\/chan1\/typing$/, () => ({ ok: true })],
    ["POST", /^\/groups\/grp1\/members\/([^/]+)\/kick$/, (me, [target]) => {
      if (!canKick(me)) return [403, { error: "You do not have permission to kick members." }];
      if (target === group.ownerId) return [403, { error: "Nobody can remove the group's owner." }];
      if (!members.has(target)) return [404, { error: "That person is not in the group." }];
      members.delete(target);
      send(target, { type: "group-removed", groupId: group.id, reason: "kicked" });
      tellMembers({ type: "group-updated", groupId: group.id });
      events.emit("kicked", target);
      return { ok: true };
    }],
    ["GET", /^\/dm\/settings$/, (me) => ({ readReceipts: dmSettings.get(me) ?? true })],
    ["PUT", /^\/dm\/settings$/, (me, _m, body) => {
      if (typeof body.readReceipts !== "boolean") return [400, { error: "readReceipts must be true or false." }];
      dmSettings.set(me, body.readReceipts);
      send(me, { type: "dm-settings", readReceipts: body.readReceipts });
      return { readReceipts: body.readReceipts };
    }],
    ["POST", /^\/dm\/([^/]+)\/typing$/, (me, [to], body) => {
      if (to !== me) send(to, { type: "dm-typing", from: me, typing: body.typing !== false });
      return { ok: true };
    }],
    ["POST", /^\/dm\/([^/]+)\/read$/, (me, [other]) => {
      send(me, { type: "dm-read", otherId: other });
      if ((dmSettings.get(me) ?? true) && (dmSettings.get(other) ?? true)) send(other, { type: "dm-seen", by: me, ts: Date.now() });
      return { ok: true };
    }],
    ["POST", /^\/dm\/([^/]+)\/messages\/([^/]+)\/reactions$/, (me, [other, mid], body) => {
      if (typeof body.emoji !== "string" || !STANDARD_EMOJI_RE.test(body.emoji)) return [400, { error: "Invalid emoji." }];
      const m = dms.get(mid);
      if (!m || m.conversationId !== [me, other].sort().join(":")) return [404, { error: "Message not found." }];
      const users = m.reactions.get(body.emoji) ?? new Set();
      if (body.on === false) users.delete(me); else users.add(me);
      m.reactions.set(body.emoji, users);
      const { reactions = [] } = publicMessage(m);
      for (const id of [me, other]) send(id, { type: "dm-reactions", messageId: mid, from: m.from, to: m.to, reactions });
      return { reactions };
    }],
    ["PATCH", /^\/dm\/([^/]+)\/messages\/([^/]+)$/, (me, [other, mid], body) => {
      const m = dms.get(mid);
      if (!m || m.conversationId !== [me, other].sort().join(":")) return [404, { error: "Message not found." }];
      if (m.from !== me) return [403, { error: "You can only edit your own messages." }];
      if (m.kind === "gif") return [400, { error: "A GIF cannot be edited." }];
      if (typeof body.text !== "string") return [400, { error: "Missing text." }];
      const text = body.text.trim().slice(0, 2000);
      if (!text && !m.images?.length) return [400, { error: "Empty message." }];
      if (text === m.text) return { message: publicMessage(m) };
      m.text = text;
      m.editedAt = Date.now();
      const message = publicMessage(m);
      for (const id of [me, other]) send(id, { type: "dm-edited", message });
      events.emit("dm-edited", message);
      return { message };
    }],
    ["DELETE", /^\/dm\/([^/]+)\/messages\/([^/]+)$/, (me, [other, mid]) => {
      const m = dms.get(mid);
      if (!m || m.conversationId !== [me, other].sort().join(":")) return [404, { error: "Message not found." }];
      if (m.from !== me) return [403, { error: "You can only delete your own messages." }];
      dms.delete(mid);
      for (const id of [me, other]) send(id, { type: "dm-deleted", messageId: mid, from: m.from, to: m.to });
      events.emit("dm-deleted", mid);
      return { ok: true };
    }],
    ["POST", /^\/dm\/([^/]+)$/, (me, [to], body) => {
      // Um bot só puxa conversa com quem divide um grupo com ele ou já escreveu antes.
      const convo = [me, to].sort().join(":");
      const wroteFirst = [...dms.values()].some((m) => m.conversationId === convo && m.from === to);
      if (accounts.get(me)?.bot && !(members.has(me) && members.has(to)) && !wroteFirst) {
        return [403, { error: "A bot can only message people who share a group with it or who have messaged it first.", reason: "bot_dm_not_allowed" }];
      }
      const message = { id: randomUUID(), conversationId: [me, to].sort().join(":"), from: me, to, text: body.text, kind: "text", ...(body.replyTo ? { replyTo: body.replyTo } : {}), ts: Date.now() };
      const a = accounts.get(me);
      const fromUser = { id: a.id, username: a.username, displayName: a.displayName, flags: [], bot: a.bot, avatarUrl: null, nameColor: null };
      dms.set(message.id, { ...message, reactions: new Map() });
      for (const id of [me, to]) send(id, { type: "dm", message, fromUser });
      events.emit("dm", message);
      return { message };
    }],
  ];

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const reply = (status, data) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(data));
      };
      const raw = Buffer.concat(chunks).toString();
      const isJson = (req.headers["content-type"] ?? "").includes("application/json");
      // O que o Fastify faz com Content-Type JSON e corpo vazio.
      if (isJson && !raw) return reply(400, { error: "Body cannot be empty when content-type is set to 'application/json'" });
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch { return reply(400, { error: "Invalid JSON" }); }

      const url = new URL(req.url, "http://mock");
      const auth = req.headers.authorization ?? "";
      const me = auth === botToken ? "bot-1" : auth.startsWith("Bearer ") ? auth.slice(7) : null;
      requests.push({ method: req.method, path: url.pathname, me, body });
      if (!me) return reply(401, { error: "unauthorized" });
      // Como o hook do servidor real: toda rota, antes de qualquer outra coisa.
      if (suspended && me === "bot-1") {
        return reply(403, { error: "This bot has been suspended by GoLive's administration.", reason: "bot_suspended" });
      }
      for (const [method, pattern, handler] of routes) {
        const match = req.method === method && pattern.exec(url.pathname);
        if (!match) continue;
        const out = handler(me, match.slice(1), body, url.searchParams);
        return Array.isArray(out) ? reply(out[0], out[1]) : reply(200, out);
      }
      reply(404, { error: "Route not found" });
    });
  });

  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ type: "welcome", id: randomUUID() }));
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type !== "register") return;
      // Token inválido cai no caminho de convidado sem nome, como no servidor real.
      if (msg.token !== botToken) return ws.send(JSON.stringify({ type: "register-error", message: "Invalid name." }));
      if (suspended) {
        ws.send(JSON.stringify({ type: "banned", subject: "account", reason: "Suspended" }));
        return ws.close(4003, "banned");
      }
      if (!sockets.has("bot-1")) sockets.set("bot-1", new Set());
      sockets.get("bot-1").add(ws);
      ws.on("close", () => sockets.get("bot-1")?.delete(ws));
      ws.send(JSON.stringify({ type: "registered", id: randomUUID(), name: "Teste", account: { username: "teste_bot", flags: [], bot: true }, guestToken: null }));
      events.emit("registered");
    });
  });

  return {
    events,
    requests,
    messages,
    memberRoles,
    group,
    listen: () => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port))),
    dropConnections: () => { for (const ws of wss.clients) ws.terminate(); },
    /** Tira o bot do grupo sem avisar — para testar ele sendo adicionado de novo. */
    removeBotFromGroup: () => members.delete("bot-1"),
    /** O que acontece quando o dono troca o token no portal: o WebSocket fecha com 4004. */
    revokeToken: () => { for (const ws of sockets.get("bot-1") ?? []) ws.close(4004, "token-reset"); },
    /** A administração suspende o bot: banned + 4003 no WebSocket, 403 bot_suspended no HTTP. */
    suspend: () => {
      suspended = true;
      for (const ws of sockets.get("bot-1") ?? []) {
        ws.send(JSON.stringify({ type: "banned", subject: "account", reason: "Suspended" }));
        ws.close(4003, "banned");
      }
    },
    /** A suspensão acaba: o bot volta como estava. */
    unsuspend: () => { suspended = false; },
    close: () => new Promise((resolve) => { for (const ws of wss.clients) ws.terminate(); wss.close(); server.close(() => resolve()); }),
    announce: (payload) => tellMembers(payload),
  };
}
