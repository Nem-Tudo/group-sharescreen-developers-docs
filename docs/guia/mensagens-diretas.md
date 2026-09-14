# Mensagens diretas (DM)

Um bot conversa em particular com contas do GoLive — não precisa ser amigo. Mas, diferente de uma pessoa, **um bot só puxa conversa** com:

- quem **divide um grupo** com o bot, ou
- quem **já mandou uma DM** para o bot antes.

Para qualquer outra conta, a API responde `403` com `reason: "bot_dm_not_allowed"`. É o que impede um bot de mandar mensagem para o site inteiro num loop. Responder a quem escreveu primeiro sempre funciona.

O bot também não consegue falar com convidados (quem não tem conta) nem com quem bloqueou o bot.

## Enviando uma DM

<span class="http post">POST</span> `/dm/:userId`

O `:userId` é o **id da conta** (não o @usuário).

```js
const API = "https://apigolive.nemtudo.me";
const TOKEN = process.env.GOLIVE_TOKEN;

async function sendDM(userId, body) {
  const res = await fetch(`${API}/dm/${userId}`, {
    method: "POST",
    headers: { Authorization: TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(typeof body === "string" ? { text: body } : body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${data.error}`);
  return data.message;
}

await sendDM("a41c...", "Oi! Seu lembrete: a live começa em 5 minutos ⏰");
```

O corpo aceita os mesmos campos de uma mensagem de grupo — `text` (até 2000), `images`, `url` (GIF) e `replyTo` — menos `mentions` e `nonce`. O `replyTo` de uma DM tem `id`, `name`, `text`, `kind` e `images`.

### Do @usuário para o id

```js
const { account } = await fetch(`${API}/users/maria`).then((r) => r.json());
await sendDM(account.id, "Oi, Maria!");
```

<span class="http get">GET</span> `/users/:usuarioOuId` é público e aceita tanto o `@usuário` (sem o @) quanto o id.

## Recebendo DMs

Toda DM — **recebida ou enviada pelo bot** — chega no WebSocket como `dm`:

```js
{
  type: "dm",
  message: {
    id: "d1e2...",
    conversationId: "...",
    from: "a41c...",     // quem enviou
    to: "f3a9...",       // quem recebeu
    text: "oi bot",
    kind: "text",
    ts: 1757700000000
  },
  fromUser: {
    id: "a41c...",
    username: "maria",
    displayName: "Maria",
    avatarUrl: "https://...",
    nameColor: null,
    flags: [],
    bot: false
  }
}
```

Como as enviadas pelo próprio bot também chegam, filtre:

```js
ws.on("message", async (data) => {
  const event = JSON.parse(data.toString());
  if (event.type !== "dm") return;
  if (event.message.from === me.id) return; // foi o bot que mandou
  if (event.fromUser.bot) return;           // não converse com outros bots

  await sendDM(event.fromUser.id, {
    text: `Você disse: ${event.message.text}`,
    replyTo: {
      id: event.message.id,
      name: event.fromUser.displayName,
      text: event.message.text.slice(0, 200),
    },
  });
});
```

## Exemplo: comando que responde por DM

Algumas respostas não devem ir para a sala inteira. Um `!lembrete` que manda o aviso no privado:

```js
// !lembrete 10 tomar água
if (command === "lembrete") {
  const minutes = Number(args[0]);
  const what = args.slice(1).join(" ");
  if (!minutes || !what) return reply(event, "Uso: !lembrete <minutos> <o quê>");

  await reply(event, `Combinado! Te lembro por DM em ${minutes} min ⏰`);
  setTimeout(() => {
    sendDM(event.author.id, `⏰ Lembrete: ${what}`).catch(console.error);
  }, minutes * 60_000);
}
```

::: warning Timers somem se o bot reiniciar
`setTimeout` vive na memória. Para lembretes que precisam sobreviver a um reinício, guarde-os num arquivo ou banco de dados e reagende ao iniciar.
:::

## Conversas e histórico

| Rota | O que faz |
|---|---|
| <span class="http get">GET</span> `/dm` | Todas as conversas do bot, com a última mensagem e quantas não lidas. |
| <span class="http get">GET</span> `/dm/:userId?before=<ts>` | O histórico com uma pessoa, 50 por vez (`before` volta no tempo). |
| <span class="http post">POST</span> `/dm/:userId/read` | Marca a conversa como lida (e avisa "visto" ao outro lado, se os dois compartilham). |

```js
const { conversations, unread } = await fetch(`${API}/dm`, { headers: { Authorization: TOKEN } })
  .then((r) => r.json());
