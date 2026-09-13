// O cliente do bot: junta a API HTTP (Rest) com a conexão em tempo real
// (Gateway) e transforma os eventos crus em eventos fáceis de usar.
//
// Eventos emitidos:
//   ready            (user)                  conectado e registrado pela 1ª vez
//   reconnected      (user)                  registrado de novo após uma queda
//   messageCreate    (GroupMessage)          mensagem nova numa sala de texto
//   messageUpdate    (GroupMessage)          o autor editou o texto (como ficou)
//   messageDelete    ({ groupId, channelId, messageId })
//   reactionAdd      ({ groupId, channelId, messageId, emoji, userId, reactions })
//   reactionRemove   ({ groupId, channelId, messageId, emoji, userId, reactions })
//   reactionUpdate   ({ groupId, channelId, messageId, reactions })
//   typing           ({ groupId, channelId, userId, name, typing })
//   directMessage    (DirectMessage)         DM recebida (as enviadas pelo bot não)
//   groupUpdate      ({ groupId })           algo mudou no grupo
//   groupRemove      ({ groupId, reason })   o bot saiu/foi removido do grupo
//   raw              (payload)               todo evento, como veio
//   disconnect / reconnecting / error / debug

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { Rest } from "./rest.js";
import { Gateway } from "./gateway.js";
import { DirectMessage, GroupMessage } from "./structures.js";
import { hasPermission } from "./permissions.js";

// Quantas mensagens têm suas reações lembradas (para descobrir quem reagiu).
const MAX_TRACKED_MESSAGES = 2000;
// Por quanto tempo os dados de um grupo ficam em cache (invalidado antes em "group-updated").
const GROUP_CACHE_MS = 60_000;

export class GoLiveClient extends EventEmitter {
  /** A conta do bot (resposta de GET /auth/me), disponível depois do login. */
  user = null;
  #groups = new Map();
  #reactions = new Map();
  #readyOnce = false;

  constructor({ token, apiUrl, gatewayUrl } = {}) {
    super();
    if (!token) throw new Error("Defina o token do bot (variável GOLIVE_TOKEN).");
    this.rest = new Rest({ token, baseUrl: apiUrl });
    this.gateway = new Gateway({ token, url: gatewayUrl });
    this.gateway.on("dispatch", (payload) => this.#dispatch(payload));
    for (const name of ["error", "debug", "disconnect", "reconnecting"]) {
      this.gateway.on(name, (arg) => this.emit(name, arg));
    }
  }

  /** Confere o token, descobre quem é o bot e abre a conexão em tempo real. */
  async login() {
    const { account } = await this.rest.get("/auth/me");
    if (!account.bot) {
      this.emit("debug", "atenção: este token não é de uma conta bot");
    }
    this.user = account;
    this.gateway.connect();
    return account;
  }

  destroy() {
    this.gateway.close();
  }

  // ─── Eventos ────────────────────────────────────────────────────────────

  #dispatch(payload) {
    this.emit("raw", payload);
    switch (payload.type) {
      case "registered":
        this.emit(this.#readyOnce ? "reconnected" : "ready", this.user);
        this.#readyOnce = true;
        break;
      case "group-message":
        this.#rememberReactions(payload.message.id, payload.message.reactions ?? []);
        this.emit("messageCreate", new GroupMessage(this, payload));
        break;
      case "group-message-updated":
        // O evento não traz o autor; o nome é o que ele usava quando enviou.
        this.emit(
          "messageUpdate",
          new GroupMessage(this, {
            message: payload.message,
            author: { id: payload.message.from, name: payload.message.fromName },
            mentioned: payload.mentioned,
          })
        );
        break;
      case "group-message-deleted":
        this.#reactions.delete(payload.messageId);
        this.emit("messageDelete", payload);
        break;
      case "group-message-reactions":
        this.#diffReactions(payload);
        break;
      case "group-typing":
        this.emit("typing", payload);
        break;
      case "group-updated":
        this.#groups.delete(payload.groupId);
        this.emit("groupUpdate", payload);
        break;
      case "group-removed":
        this.#groups.delete(payload.groupId);
        this.emit("groupRemove", payload);
        break;
      case "dm":
        // O evento chega para os dois lados da conversa — inclusive quando é o
        // próprio bot quem envia. Só repassamos as que outra pessoa mandou.
        if (payload.message.from !== this.user?.id) {
          this.emit("directMessage", new DirectMessage(this, payload));
        }
        break;
    }
  }

  // O evento de reações traz a lista completa de quem está em cada emoji, não
  // "fulano reagiu". Guardamos o último estado de cada mensagem e comparamos.
  #rememberReactions(messageId, reactions) {
    this.#reactions.delete(messageId);
    this.#reactions.set(messageId, new Map(reactions.map((r) => [r.emoji, new Set(r.users)])));
    if (this.#reactions.size > MAX_TRACKED_MESSAGES) {
      this.#reactions.delete(this.#reactions.keys().next().value);
    }
  }

