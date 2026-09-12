# Enviando mensagens

<span class="http post">POST</span> `/groups/:groupId/channels/:channelId/messages`

```js
const API = "https://apigolive.nemtudo.me";
const TOKEN = process.env.GOLIVE_TOKEN;

async function sendMessage(groupId, channelId, body) {
  const res = await fetch(`${API}/groups/${groupId}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${data.error}`);
  return data.message;
}

await sendMessage("k2x9d0a1b3", "q7w3e5r9t1y2", { text: "Olá, grupo! 👋" });
```

## O corpo da mensagem

| Campo | Tipo | Descrição |
|---|---|---|
| `text` | string | O texto. Até **2000** caracteres. Quebras de linha com `\n`. |
| `images` | string[] | Até **3** imagens como *data URL* (`data:image/png;base64,...`). |
| `url` | string | Um GIF do Giphy (`https://*.giphy.com/...`). |
| `replyTo` | objeto | A mensagem que está sendo respondida. Veja [Respondendo mensagens](./respondendo-mensagens). |
| `mentions` | string[] | Para mencionar `@everyone` ou cargos (veja abaixo). |
| `nonce` | string | Um identificador seu para a mensagem (8 a 64 caracteres `A-Z a-z 0-9 _ -`). Evita duplicar ao tentar de novo. |

Uma mensagem precisa de pelo menos um entre `text`, `images` e `url`. Com imagens, o `text` vira a legenda.

A resposta:

```js
{
  message: {
    id: "8c1f2d3e-...",
    groupId: "k2x9d0a1b3",
    channelId: "q7w3e5r9t1y2",
    from: "f3a9c1e2-...",       // o id do bot
    fromName: "DJ do Grupo",
    text: "Olá, grupo! 👋",
    kind: "text",               // "text" | "image" | "gif"
    ts: 1757700000000
  },
  author: { id: "f3a9c1e2-...", name: "DJ do Grupo", bot: true, /* ... */ }
}
```

A mensagem também chega pelo WebSocket como `group-message` — para todo mundo na sala, **inclusive para o próprio bot**.

## Formatação

O texto é mostrado **como está**: não há markdown (`**negrito**` aparece com os asteriscos). O que o GoLive transforma:

- **Links** (`https://...` e `www....`) viram clicáveis.
- **Emoji** aparecem normalmente — use à vontade.
- **Menções** e **salas**, com os tokens abaixo.

## Menções

### Mencionar uma pessoa: `<@id>`

Escreva `<@` + o id da conta + `>`. Na tela aparece `@Nome`, e a pessoa é notificada.

```js
await sendMessage(groupId, channelId, {
  text: `Bem-vinda, <@${userId}>! Leia as regras em <#${rulesChannelId}>.`,
});
```

O id é o `author.id` de uma mensagem, o `id` de um membro em `GET /groups/:id/members`, ou o `account.id` de `GET /users/:usuario`.

Para a menção notificar, o bot precisa da permissão `mentionMembers` na sala (o padrão é ter) e a pessoa precisa conseguir ver a sala. Sem a permissão, a mensagem vai do mesmo jeito — só não notifica ninguém.

### Apontar para uma sala: `<#id>`

`<#q7w3e5r9t1y2>` aparece como um link `#nome-da-sala`.

### `@everyone` e cargos

Esses vão no campo `mentions`, e o texto deve conter o nome para ele ser destacado:

```js
// @everyone — exige a permissão mentionEveryone (desligada por padrão)
await sendMessage(groupId, channelId, {
  text: "@everyone o evento começa em 10 minutos!",
  mentions: ["@everyone"],
});

// Um cargo — o cargo precisa estar marcado como mencionável,
// ou o bot precisa de mentionEveryone
await sendMessage(groupId, channelId, {
  text: "@Moderação alguém pode dar uma olhada?",
  mentions: [`@role:${roleId}`],
});
```

::: warning Menção é notificação
`@everyone` manda notificação para o celular de todo mundo do grupo. Use com muita parcimônia — é o caminho mais rápido para o bot ser expulso.
:::

## Imagens

Até 3 imagens por mensagem, cada uma com até **5 MB** e todas juntas até **8 MB**. Formatos: PNG, JPEG, WebP, GIF e AVIF (SVG não). O bot precisa da permissão `sendImages`.

```js
import { readFile } from "node:fs/promises";

async function imageToDataUrl(path, mime = "image/png") {
  const bytes = await readFile(path);
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

await sendMessage(groupId, channelId, {
  text: "O gráfico da semana 📈",
  images: [await imageToDataUrl("./grafico.png")],
});
```

