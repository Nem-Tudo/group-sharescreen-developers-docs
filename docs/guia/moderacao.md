# Moderação

Um bot de moderação trabalha 24 horas sem cansar. Esta página cobre as ferramentas — e como usá-las sem transformar o bot numa brecha.

::: danger Antes de tudo
Todo comando de moderação precisa conferir se **quem pediu** tem a permissão. A API só confere o bot. Leia [Duas perguntas diferentes](./permissoes#duas-perguntas-diferentes).
:::

## As ferramentas

| Ação | Rota | Permissão do bot |
|---|---|---|
| Apagar mensagem | <span class="http delete">DELETE</span> `/groups/:id/channels/:cid/messages/:mid` | `manageMessages` (as dos outros) |
| Tirar a reação de alguém | <span class="http delete">DELETE</span> `/groups/:id/channels/:cid/messages/:mid/reactions?emoji=&userId=` | `manageReactions` (as dos outros) |
| Expulsar | <span class="http post">POST</span> `/groups/:id/members/:userId/kick` | `kickMembers` |
| Banir | <span class="http post">POST</span> `/groups/:id/bans/:userId` | `banMembers` |
| Desbanir | <span class="http delete">DELETE</span> `/groups/:id/bans/:userId` | `banMembers` |
| Lista de banidos | <span class="http get">GET</span> `/groups/:id/bans` | `banMembers` |
| Dar/tirar cargos | <span class="http put">PUT</span> `/groups/:id/members/:userId/roles` | `manageRoles` |

As rotas de expulsar e banir não têm corpo — mande `{}`.

- **Expulsar** tira a pessoa do grupo; ela pode voltar com um convite.
- **Banir** tira e impede de voltar, até alguém desbanir. Dá para banir quem já saiu.
- Ninguém expulsa ou bane o **dono**, nem alguém com cargo **igual ou acima** do seu (`403`).
- A pessoa removida recebe `group-removed` com `reason: "kicked"` ou `"banned"`.

## Comandos de expulsar e banir

<<< @/../examples/bot-completo/src/commands/banir.js

## Moderação automática

O bot pode agir sozinho, sem comando, olhando cada mensagem que chega.

### Filtro de links

```js
const LINK = /(https?:\/\/|www\.)\S+/i;
const ALLOWED = ["golive.nemtudo.me", "youtube.com", "youtu.be"];

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const url = message.text.match(LINK)?.[0];
  if (!url || ALLOWED.some((host) => url.includes(host))) return;

  // Moderadores podem mandar o que quiserem
  if (await client.hasPermission(message.groupId, message.author.id, "manageMessages")) return;

  await message.delete();
  await message.send(`🔗 <@${message.author.id}>, links externos não são permitidos aqui.`);
});
```

### Anti-flood

Muitas mensagens em pouco tempo, da mesma pessoa:

```js
const WINDOW_MS = 10_000;
const MAX_MESSAGES = 6;
const recent = new Map(); // userId → timestamps

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const now = Date.now();
  const times = (recent.get(message.author.id) ?? []).filter((t) => now - t < WINDOW_MS);
  times.push(now);
  recent.set(message.author.id, times);

  if (times.length === MAX_MESSAGES) {
    await message.reply("🐢 Devagar! Você está mandando mensagens rápido demais.");
  } else if (times.length > MAX_MESSAGES + 4) {
    await message.delete().catch(() => {});
  }
});

// Limpa quem ficou quieto, para o Map não crescer para sempre
setInterval(() => {
  const now = Date.now();
  for (const [id, times] of recent) if (times.every((t) => now - t > WINDOW_MS)) recent.delete(id);
}, 60_000);
```

### Palavras proibidas do grupo

O GoLive já recusa algumas palavras em todo o site. Para uma lista própria do grupo:

```js
const BLOCKED = ["palavrão1", "palavrão2"];
const normalize = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const text = normalize(message.text);
  if (BLOCKED.some((word) => text.includes(word))) {
    await message.delete();
    await message.send(`🚫 <@${message.author.id}>, olha a linguagem.`);
  }
});
```

::: tip Avise, depois aja
Moderação automática erra. Comece só avisando (ou só registrando), veja os falsos positivos por uns dias e depois passe a apagar.
:::

## Sala de registros (logs)

Registrar o que o bot fez numa sala só da equipe dá transparência:

```js
const LOG_CHANNEL = "l0gs4l4000001";

async function log(groupId, text) {
  await client.sendMessage(groupId, LOG_CHANNEL, { text: `🧾 ${new Date().toLocaleString("pt-BR")} — ${text}` })
    .catch((err) => console.error("log falhou:", err.message));
}

// dentro do !banir:
await log(message.groupId, `<@${message.author.id}> baniu <@${targetId}>. Motivo: ${reason || "—"}`);
```

Deixe a sala visível só para a equipe com as [permissões por sala](./permissoes#permissoes-por-sala).

## Registrando mensagens apagadas

O evento `group-message-deleted` não traz o conteúdo. Para registrar o que foi apagado, o bot guarda as mensagens recentes quando chegam:

```js
const recentMessages = new Map(); // id → { author, text }

client.on("messageCreate", (m) => {
  recentMessages.set(m.id, { author: m.author.name, text: m.text, groupId: m.groupId });
  if (recentMessages.size > 5000) recentMessages.delete(recentMessages.keys().next().value);
});

client.on("messageDelete", async ({ messageId }) => {
  const m = recentMessages.get(messageId);
  if (m) await log(m.groupId, `Mensagem de ${m.author} apagada: "${m.text.slice(0, 300)}"`);
});
```

::: warning Privacidade
Guardar mensagens apagadas é sensível: a pessoa apagou por um motivo. Faça isso só em grupos que avisam que há registro, e só pelo tempo necessário.
:::
