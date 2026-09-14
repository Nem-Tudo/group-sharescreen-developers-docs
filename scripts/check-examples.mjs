// Roda os bots de exemplo contra uma imitação local da API (scripts/mock-api.mjs)
// e confere que cada recurso documentado funciona: registro, comandos,
// respostas, menções, permissões, páginas por reação, enquete, DMs,
// reconexão, entrada em grupos e token revogado. Nada aqui fala com a API de
// verdade.
//
//   npm run check:examples

import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createMockApi } from "./mock-api.mjs";

const BOT_TOKEN = "Bot Ym90LTE.segredo-de-teste";
const mock = createMockApi({ botToken: BOT_TOKEN });
const port = await mock.listen();
const API = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  GOLIVE_TOKEN: BOT_TOKEN,
  GOLIVE_API_URL: API,
  GOLIVE_GATEWAY_URL: `ws://127.0.0.1:${port}/ws`,
  PREFIX: "!",
};

function waitFor(eventName, predicate = () => true, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      mock.events.off(eventName, listener);
      reject(new Error(`tempo esgotado esperando "${eventName}"`));
    }, timeout);
    function listener(value) {
      if (!predicate(value)) return;
      clearTimeout(timer);
      mock.events.off(eventName, listener);
      resolve(value);
    }
    mock.events.on(eventName, listener);
  });
}

const botSays = (predicate, timeout) => waitFor("message", (m) => m.from === "bot-1" && predicate(m), timeout);
const botReacts = (mid, emoji) => waitFor("reaction", (r) => r.userId === "bot-1" && r.mid === mid && r.emoji === emoji);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function as(userId, method, path, body = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${userId}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}
const say = (userId, text) => as(userId, "POST", "/groups/grp1/channels/chan1/messages", { text });
const react = (userId, mid, emoji, on = true) =>
  as(userId, "POST", `/groups/grp1/channels/chan1/messages/${mid}/reactions`, { emoji, on });

const botLog = [];
mock.events.on("message", (m) => m.from === "bot-1" && botLog.push(m.text));

let failures = 0;
async function step(name, fn) {
  const seen = botLog.length;
  try {
    await fn();
    console.log(`  ✔ ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  ✘ ${name}\n      ${err.message}`);
    const said = botLog.slice(seen);
    if (said.length) console.error(`      o bot disse: ${said.map((t) => JSON.stringify(t)).join(" | ")}`);
  }
}

