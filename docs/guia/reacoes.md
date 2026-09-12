# Reações e enquetes

Reações são emoji que as pessoas colocam embaixo das mensagens. Para um bot, elas são mais que enfeite: são **botões**. Enquetes, páginas, cargos por reação e confirmações ("reaja com ✅ para aceitar") são todos feitos com elas.

## Reagindo

<span class="http post">POST</span> `/groups/:groupId/channels/:channelId/messages/:messageId/reactions`

| Campo | Descrição |
|---|---|
| `emoji` | **Um** emoji Unicode padrão: `"👍"`, `"✅"`, `"1️⃣"`, `"🇧🇷"`. Emoji personalizados não existem. |
| `on` | `true` (padrão) coloca a reação do bot; `false` tira. |

```js
async function react(groupId, channelId, messageId, emoji, on = true) {
  const res = await fetch(
    `${API}/groups/${groupId}/channels/${channelId}/messages/${messageId}/reactions`,
    {
      method: "POST",
      headers: { Authorization: TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ emoji, on }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${data.error}`);
  return data.reactions; // as reações da mensagem depois da mudança
}

await react(groupId, channelId, messageId, "👍");        // coloca
await react(groupId, channelId, messageId, "👍", false); // tira
```

Regras:

- No máximo **20 emoji diferentes** por mensagem.
- Colocar um emoji **novo** exige a permissão `addReactions`; entrar num que já está lá exige `react`. Tirar a própria reação é sempre permitido.
- O bot **só mexe na própria reação**. Não existe como tirar a reação de outra pessoa.
- Para várias reações em ordem (1️⃣ 2️⃣ 3️⃣), faça uma de cada vez com `await` — em paralelo elas podem aparecer embaralhadas.

::: tip Emoji com variação
Alguns emoji têm um caractere invisível de variação (`U+FE0F`): `"❤️"` é `❤` + `FE0F`. Copie o emoji de um teclado de emoji ou de uma mensagem, e a API aceita. Se receber `400 Invalid emoji.`, o texto não é exatamente um emoji.
:::

## O formato das reações

Numa mensagem, as reações vêm como uma lista, na ordem em que cada emoji apareceu:

```js
reactions: [
  { emoji: "👍", users: ["a41c...", "f3a9..."] },
  { emoji: "😂", users: ["b77e..."] }
]
```

Uma mensagem sem reações simplesmente não tem o campo `reactions`.

## Percebendo reações

Quando as reações de uma mensagem mudam, todos que veem a sala recebem:

```js
{
  type: "group-message-reactions",
  groupId: "k2x9d0a1b3",
  channelId: "q7w3e5r9t1y2",
  messageId: "8c1f...",
  reactions: [ { emoji: "👍", users: ["a41c...", "f3a9..."] } ]
}
```

::: warning O evento não diz quem reagiu
O evento traz **como as reações ficaram**, não "Maria reagiu com 👍". Para saber o que mudou, o bot guarda o último estado de cada mensagem e compara.
:::

### Descobrindo quem reagiu (diff)

```js
import { EventEmitter } from "node:events";

const reactions = new EventEmitter();
const lastState = new Map(); // messageId → Map<emoji, Set<userId>>

const toState = (list = []) => new Map(list.map((r) => [r.emoji, new Set(r.users)]));

// Toda mensagem nova começa com o estado dela (normalmente vazio).
function onGroupMessage(event) {
  lastState.set(event.message.id, toState(event.message.reactions));
}

function onReactionsChanged(event) {
  const before = lastState.get(event.messageId);
  const after = toState(event.reactions);
  lastState.set(event.messageId, after);
  if (!before) return; // mensagem que o bot não viu chegar: impossível comparar

  for (const [emoji, users] of after) {
    for (const userId of users) {
      if (!before.get(emoji)?.has(userId)) reactions.emit("add", { ...event, emoji, userId });
    }
  }
  for (const [emoji, users] of before) {
    for (const userId of users) {
      if (!after.get(emoji)?.has(userId)) reactions.emit("remove", { ...event, emoji, userId });
    }
  }
}

