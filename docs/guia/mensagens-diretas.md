# Mensagens diretas (DM)

Um bot pode conversar em particular com qualquer conta do GoLive — não precisa ser amigo. Só não consegue falar com convidados (quem não tem conta) nem com quem bloqueou o bot.

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
| <span class="http post">POST</span> `/dm/:userId/read` | Marca a conversa como lida. |

```js
const { conversations, unread } = await fetch(`${API}/dm`, { headers: { Authorization: TOKEN } })
  .then((r) => r.json());
// conversations: [{ user: { id, username, displayName, ... }, lastMessage: {...}, unread: 2 }]
```

## Erros

| Status | Significado |
|---|---|
| `404 User not found.` | A conta não existe **ou** um dos dois bloqueou o outro (a API dá a mesma resposta de propósito). |
| `400 You cannot message yourself.` | O bot tentou mandar DM para si mesmo. |
| `400 Empty message.` | Faltou `text`, `images` ou `url`. |
| `429` | Limite de **60 DMs por minuto**. |

::: danger Não faça spam de DM
Mandar DM para quem não pediu (divulgação, "boas-vindas" em massa) é o jeito mais rápido de o bot ser bloqueado e banido. Mande DM só como resposta a algo que a pessoa fez.
:::
