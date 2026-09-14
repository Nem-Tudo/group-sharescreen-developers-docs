# Salas ao vivo (experimental)

As salas ao vivo são as salas de transmissão de tela do GoLive — `golive.nemtudo.me/watch/<nome>`. Um bot pode entrar numa delas e **participar do chat**: ler, responder e dar boas-vindas.

::: warning Experimental
O chat das salas ao vivo foi feito para pessoas num navegador, não para bots. Funciona, mas:

- Bots **não passam** pela verificação anti-robô (captcha) para entrar em salas — ela é só para pessoas.
- O bot aparece na lista de participantes (com a etiqueta BOT).
- O protocolo pode mudar sem aviso. Para bots, os **grupos** são o lugar certo.
:::

Tudo aqui acontece pelo **WebSocket**, depois do [`register`](./gateway#conectando-e-se-registrando).

## Entrando numa sala

```js
ws.send(JSON.stringify({ type: "join", room: "sala-do-joao" }));
```

- `room` é o nome da sala na URL: 1 a 32 caracteres `a-z A-Z 0-9 _ -`.
- Salas privadas têm o código no nome: `priv-familia-123456`.
- Entrar numa sala que não existe **cria** a sala. Confira antes com <span class="http get">GET</span> `/rooms/:handle/exists`, ou escolha uma da lista pública <span class="http get">GET</span> `/rooms`.

Deu certo, chega o estado da sala:

```js
{
  type: "room-state",
  room: "sala-do-joao",
  created: false,           // true se o join criou a sala
  selfId: "c0nn...",        // o id desta conexão na sala
  selfUserId: "f3a9...",
  peers: [                  // quem já está lá
    { id: "c0nn2...", name: "João", userId: "a41c...", isGuest: false, bot: false,
      flags: [], mic: true, sharing: true, screen: true, camera: false, avatarUrl: null }
  ],
  messages: [ /* as últimas mensagens do chat (até 300) */ ],
  // ...configurações da sala, vídeos, música
}
```

Deu errado, chega `join-error` (com `reason` e `message`).

## Mensagens do chat

Cada mensagem nova na sala — inclusive as do bot:

```js
{
  type: "chat-message",
  id: "m3ns4g3m",
  from: "c0nn2...",         // id da CONEXÃO de quem enviou
  userId: "a41c...",        // id da conta (ou "guest:...")
  name: "João",
  isGuest: false,
  bot: false,
  flags: [],
  text: "boa noite!",
  kind: "text",             // ou "gif", com `url`
  replyTo: null,
  ts: 1757700000000
}
```

## Enviando no chat

```js
ws.send(JSON.stringify({ type: "chat", text: "Boa noite, pessoal! 👋" }));

// um GIF
ws.send(JSON.stringify({ type: "chat", kind: "gif", url: "https://media.giphy.com/media/.../giphy.gif" }));

// respondendo
ws.send(JSON.stringify({
  type: "chat",
  text: "Bem-vindo!",
  replyTo: { id: msg.id, name: msg.name, text: msg.text.slice(0, 200) },
}));
```

Até **500** caracteres. Limite: **15 mensagens a cada 5 segundos**. Ao passar, chega `chat-blocked` — e passar dos limites repetidamente [bane o IP](/referencia/limites#limites-do-websocket).

Outras respostas possíveis: `chat-blocked` (palavra bloqueada) e `room-permission-denied` (a sala desligou o chat ou os GIFs).

## Outros eventos da sala

| Evento | Quando |
|---|---|
| `peer-joined` | Alguém entrou (mesmos campos de um item de `peers`). |
| `peer-left` | `{ id }` saiu. |
| `peer-renamed` | Alguém mudou de nome. |
| `peer-typing` | `{ id, typing }`. |
| `peer-mic`, `peer-sharing`, `peer-presence` | Microfone, transmissão e presença de alguém. |
| `room-settings` | Dono, administradores ou permissões da sala mudaram. |
| `room-removed` | O bot foi expulso/banido da sala. |
| `signal` | Negociação de vídeo (WebRTC) — **ignore**. |
| `video-source-*`, `music*`, `time-sync` | Vídeos e música da sala — ignore. |

## Saindo

```js
ws.send(JSON.stringify({ type: "leave" }));
```

Uma conexão fica em uma sala por vez: um `join` em outra sala sai da atual.

## Exemplo: bot de boas-vindas

```js
const ROOM = "sala-do-joao";

ws.on("message", (data) => {
  const event = JSON.parse(data.toString());

  if (event.type === "registered") {
    ws.send(JSON.stringify({ type: "join", room: ROOM }));
  }

  if (event.type === "join-error") {
    console.error("Não consegui entrar:", event.message);
  }

  if (event.type === "peer-joined" && !event.bot) {
    ws.send(JSON.stringify({ type: "chat", text: `Bem-vindo(a), ${event.name}! 🎉` }));
  }

  if (event.type === "chat-message" && !event.bot && event.text === "!regras") {
    ws.send(JSON.stringify({ type: "chat", text: "📜 Respeito acima de tudo. Sem spam." }));
  }
});
```

::: tip Reconexão
Ao reconectar, o bot volta como uma conexão nova e fora de qualquer sala: mande o `join` de novo depois do `registered`.
:::