// conversations: [{ user: { id, username, displayName, ... }, lastMessage: {...}, unread: 2 }]
```

O `GET /dm/:userId` também devolve `seenTs`: até quando a outra pessoa leu a conversa, ou `null` se isso não é compartilhado (veja [Visto](#visto)).

## Digitando

<span class="http post">POST</span> `/dm/:userId/typing` com `{ "typing": true }` mostra "digitando…" para a pessoa; `{ "typing": false }` apaga. Um `true` sem o `false` depois expira sozinho em alguns segundos, então repita a cada ~5 s enquanto o bot "pensa".

```js
async function typingDM(userId, typing = true) {
  await fetch(`${API}/dm/${userId}/typing`, {
    method: "POST",
    headers: { Authorization: TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ typing }),
  });
}
```

Quando alguém digita para o bot, chega `dm-typing`:

```js
{ type: "dm-typing", from: "a41c...", typing: true }
```

## Reações

Qualquer um dos dois pode reagir a qualquer mensagem da conversa — com emoji padrão, como nos grupos.

<span class="http post">POST</span> `/dm/:userId/messages/:messageId/reactions` com `{ "emoji": "👍" }` (ou `"on": false` para tirar).

```js
await fetch(`${API}/dm/${event.fromUser.id}/messages/${event.message.id}/reactions`, {
  method: "POST",
  headers: { Authorization: TOKEN, "Content-Type": "application/json" },
  body: JSON.stringify({ emoji: "👀" }),
});
```

Os dois lados recebem `dm-reactions` com o **estado completo** das reações:

```js
{ type: "dm-reactions", messageId: "d1e2...", from: "a41c...", to: "f3a9...", reactions: [ { emoji: "👀", users: ["f3a9..."] } ] }
```

No máximo **12 emojis diferentes** por mensagem.

## Editando e apagando

O bot pode editar e apagar as **próprias** mensagens. As da outra pessoa, não.

| Rota | O que faz |
|---|---|
| <span class="http patch">PATCH</span> `/dm/:userId/messages/:messageId` | Troca o texto (`{ "text": "..." }`). Não notifica ninguém. |
| <span class="http delete">DELETE</span> `/dm/:userId/messages/:messageId` | Apaga a mensagem para os dois lados. |

```js
// "Pensando..." e depois a resposta, na mesma mensagem.
const message = await sendDM(userId, "Pensando…");
await fetch(`${API}/dm/${userId}/messages/${message.id}`, {
  method: "PATCH",
  headers: { Authorization: TOKEN, "Content-Type": "application/json" },
  body: JSON.stringify({ text: "Pronto! Aqui está o resultado." }),
});
```

Os dois lados recebem `dm-edited` (com a mensagem como ficou) ou `dm-deleted`:

```js
{ type: "dm-deleted", messageId: "d1e2...", from: "f3a9...", to: "a41c..." }
```

A outra pessoa também pode editar ou apagar as mensagens dela, então os mesmos eventos chegam quando é ela quem muda algo. Se o bot guarda as mensagens recebidas, atualize ou descarte a cópia.

## Visto

Quando alguém marca como lida uma conversa com o bot, o bot recebe:

```js
{ type: "dm-seen", by: "a41c...", ts: 1757700000000 }
```

Tudo que o bot enviou até `ts` foi lido. Só chega se **os dois lados** compartilham confirmações de leitura — é mútuo, como no WhatsApp. A conta liga e desliga em <span class="http get">GET</span>/<span class="http put">PUT</span> `/dm/settings` (`{ "readReceipts": true }`); desligado, ela também deixa de ver quando leem as dela.

## Erros

| Status | Significado |
|---|---|
| `404 User not found.` | A conta não existe **ou** um dos dois bloqueou o outro (a API dá a mesma resposta de propósito). |
| `400 You cannot message yourself.` | O bot tentou mandar DM para si mesmo. |
| `403` `bot_dm_not_allowed` | A pessoa não divide nenhum grupo com o bot e nunca escreveu para ele. |
| `400 Empty message.` | Faltou `text`, `images` ou `url`. |
| `400 Invalid emoji.` | A reação não é exatamente um emoji padrão. |
| `404 Message not found.` | A mensagem não existe, não é dessa conversa, ou há bloqueio. |
| `429` | Limite de **60 DMs por minuto**. |

::: danger Não faça spam de DM
Mandar DM para quem não pediu (divulgação, "boas-vindas" em massa) é o jeito mais rápido de o bot ser bloqueado e banido. Mande DM só como resposta a algo que a pessoa fez.
:::