reactions.on("add", ({ emoji, userId, messageId }) => {
  console.log(`${userId} reagiu ${emoji} em ${messageId}`);
});
```

Ligue as duas funções aos eventos `group-message` e `group-message-reactions` do WebSocket. Duas observações:

- O bot só consegue comparar mensagens que **viu chegar** enquanto estava conectado — incluindo as dele mesmo, que também chegam como `group-message`.
- Limite o tamanho do `lastState` (as últimas ~2000 mensagens bastam), senão a memória cresce para sempre.

O `GoLiveClient` do [bot completo](/exemplos/bot-completo) já faz isso e emite `reactionAdd` e `reactionRemove` prontos.

## Exemplo: confirmação com ✅ / ❌

```js
async function confirm(client, message, question, { time = 30_000 } = {}) {
  const prompt = await message.reply(`${question}\nReaja com ✅ para confirmar ou ❌ para cancelar.`);
  await client.react(message.groupId, message.channelId, prompt.id, "✅");
  await client.react(message.groupId, message.channelId, prompt.id, "❌");

  return new Promise((resolve) => {
    const timer = setTimeout(() => finish(false), time);
    function onAdd(event) {
      if (event.messageId !== prompt.id || event.userId !== message.author.id) return;
      if (event.emoji === "✅") finish(true);
      if (event.emoji === "❌") finish(false);
    }
    function finish(answer) {
      clearTimeout(timer);
      client.off("reactionAdd", onAdd);
      resolve(answer);
    }
    client.on("reactionAdd", onAdd);
  });
}

// num comando:
if (await confirm(client, message, "Apagar todos os seus pontos?")) {
  await message.reply("Feito. 🗑️");
} else {
  await message.reply("Cancelado.");
}
```

## Exemplo: enquete

O bot manda a pergunta, reage com 1️⃣ 2️⃣ 3️⃣ e, depois de um tempo, conta os votos. A contagem lê a mensagem de novo pela API, que é mais confiável que o cache se o bot tiver reconectado no meio — e desconta a reação do próprio bot em cada opção.

<<< @/../examples/bot-completo/src/commands/enquete.js

O `fetchMessage` usa o truque de [buscar uma mensagem pelo `ts`](./enviando-mensagens#lendo-o-historico): a página `?before=${ts + 1}` termina nela.

## Exemplo: cargos por reação

"Reaja com 🎮 para receber o cargo Gamers". O bot precisa da permissão `manageRoles`, e o cargo distribuído precisa estar **abaixo** do cargo mais alto do bot.

A rota de cargos de um membro **substitui a lista inteira**, então primeiro lemos quais cargos a pessoa já tem:

```js
// emoji → id do cargo (pegue os ids em GET /groups/:id → group.roles)
const ROLE_BY_EMOJI = { "🎮": "r0l3gam3rs01", "🎵": "r0l3mus1c001" };
const PANEL_MESSAGE_ID = "8c1f..."; // a mensagem do painel, enviada antes pelo bot

async function setRole(groupId, userId, roleId, give) {
  const data = await api("GET", `/groups/${groupId}`);
  const current = data.memberRoles[userId] ?? [];
  const next = give ? [...new Set([...current, roleId])] : current.filter((id) => id !== roleId);
  await api("PUT", `/groups/${groupId}/members/${userId}/roles`, { roleIds: next });
}

client.on("reactionAdd", async (e) => {
  if (e.messageId !== PANEL_MESSAGE_ID || e.userId === client.user.id) return;
  const roleId = ROLE_BY_EMOJI[e.emoji];
  if (roleId) await setRole(e.groupId, e.userId, roleId, true);
});

client.on("reactionRemove", async (e) => {
  if (e.messageId !== PANEL_MESSAGE_ID) return;
  const roleId = ROLE_BY_EMOJI[e.emoji];
  if (roleId) await setRole(e.groupId, e.userId, roleId, false);
});
```

(`api` é qualquer função que faça `fetch` com o token — como o `Rest` do [bot completo](/exemplos/bot-completo).)

::: warning O painel precisa ser "visto" pelo bot
Para comparar reações, o bot precisa ter o estado da mensagem do painel. Se ele reiniciar, o estado some e o primeiro `group-message-reactions` do painel não gera `reactionAdd`. Solução: guarde o `id` e o `ts` do painel e, ao iniciar, busque a mensagem e use as reações dela como estado inicial:

```js
client.on("ready", async () => {
  const panel = await client.fetchMessage(GROUP_ID, CHANNEL_ID, PANEL_MESSAGE_ID, PANEL_TS);
  if (panel) client.trackReactions(panel);
});
```
:::

## Próximo passo

A aplicação mais famosa de reações: [páginas por reação](./paginas-por-reacao).
