# Respondendo mensagens

Responder é juntar as duas metades: **ouvir** `group-message` no WebSocket e **agir** com `POST .../messages`.

## O evento `group-message`

```js
{
  type: "group-message",
  message: {
    id: "8c1f2d3e-...",
    groupId: "k2x9d0a1b3",
    channelId: "q7w3e5r9t1y2",
    from: "a41c...",
    fromName: "Maria",
    text: "alguém sabe que horas começa?",
    kind: "text",                 // "text" | "image" | "gif"
    images: ["https://..."],      // só quando tem imagens
    url: "https://...giphy...",   // só quando é GIF
    replyTo: { /* ... */ },       // só quando é uma resposta
    mentions: ["f3a9..."],        // quem foi notificado
    ts: 1757700000000
  },
  author: {
    id: "a41c...",
    name: "Maria",
    username: "maria",            // null para convidados
    avatarUrl: "https://...",
    nameColor: "#ff5500",
    flags: [],
    bot: false,
    guest: false
  },
  mentioned: { /* id → pessoa, para cada <@id> do texto */ }
}
```

## Regra de ouro: ignore bots

O bot recebe **as próprias mensagens** e as de outros bots. Sempre filtre:

```js
if (event.author.bot) return;              // outros bots e ele mesmo
// ou, para ignorar só a si mesmo:
if (event.author.id === me.id) return;
```

Sem isso, basta o bot responder algo que contenha o gatilho — ou dois bots se responderem — para criar um loop infinito que termina em limite de requisições.

## Respondendo com citação

O campo `replyTo` faz a resposta aparecer com a mensagem original citada em cima. Ele é uma **cópia** do essencial da mensagem citada:

| Campo | Descrição |
|---|---|
| `id` | Id da mensagem respondida (obrigatório). |
| `name` | Nome de quem escreveu (obrigatório). |
| `text` | O texto (cortado em 200 caracteres). |
| `kind` | `"text"`, `"image"` ou `"gif"`. |
| `images` | As imagens dela, se houver. |
| `userId` | Id do autor. **Com ele, o autor é notificado** da resposta. |

```js
async function reply(event, text, { notify = true } = {}) {
  const { message, author } = event;
  return sendMessage(message.groupId, message.channelId, {
    text,
    replyTo: {
      id: message.id,
      name: author.name,
      text: message.text.slice(0, 200),
      kind: message.kind,
      ...(notify ? { userId: author.id } : {}),
    },
  });
}
```

Deixe `userId` de fora para responder sem notificar — bom para respostas automáticas frequentes.

## Exemplo: respostas automáticas

Um bot que reage a palavras-chave:

```js
const TRIGGERS = [
  { match: /\bbom dia\b/i, answer: "Bom dia! ☀️" },
  { match: /\bque horas?\b.*\bcome[cç]a\b/i, answer: "O evento começa às 20h 🕗" },
  { match: /\bregras\b/i, answer: "As regras estão fixadas na sala #regras 📜" },
];

ws.on("message", async (data) => {
  const event = JSON.parse(data.toString());
  if (event.type !== "group-message" || event.author.bot) return;

  const trigger = TRIGGERS.find((t) => t.match.test(event.message.text));
  if (trigger) await reply(event, trigger.answer, { notify: false });
});
```

## Quando o bot é mencionado

Uma menção chega no texto como `<@id-do-bot>`:

```js
const mentionsMe = (text) => text.includes(`<@${me.id}>`);

if (mentionsMe(event.message.text)) {
  await reply(event, `Oi, ${event.author.name}! Digite !ajuda para ver meus comandos.`);
}
```

Além do `group-message`, uma menção (ou uma resposta a uma mensagem do bot) também gera um `group-notify` para o bot — útil se você só quer saber de menções:

```js
{
  type: "group-notify",
  groupId: "k2x9d0a1b3",
  channelId: "q7w3e5r9t1y2",
  messageId: "8c1f...",
  title: "Maria in #geral · Meu Grupo",
  body: "@DJ do Grupo toca a próxima?",
  url: "/groups/k2x9d0a1b3/q7w3e5r9t1y2"
}
```

## Respondendo a respostas

Quando alguém responde a uma mensagem do bot, o `replyTo.userId` é o id do bot:

```js
if (event.message.replyTo?.userId === me.id) {
  // alguém respondeu ao bot — continue a conversa
}
```

Isso permite fluxos de "pergunta e resposta" sem comandos: o bot pergunta, a pessoa responde citando.

## Esperando uma resposta

Um padrão comum: o bot faz uma pergunta e espera a próxima mensagem **daquela pessoa naquela sala**.

```js
function awaitReply(ws, { channelId, userId, timeout = 30_000 }) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { ws.off("message", listener); resolve(null); }, timeout);
    function listener(data) {
      const event = JSON.parse(data.toString());
      if (event.type !== "group-message") return;
      if (event.message.channelId !== channelId || event.author.id !== userId) return;
      clearTimeout(timer);
      ws.off("message", listener);
      resolve(event);
    }
    ws.on("message", listener);
  });
}

await reply(event, "Qual é a sua cor favorita?");
const answer = await awaitReply(ws, { channelId: event.message.channelId, userId: event.author.id });
await reply(event, answer ? `${answer.message.text}? Ótima escolha! 🎨` : "Demorou demais 😴");
```

## Mensagens apagadas

```js
{ type: "group-message-deleted", groupId: "k2x9d0a1b3", channelId: "q7w3e5r9t1y2", messageId: "8c1f..." }
```

O evento não diz quem apagou nem o conteúdo. Um bot de logs que queira registrar o que foi apagado precisa guardar as mensagens quando elas chegam.

## Próximo passo

Quando as respostas passam de meia dúzia, `if`s viram bagunça — é hora de um [sistema de comandos](./comandos).
