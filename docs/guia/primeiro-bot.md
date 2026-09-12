# Seu primeiro bot

Vamos fazer o "olá mundo" dos bots: quando alguém escrever `!ping` numa sala, o bot responde `Pong! 🏓`.

## 1. Prepare a pasta

```bash
mkdir meu-bot
cd meu-bot
npm init -y
npm install ws
```

A biblioteca [`ws`](https://github.com/websockets/ws) cuida do WebSocket. Para as requisições HTTP usamos o `fetch`, que já vem no Node.

No `package.json`, adicione `"type": "module"` para poder usar `import`:

```json
{
  "name": "meu-bot",
  "type": "module",
  "dependencies": {
    "ws": "^8.18.0"
  }
}
```

Crie o arquivo `.env` com o token do bot ([veja como pegar](./criando-um-bot)):

```ini
GOLIVE_TOKEN=Bot cole-o-token-aqui
```

## 2. O código

Crie `index.js`:

<<< @/../examples/ping-pong/index.js

## 3. Rode

```bash
node --env-file=.env index.js
```

Deve aparecer:

```
Conectado como Meu Bot (@meu_bot)
```

## 4. Teste

O bot só vê as salas dos grupos em que está. Se ele ainda não está em nenhum, [coloque-o num grupo](./entrando-em-grupos) — leva um minuto.

Depois, escreva `!ping` numa sala de texto do grupo. O bot responde citando a sua mensagem. 🎉

## O que aconteceu, passo a passo

**1. `GET /auth/me`** — confere o token e descobre o nome do bot. Se o token estiver errado, o programa para aqui com uma mensagem clara, em vez de falhar misteriosamente depois.

**2. `new WebSocket(GATEWAY)` + `register`** — abre a conexão em tempo real e se identifica. A partir da resposta `registered`, o GoLive começa a mandar eventos.

**3. `group-message`** — é o evento de "chegou mensagem numa sala de texto". Ele traz:

```js
{
  type: "group-message",
  message: {
    id: "8c1f...",          // id da mensagem
    groupId: "k2x9d0a1b3",  // em qual grupo
    channelId: "q7w3e5r9t1y2", // em qual sala
    from: "a41c...",        // id de quem escreveu
    text: "!ping",
    ts: 1757700000000       // quando (milissegundos)
  },
  author: { id: "a41c...", name: "Maria", bot: false, /* ... */ }
}
```

**4. `if (author.bot) return`** — o bot recebe **as próprias mensagens** também (e as de outros bots). Sem essa linha, dois bots podem ficar se respondendo para sempre.

**5. `POST /groups/:id/channels/:cid/messages`** — responde. O `replyTo` faz a resposta aparecer citando a mensagem original, e o `userId` dentro dele notifica quem perguntou.

## O que falta para um bot "de verdade"

Este exemplo é propositalmente mínimo. Um bot que fica ligado dias precisa de:

- **Reconexão** quando a internet ou o servidor cair → [Conexão em tempo real](./gateway#reconectando).
- **Tratamento de erros** e de limite de requisições (`429`) → [Limites e boas práticas](./boas-praticas).
- **Um sistema de comandos** em vez de `if`s → [Criando comandos](./comandos).

Tudo isso já está pronto no [bot completo](/exemplos/bot-completo).
