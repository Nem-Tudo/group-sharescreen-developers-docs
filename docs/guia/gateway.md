# Conexão em tempo real

A API HTTP serve para **agir**. Para **ficar sabendo** do que acontece — mensagens novas, reações, DMs — o bot mantém uma conexão WebSocket aberta com o GoLive.

```
wss://apigolive.nemtudo.me/ws
```

## O ciclo de vida

```
 Bot                                   GoLive
  │── abre wss://.../ws ─────────────────▶│
  │◀──────────── { type: "welcome" } ─────│
  │── { type: "register", token } ───────▶│
  │◀────────── { type: "registered" } ────│   ← a partir daqui chegam eventos
  │◀──────── { type: "group-message" } ───│
  │◀── { type: "group-message-reactions" }│
  │◀──────────────────── ping ────────────│   (a cada 25 s)
  │── pong ──────────────────────────────▶│   (automático)
  │                  ...                  │
```

Toda mensagem é um objeto JSON com um campo `type`.

## Conectando e se registrando

```js
import WebSocket from "ws";

const ws = new WebSocket("wss://apigolive.nemtudo.me/ws");

ws.on("open", () => {
  ws.send(JSON.stringify({ type: "register", token: process.env.GOLIVE_TOKEN }));
});

ws.on("message", (data) => {
  const event = JSON.parse(data.toString());

  switch (event.type) {
    case "welcome":
      break; // o servidor diz oi; nada a fazer
    case "registered":
      console.log("Pronto para receber eventos");
      break;
    case "register-error":
      console.error("Registro recusado:", event.message);
      break;
    case "group-message":
      console.log(`${event.author.name}: ${event.message.text}`);
      break;
  }
});
```

A resposta de sucesso:

```js
{
  type: "registered",
  id: "c0nn3ct10n-1d",   // id desta CONEXÃO (não é o id da conta)
  name: "DJ do Grupo",
  account: { username: "musica_bot", flags: [], bot: true },
  guestToken: null
}
```

::: tip
O `id` do `registered` identifica a conexão, não o bot. O id da conta vem de [`GET /auth/me`](./autenticacao#conferindo-o-token-e-descobrindo-quem-e-o-bot).
:::

## Heartbeat (ping/pong)

O servidor manda um **ping de WebSocket** a cada 25 segundos. Uma conexão que não responde com pong é derrubada na rodada seguinte.

Você **não precisa fazer nada**: a biblioteca `ws`, o `WebSocket` nativo do Node 22+ e os navegadores respondem o ping sozinhos. Não confunda com mensagens JSON — não existe um `{ type: "ping" }` para responder.

O que vale a pena fazer é o contrário: perceber quando o **servidor** sumiu. Se o bot passar ~60 s sem ouvir nada (nem ping), a conexão morreu sem avisar — derrube e reconecte:

```js
let silenceTimer;
function touch() {
  clearTimeout(silenceTimer);
  silenceTimer = setTimeout(() => ws.terminate(), 60_000);
}
ws.on("open", touch);
ws.on("ping", touch);
ws.on("message", touch);
```

## Reconectando

Conexões caem: a internet oscila, o GoLive é atualizado, o computador dorme. Um bot de verdade reconecta sozinho, esperando um pouco mais a cada tentativa (*backoff exponencial*) e com um pouco de aleatoriedade (*jitter*), para não martelar o servidor:

```js
let attempt = 0;

function connect() {
  const ws = new WebSocket(GATEWAY);

  ws.on("open", () => ws.send(JSON.stringify({ type: "register", token: TOKEN })));

  ws.on("message", (data) => {
    const event = JSON.parse(data.toString());
    if (event.type === "registered") attempt = 0; // deu certo: zera a espera
    handle(event);
  });

  ws.on("close", (code) => {
    if (code === 4003) return console.error("Banido — não reconecte.");
    const delay = Math.min(30_000, 1000 * 2 ** attempt) + Math.random() * 1000;
    attempt += 1;
    console.log(`Caiu (${code}). Tentando de novo em ${Math.round(delay)} ms`);
    setTimeout(connect, delay);
  });

  ws.on("error", () => {}); // o "close" vem logo depois e cuida de reconectar
}

connect();
```

::: warning Não reconecte em loop sem espera
O servidor aceita no máximo **30 aberturas de conexão por minuto por IP**. Um bot que reconecta sem pausa estoura esse limite e passa a ser recusado — o que o faz tentar ainda mais rápido. Sempre espere entre tentativas.
:::

### Quando não reconectar

| Situação | O que fazer |
|---|---|
| Fechou com código `4003` (ou recebeu `{ type: "banned" }`) | A conta ou o IP está banido. Pare. |
| `register-error` **sem** `retryable` (ex.: `"Invalid name."`) | O token é inválido. Pare e confira o token. |
| `register-error` com `retryable: true` | O servidor está iniciando. Mande o `register` de novo em alguns segundos. |

### O que se perde enquanto está desconectado

Os eventos **não são guardados** para quem estava fora: o que aconteceu durante a queda não chega depois. Se o seu bot precisa de tudo (um bot de logs, por exemplo), ao reconectar leia o histórico das salas com [`GET /groups/:id/channels/:cid/messages`](./enviando-mensagens#lendo-o-historico).

## Uma instância só

Cada conexão registrada com o token recebe **todos** os eventos do bot. Se você rodar o bot duas vezes (no seu PC e no servidor, por exemplo), as duas cópias recebem o mesmo `!ping` e as duas respondem.

::: danger Bot respondendo em dobro?
Quase sempre é uma segunda cópia do bot rodando em algum lugar. Pare todas e deixe uma.
:::

## Eventos que um bot recebe

| Evento | Quando |
|---|---|
| `group-message` | Mensagem nova numa sala de texto que o bot vê (inclusive as do próprio bot). |
| `group-message-deleted` | Uma mensagem foi apagada. |
| `group-message-reactions` | As reações de uma mensagem mudaram. |
| `group-typing` | Alguém começou/parou de digitar. |
| `group-notify` | O bot foi mencionado (ou respondido) numa mensagem. |
| `group-updated` | Algo mudou num grupo do bot. |
| `group-removed` | O bot saiu ou foi tirado de um grupo. |
| `dm` | Mensagem direta enviada ou recebida pelo bot. |
| `social-update` | Pedido de amizade, amizade aceita, bloqueio. |

Os formatos completos estão na [referência de eventos](/referencia/eventos). O servidor também manda eventos que um bot pode ignorar (anúncios do site, presença, chamadas) — trate só os `type` que conhece e ignore o resto.

## Mandando coisas pelo WebSocket

Para bots em grupos, o WebSocket é praticamente **só de ida**: além do `register`, tudo o que o bot faz (mandar mensagem, reagir, digitar) vai pela **API HTTP**. A exceção são as [salas ao vivo](./salas-ao-vivo), cujo chat é pelo WebSocket.

Limites da conexão: mensagens de até **64 KB**, e no máximo **10 `register` por minuto**.

## Uma classe completa

Juntando heartbeat, reconexão e os casos de parada — é a que o [bot completo](/exemplos/bot-completo) usa:

<<< @/../examples/bot-completo/src/golive/gateway.js