As imagens são enviadas para a CDN do GoLive; a mensagem salva traz as URLs em `message.images`.

## GIFs

Só GIFs do Giphy (`https` num domínio `*.giphy.com`). O bot precisa da permissão `sendGifs`.

```js
await sendMessage(groupId, channelId, {
  url: "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
});
```

## Evitando mensagens duplicadas: `nonce`

Se a conexão cair no meio de um envio, você não sabe se a mensagem foi salva. Mande um `nonce` único: ao repetir o envio com **o mesmo nonce** (em até 10 minutos), a API devolve a mensagem já criada em vez de criar outra.

```js
import { randomUUID } from "node:crypto";

const body = { text: "Relatório diário pronto!", nonce: randomUUID() };
try {
  await sendMessage(groupId, channelId, body);
} catch {
  await sendMessage(groupId, channelId, body); // mesmo nonce: sem duplicar
}
```

## "Bot está digitando..."

<span class="http post">POST</span> `/groups/:groupId/channels/:channelId/typing` com `{ "typing": true }`

Útil antes de uma resposta que demora (buscar algo numa API externa, por exemplo). O aviso some sozinho depois de alguns segundos, ou quando a mensagem chega; para tirar antes, mande `{ "typing": false }`.

```js
await fetch(`${API}/groups/${groupId}/channels/${channelId}/typing`, {
  method: "POST",
  headers: { Authorization: TOKEN, "Content-Type": "application/json" },
  body: JSON.stringify({ typing: true }),
});
const answer = await algoDemorado();
await sendMessage(groupId, channelId, { text: answer });
```

## Apagando mensagens

<span class="http delete">DELETE</span> `/groups/:groupId/channels/:channelId/messages/:messageId`

O bot sempre pode apagar as próprias mensagens. Para apagar as dos outros, precisa da permissão `manageMessages`.

```js
await fetch(`${API}/groups/${groupId}/channels/${channelId}/messages/${messageId}`, {
  method: "DELETE",
  headers: { Authorization: TOKEN },
});
```

::: info E editar?
A API **não tem** edição de mensagens. Para "atualizar" o que o bot disse, apague e envie de novo — é assim que funcionam as [páginas por reação](./paginas-por-reacao).
:::

## Lendo o histórico

<span class="http get">GET</span> `/groups/:groupId/channels/:channelId/messages?before=<ts>`

Devolve até **50** mensagens, da mais antiga para a mais nova, anteriores ao instante `before` (em milissegundos). Sem `before`, as 50 mais recentes. Para ir voltando, use o `ts` da mais antiga como o próximo `before`.

```js
async function* history(groupId, channelId) {
  let before;
  while (true) {
    const q = before ? `?before=${before}` : "";
    const res = await fetch(`${API}/groups/${groupId}/channels/${channelId}/messages${q}`, {
      headers: { Authorization: TOKEN },
    });
    const { messages, authors } = await res.json();
    if (messages.length === 0) return;
    for (const m of messages.reverse()) yield { ...m, author: authors[m.from] };
    before = messages.at(-1).ts; // a mais antiga desta página
  }
}

for await (const m of history(groupId, channelId)) {
  console.log(`${m.author?.name}: ${m.text}`);
}
```

O `authors` da resposta é um mapa `id → autor`, com quem escreveu e quem foi mencionado na página.

::: tip Buscando uma mensagem só
Não existe rota para uma mensagem isolada, mas se você sabe o `ts` dela, a página `?before=${ts + 1}` termina exatamente nela: `messages.at(-1)`.
:::

## Erros comuns

| Status | `error` | O que fazer |
|---|---|---|
| `400` | `Empty message.` | Mande `text`, `images` ou `url`. |
| `400` | `Invalid message.` | O texto tem caracteres de controle (só `\n` é permitido). |
| `400` | `Your message contains a blocked word.` | O GoLive filtra algumas palavras. Troque o texto. |
| `400` | `Invalid GIF.` | O `url` não é do Giphy. |
| `403` | `You do not have permission to send messages in this room.` | O bot não pode escrever nessa sala. |
| `404` | `Room not found.` / `Group not found.` | Id errado, ou o bot não vê a sala / não está no grupo. |
| `413` | `Image too large ...` | Imagem acima de 5 MB (ou total acima de 8 MB). |
| `429` | — | Muitas mensagens. Veja [limites](./boas-praticas). |

O limite de envio é de **120 mensagens por minuto** (por IP).