function startBot(entry) {
  const child = spawn(process.execPath, [entry], { env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  return { child, output: () => output };
}

async function stopBot(bot) {
  bot.child.kill();
  await once(bot.child, "exit");
}

// ─── examples/ping-pong ─────────────────────────────────────────────────────
console.log("examples/ping-pong");
{
  const registered = waitFor("registered");
  const bot = startBot("examples/ping-pong/index.js");
  await step("registra no WebSocket com o token", () => registered);
  await step("responde !ping citando a mensagem", async () => {
    const reply = botSays((m) => m.text === "Pong! 🏓");
    await say("user-2", "!ping");
    const m = await reply;
    assert.equal(m.replyTo.userId, "user-2");
  });
  await stopBot(bot);
}

// ─── examples/bot-completo ──────────────────────────────────────────────────
console.log("examples/bot-completo");
const registered = waitFor("registered");
const bot = startBot("examples/bot-completo/src/index.js");

await step("faz login e registra", async () => {
  await registered;
  await sleep(300);
  assert.match(bot.output(), /Conectado como Teste \(@teste_bot\)/);
});

await step("!ping responde duas vezes", async () => {
  const pong = botSays((m) => m.text === "🏓 Pong!");
  const latency = botSays((m) => m.text.startsWith("⏱️"));
  await say("user-2", "!ping");
  assert.equal((await pong).replyTo.userId, "user-2");
  await latency;
});

await step("!dado 20 e o cooldown", async () => {
  const roll = botSays((m) => /^🎲 Deu \d+ \(d20\)$/.test(m.text));
  await say("user-2", "!dado 20");
  await roll;
  const wait = botSays((m) => m.text.startsWith("⏳"));
  await say("user-2", "!dado 20");
  await wait;
});

await step("!escolher e aliases", async () => {
  const pick = botSays((m) => /Eu escolho: (pizza|sushi)$/.test(m.text));
  await say("user-3", "!choose pizza | sushi");
  await pick;
});

await step("!ajuda lista e explica comandos", async () => {
  const list = botSays((m) => m.text.includes("!membros") && m.text.includes("!enquete"));
  await say("user-3", "!ajuda");
  await list;
  const detail = botSays((m) => m.text.includes("Uso: !dado [lados]"));
  await say("user-3", "!ajuda dado");
  await detail;
});

await step("!usuario lê a menção <@id>", async () => {
  const profile = botSays((m) => m.text.includes("Dona do Grupo (@dona)") && m.text.includes("Eu criei o grupo"));
  await say("user-3", "!usuario <@user-1>");
  await profile;
});

await step("responde quando é mencionado", async () => {
  const hello = botSays((m) => m.text.startsWith("Oi, Maria!"));
  await say("user-2", "ei <@bot-1> tudo bem?");
  await hello;
});

await step("ignora comando desconhecido", async () => {
  const before = mock.requests.length;
  await say("user-2", "!naoexiste");
  await sleep(300);
  assert.equal(mock.requests.slice(before).filter((r) => r.me === "bot-1").length, 0);
});

await step("!expulsar recusa quem não tem permissão", async () => {
  const denied = botSays((m) => m.text.startsWith("🚫"));
  await say("user-2", "!expulsar <@user-3>");
  await denied;
});

await step("!expulsar: a pessoa tem cargo, mas o bot ainda não", async () => {
  mock.memberRoles["user-2"] = ["mod"];
  mock.announce({ type: "group-updated", groupId: "grp1" });
  await sleep(100);
  const refused = botSays((m) => m.text === "Não consegui: You do not have permission to kick members.");
  await say("user-2", "!expulsar <@user-3>");
  await refused;
});

await step("!expulsar respeita a API (dono não sai) e expulsa com cargo", async () => {
  mock.memberRoles["bot-1"] = ["mod"];
  mock.announce({ type: "group-updated", groupId: "grp1" });
  await sleep(100);
  const refused = botSays((m) => m.text.includes("Nobody can remove the group's owner."));
  await say("user-2", "!expulsar <@user-1>");
  await refused;
  const kicked = waitFor("kicked", (id) => id === "user-3");
  const notice = botSays((m) => m.text === "👢 <@user-3> foi expulso(a). Motivo: spam");
  await say("user-2", "!expulsar <@user-3> spam");
  await kicked;
  await notice;
});

await step("!membros pagina por reação", async () => {
  const page1 = botSays((m) => m.text.includes("Página 1/3"));
  await say("user-2", "!membros");
  const first = await page1;
  await botReacts(first.id, "❌");

  // Outra pessoa não vira as páginas de quem pediu.
  const before = mock.requests.length;
  await react("user-10", first.id, "➡️");
  await sleep(400);
  assert.equal(mock.requests.slice(before).filter((r) => r.me === "bot-1").length, 0);

  const page2 = botSays((m) => m.text.includes("Página 2/3"));
  const deleted = waitFor("deleted", (mid) => mid === first.id);
  await react("user-2", first.id, "➡️");
  const second = await page2;
  await deleted;
  await botReacts(second.id, "❌");

  const back = botSays((m) => m.text.includes("Página 1/3"));
  await react("user-2", second.id, "⬅️");
  const again = await back;
  await botReacts(again.id, "❌");

  const closed = waitFor("deleted", (mid) => mid === again.id);
  await react("user-2", again.id, "❌");
  await closed;
});

await step("!enquete cria a votação com reações numeradas", async () => {
  const poll = botSays((m) => m.text.startsWith("📊 Qual filme?"));
  await say("user-2", "!enquete Qual filme? | Matrix | Duna");
  const m = await poll;
  await botReacts(m.id, "1️⃣");
  await botReacts(m.id, "2️⃣");
  // O truque do fetchMessage: a página "antes de ts + 1" termina na mensagem.
  const res = await fetch(`${API}/groups/grp1/channels/chan1/messages?before=${m.ts + 1}`, {
    headers: { Authorization: "Bearer user-2" },
  });
  const { messages } = await res.json();
  assert.equal(messages.at(-1).id, m.id);
});

await step("responde DM", async () => {
  const dm = waitFor("dm", (m) => m.from === "bot-1" && m.to === "user-2" && m.text.includes("!ping"));
  await as("user-2", "POST", "/dm/bot-1", { text: "ajuda" });
  await dm;
});

await step("reconecta sozinho quando a conexão cai", async () => {
  const back = waitFor("registered", () => true, 8000);
  mock.dropConnections();
  await back;
  const pong = botSays((m) => m.text === "🏓 Pong!");
  await say("user-3", "!ping");
  await pong;
  assert.match(bot.output(), /Reconectado/);
});

await stopBot(bot);

// ─── GoLiveClient, direto ───────────────────────────────────────────────────
// O que nenhum comando do exemplo usa, conferido chamando o cliente aqui mesmo.
console.log("examples/bot-completo — GoLiveClient");
{
  const { GoLiveClient } = await import("../examples/bot-completo/src/golive/client.js");
  const client = new GoLiveClient({ token: BOT_TOKEN, apiUrl: API, gatewayUrl: env.GOLIVE_GATEWAY_URL });
  const ready = once(client, "ready");
  await client.login();
  await ready;

  await step("edita a própria mensagem e recebe messageUpdate", async () => {
    const sent = await client.sendMessage("grp1", "chan1", "primeira versão");
    const update = once(client, "messageUpdate");
    const edited = await client.editMessage("grp1", "chan1", sent.id, "segunda versão");
    assert.equal(edited.text, "segunda versão");
    assert.ok(edited.editedAt >= sent.ts);
    const [message] = await update;
    assert.equal(message.id, sent.id);
    assert.equal(message.text, "segunda versão");
    assert.ok(message.editedAt instanceof Date);
    assert.equal(message.createdAt.getTime(), sent.ts);
  });

  await step("não edita a mensagem de outra pessoa", async () => {
    const { message } = await say("user-2", "minha mensagem");
    await assert.rejects(client.editMessage("grp1", "chan1", message.id, "mexi"), /edit your own/);
  });

  await step("edita e apaga a própria DM", async () => {
    const sent = await client.sendDirectMessage("user-2", "Pensando…");
    const edited = waitFor("dm-edited", (m) => m.id === sent.id);
    const message = await client.editDirectMessage("user-2", sent.id, "Pronto!");
    assert.equal(message.text, "Pronto!");
    assert.ok(message.editedAt >= sent.ts);
    await edited;
    const deleted = waitFor("dm-deleted", (mid) => mid === sent.id);
    await client.deleteDirectMessage("user-2", sent.id);
    await deleted;
  });

  await step("não apaga a DM de outra pessoa", async () => {
    const { message } = await as("user-2", "POST", "/dm/bot-1", { text: "oi" });
    await assert.rejects(client.deleteDirectMessage("user-2", message.id), /delete your own/);
  });

  await step("só puxa DM com quem divide um grupo ou já escreveu antes", async () => {
    await assert.rejects(client.sendDirectMessage("user-99", "oi"), /only message people/);
    await as("user-99", "POST", "/dm/bot-1", { text: "oi bot" });
    const reply = await client.sendDirectMessage("user-99", "Oi! 👋");
    assert.equal(reply.to, "user-99");
  });

  await step("não entra em grupo sozinho, nem por convite", async () => {
    await assert.rejects(client.rest.post("/invites/AbC12345/accept"), /cannot join groups on their own/);
    await assert.rejects(client.rest.post("/groups/grp1/join"), /cannot join groups on their own/);
  });

  await step("recebe groupAdd quando quem gerencia o grupo adiciona o bot", async () => {
    mock.removeBotFromGroup();
    const added = once(client, "groupAdd");
    const res = await as("user-1", "POST", "/groups/grp1/bots", { botId: "bot-1" });
    assert.equal(res.groupId, "grp1");
    const [event] = await added;
    assert.deepEqual(event, { type: "group-added", groupId: "grp1", addedBy: "user-1" });
    assert.equal(client.installUrl(), "https://golive.nemtudo.me/bots/bot-1/add");
  });

  await step("para de reconectar quando o token é revogado (4004)", async () => {
    const failed = once(client, "error");
    let reconnected = false;
    const onReady = () => (reconnected = true);
    client.on("reconnected", onReady);
    mock.revokeToken();
    const [err] = await failed;
    assert.match(err.message, /token deste bot foi trocado/);
    await sleep(1500);
    client.off("reconnected", onReady);
    assert.equal(reconnected, false);
  });

  client.destroy();
}

await mock.close();

if (/Error|❌/.test(bot.output())) console.log("\nSaída do bot:\n" + bot.output());
console.log(failures === 0 ? "\nTudo certo ✅" : `\n${failures} verificação(ões) falharam ❌`);
process.exit(failures === 0 ? 0 : 1);
