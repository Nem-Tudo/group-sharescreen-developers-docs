# Organizando um bot grande

Um bot de 30 linhas cabe num arquivo. Um bot com comandos, páginas, moderação e DMs, não. Esta página mostra a organização do [bot completo](/exemplos/bot-completo) — use como ponto de partida.

## A estrutura

```
bot-completo/
├─ .env                    ← o token (fora do Git)
├─ package.json
├─ scripts/
│  └─ entrar-no-grupo.js   ← aceita um convite
└─ src/
   ├─ index.js             ← liga tudo: cliente, comandos, eventos
   ├─ golive/              ← falar com o GoLive (reutilizável em qualquer bot)
   │  ├─ rest.js           ← HTTP: token, JSON, 429, repetição
   │  ├─ gateway.js        ← WebSocket: register, heartbeat, reconexão
   │  ├─ client.js         ← junta os dois e cria eventos amigáveis
   │  ├─ structures.js     ← GroupMessage/DirectMessage com .reply(), .react()...
   │  └─ permissions.js    ← "fulano pode X?"
   ├─ lib/                 ← recursos do bot
   │  ├─ commands.js       ← sistema de comandos
   │  └─ paginator.js      ← páginas por reação
   └─ commands/            ← um arquivo por comando
      ├─ ping.js
      ├─ ajuda.js
      └─ ...
```

A ideia é separar **camadas**:

| Camada | Sabe de... | Não sabe de... |
|---|---|---|
| `golive/` | HTTP, WebSocket, formato dos eventos | comandos, regras do seu bot |
| `lib/` | como um comando ou paginador funciona | quais comandos existem |
| `commands/` | o que cada comando faz | detalhes de HTTP e WebSocket |
| `index.js` | como ligar as peças | detalhes de cada peça |

Assim, trocar a forma de reconectar não mexe em nenhum comando, e criar um comando não exige entender o WebSocket.

## O cliente: eventos amigáveis

O `GoLiveClient` transforma os eventos crus em eventos prontos para usar:

| Evento do cliente | Vem de | O que entrega |
|---|---|---|
| `ready` / `reconnected` | `registered` | a conta do bot |
| `messageCreate` | `group-message` | um `GroupMessage` com `.reply()`, `.send()`, `.react()`, `.delete()` |
| `messageDelete` | `group-message-deleted` | `{ groupId, channelId, messageId }` |
| `reactionAdd` / `reactionRemove` | `group-message-reactions` + diff | `{ messageId, emoji, userId, ... }` |
| `reactionUpdate` | `group-message-reactions` | o estado completo |
| `typing` | `group-typing` | quem está digitando |
| `directMessage` | `dm` (só as recebidas) | um `DirectMessage` com `.reply()` |
| `groupUpdate` / `groupRemove` | `group-updated` / `group-removed` | o grupo (e o motivo) |
| `raw` | tudo | o evento como veio |

<<< @/../examples/bot-completo/src/golive/client.js

## Os objetos com atalhos

Em vez de montar o `replyTo` à mão toda vez, a mensagem sabe responder a si mesma:

<<< @/../examples/bot-completo/src/golive/structures.js

## O `index.js`

Fica curto — só liga as peças:

<<< @/../examples/bot-completo/src/index.js

## Guardando dados

Pontos, avisos, configurações por grupo — isso precisa sobreviver a um reinício. Por ordem de complexidade:

1. **Um arquivo JSON** — suficiente para bots pequenos:

   ```js
   import { readFile, writeFile } from "node:fs/promises";

   const FILE = "./dados.json";
   let db = {};
   try { db = JSON.parse(await readFile(FILE, "utf8")); } catch {}

   export const get = (key, fallback) => db[key] ?? fallback;
   export async function set(key, value) {
     db[key] = value;
     await writeFile(FILE, JSON.stringify(db, null, 2));
   }
   ```

2. **SQLite** (`node:sqlite`, embutido no Node 22+) — para consultas e rankings.
3. **Um banco de verdade** (PostgreSQL, MongoDB) — quando o bot roda em várias máquinas.

Guarde dados **por grupo** (`db[groupId].prefixo`), já que o mesmo bot atende vários grupos.