  #diffReactions({ groupId, channelId, messageId, reactions }) {
    const before = this.#reactions.get(messageId);
    this.#rememberReactions(messageId, reactions);
    const base = { groupId, channelId, messageId, reactions };
    this.emit("reactionUpdate", base);
    // Uma mensagem que o bot não viu chegar: não dá para saber o que mudou.
    if (!before) return;
    const after = this.#reactions.get(messageId);
    for (const [emoji, users] of after) {
      const old = before.get(emoji);
      for (const userId of users) {
        if (!old?.has(userId)) this.emit("reactionAdd", { ...base, emoji, userId });
      }
    }
    for (const [emoji, users] of before) {
      const now = after.get(emoji);
      for (const userId of users) {
        if (!now?.has(userId)) this.emit("reactionRemove", { ...base, emoji, userId });
      }
    }
  }

  /** As reações de uma mensagem como o bot as viu por último: Map<emoji, Set<userId>>. */
  cachedReactions(messageId) {
    return this.#reactions.get(messageId) ?? null;
  }

  /**
   * Passa a acompanhar as reações de uma mensagem que o bot não viu chegar
   * (uma mensagem antiga, buscada pela API). Sem isso, a primeira mudança nas
   * reações dela não gera reactionAdd/reactionRemove.
   */
  trackReactions(message) {
    this.#rememberReactions(message.id, message.reactions ?? []);
  }

  // ─── Mensagens ─────────────────────────────────────────────────────────

  /**
   * Envia uma mensagem numa sala de texto. `content` é um texto ou um objeto
   * { text, images, url, replyTo, mentions }. Um `nonce` é gerado para que uma
   * nova tentativa (depois de uma queda de rede) não duplique a mensagem.
   */
  async sendMessage(groupId, channelId, content) {
    const body = typeof content === "string" ? { text: content } : { ...content };
    body.nonce ??= randomUUID();
    const { message } = await this.rest.post(`/groups/${groupId}/channels/${channelId}/messages`, body);
    return message;
  }

  /** Troca o texto de uma mensagem do próprio bot. Devolve a mensagem como ficou. */
  async editMessage(groupId, channelId, messageId, text) {
    const { message } = await this.rest.patch(`/groups/${groupId}/channels/${channelId}/messages/${messageId}`, {
      text,
    });
    return message;
  }

  deleteMessage(groupId, channelId, messageId) {
    return this.rest.delete(`/groups/${groupId}/channels/${channelId}/messages/${messageId}`);
  }

  /** Adiciona (`on = true`) ou tira (`on = false`) a reação do bot. Devolve as reações atuais. */
  async react(groupId, channelId, messageId, emoji, on = true) {
    const { reactions } = await this.rest.post(
      `/groups/${groupId}/channels/${channelId}/messages/${messageId}/reactions`,
      { emoji, on }
    );
    return reactions;
  }

  /** Mostra (ou esconde) "Bot está digitando..." na sala. */
  sendTyping(groupId, channelId, typing = true) {
    return this.rest.post(`/groups/${groupId}/channels/${channelId}/typing`, { typing });
  }

  /** Uma página (até 50) de mensagens, da mais antiga para a mais nova, antes de `before` (ms). */
  fetchMessages(groupId, channelId, { before } = {}) {
    const query = before ? `?before=${before}` : "";
    return this.rest.get(`/groups/${groupId}/channels/${channelId}/messages${query}`);
  }

  /**
   * Uma mensagem específica. Não existe rota para buscar uma mensagem só, mas
   * a página "antes de ts + 1" termina exatamente nela.
   */
  async fetchMessage(groupId, channelId, messageId, ts) {
    const { messages } = await this.fetchMessages(groupId, channelId, { before: ts + 1 });
    return messages.find((m) => m.id === messageId) ?? null;
  }

  // ─── Mensagens diretas ─────────────────────────────────────────────────

  async sendDirectMessage(userId, content) {
    const body = typeof content === "string" ? { text: content } : { ...content };
    const { message } = await this.rest.post(`/dm/${userId}`, body);
    return message;
  }

  /** Troca o texto de uma DM do próprio bot. Devolve a mensagem como ficou. */
  async editDirectMessage(userId, messageId, text) {
    const { message } = await this.rest.patch(`/dm/${userId}/messages/${messageId}`, { text });
    return message;
  }

  /** Apaga uma DM do próprio bot, para os dois lados. */
  deleteDirectMessage(userId, messageId) {
    return this.rest.delete(`/dm/${userId}/messages/${messageId}`);
  }

  // ─── Grupos ────────────────────────────────────────────────────────────

  /** Os grupos em que o bot está. */
  async fetchGroups() {
    const { groups } = await this.rest.get("/groups");
    return groups;
  }

  /** GET /groups/:id — salas, cargos, quem tem qual cargo. Com cache curto. */
  async fetchGroup(groupId, { force = false } = {}) {
    const cached = this.#groups.get(groupId);
    if (!force && cached && Date.now() - cached.at < GROUP_CACHE_MS) return cached.data;
    const data = await this.rest.get(`/groups/${groupId}`);
    this.#groups.set(groupId, { at: Date.now(), data });
    return data;
  }

  /** Se `userId` tem a permissão `key` (ex.: "kickMembers") no grupo. */
  async hasPermission(groupId, userId, key) {
    return hasPermission(await this.fetchGroup(groupId), userId, key);
  }

  /** Entra num grupo por um código de convite (ou link /invite/<código>). */
  async acceptInvite(codeOrLink) {
    const code = String(codeOrLink).trim().split("/").filter(Boolean).pop();
    const { groupId } = await this.rest.post(`/invites/${code}/accept`);
    return groupId;
  }
}
