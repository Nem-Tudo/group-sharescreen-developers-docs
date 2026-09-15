# Webhooks

Um webhook é um endereço que posta mensagens numa sala. Quem tem o endereço faz um `POST` e a mensagem aparece, com o nome e a foto do webhook. Não precisa de bot, de token nem de conexão: serve para avisos de deploy, alertas de monitoramento, novos vídeos, e qualquer coisa que só precise **falar** na sala.

Funciona como o webhook do Discord. Uma integração feita para um webhook de lá funciona apontada para cá, trocando só o endereço.

## Criando um webhook

Nas configurações da sala (texto ou voz), abra a aba **Webhooks** e clique em **Novo webhook**. Dá para trocar o nome e a foto, mover o webhook para outra sala, copiar o endereço, gerar um novo endereço e apagar o webhook.

É preciso a permissão **Gerenciar webhooks** (`manageWebhooks`) e conseguir ver a sala. Cada sala tem até **15** webhooks.

O endereço tem este formato:

```
https://apigolive.nemtudo.me/webhooks/<id>/<token>
```

::: danger O endereço é a senha
Qualquer pessoa com o endereço posta na sala. Não o coloque em código público. Se ele vazar, use **Gerar novo endereço**: o antigo para de funcionar na hora.
:::

## Postando

<span class="http post">POST</span> `/webhooks/:id/:token`

```js
await fetch(process.env.GOLIVE_WEBHOOK, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ content: "Deploy concluído ✅" }),
});
```

| Campo | Tipo | Descrição |
|---|---|---|
| `content` | string | O texto, com [markdown](./enviando-mensagens#formatacao). Até 2000 caracteres numa sala de texto. `text` também é aceito. |
| `username` | string | Um nome só para esta mensagem, no lugar do nome do webhook. |
| `embeds` | objeto[] | Até 10 [embeds](./enviando-mensagens#embeds). |
| `images` | string[] | Até 3 fotos, cada uma como [data URL](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/data) (`data:image/png;base64,...`). PNG, JPEG, WebP, GIF ou AVIF, até 5 MB cada e 8 MB juntas. |
| `files` | objeto[] | Até 5 arquivos (qualquer tipo, exceto executáveis): `{ name, data }`, com `data` também em data URL. Até 8 MB cada e 15 MB juntos. |

A mensagem precisa de `content`, `embeds`, `images` ou `files` — pelo menos um. A resposta é `204` sem corpo. Com `?wait=true`, é `200` com a mensagem no formato do Discord (`id`, `content`, `channel_id`, `webhook_id`, `timestamp`, `author`).

```js
await fetch(process.env.GOLIVE_WEBHOOK, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    content: "Relatório do dia 📎",
    files: [{ name: "relatorio.pdf", data: "data:application/pdf;base64,..." }],
  }),
});
```

Não são aceitos nesta rota: `avatar_url` por mensagem (a foto é sempre a atual do webhook — para trocá-la, veja a seção abaixo), menções (um webhook não notifica ninguém pelo nome) e threads.

### Salas de voz

O chat de uma sala de voz só existe durante a chamada. Com a sala vazia, o webhook responde `409` e a mensagem não é guardada.

## Erros

| Código | Quando |
|---|---|
| `400` | Mensagem vazia (`code: 50006`), texto recusado, `images`/`files` inválidos, tipo de arquivo bloqueado ou mais itens do que o limite. |
| `404` | Endereço errado, webhook apagado ou token antigo (`code: 10015`). |
| `409` | Sala de voz sem ninguém. |
| `413` | Foto ou arquivo grande demais, ou o total da mensagem passou do limite. |
| `423` | Grupo suspenso. |
| `429` | Rápido demais: até **5 mensagens a cada 2 segundos** por webhook. O corpo traz `retry_after` em segundos, e o cabeçalho `Retry-After` também. |
| `502` | Falha ao enviar a foto ou o arquivo para o CDN — tente de novo. |
| `503` | Envio de fotos/arquivos não está disponível neste servidor (CDN não configurado). |

## Como a mensagem aparece para bots

Ela chega pelo WebSocket como qualquer `group-message`, mas:

- `message.from` e `author.id` são `"webhook:<id>"`, e não uma conta. Não dá para abrir perfil, mandar DM ou dar cargo.
- `author.webhook` é `true` e `author.bot` é `false`.
- `message.webhook` é `{ id, avatarUrl }`: a foto no momento em que a mensagem foi postada.
- `message.images` (fotos) e `message.attachments` (demais arquivos, com `url`, `name`, `size`, `type`, `kind`) aparecem como em qualquer mensagem, quando o `POST` os incluiu.

Para um bot ignorar webhooks:

```js
if (author.webhook) return;
```

## Trocando o nome e a foto pelo próprio endereço

Quem só tem o endereço do webhook — sem login no grupo — ainda pode trocar o nome e a foto que ele usa. É o mesmo endereço que posta mensagens, só que com `PATCH` em vez de `POST`:

<span class="http patch">PATCH</span> `/webhooks/:id/:token`

```js
await fetch(process.env.GOLIVE_WEBHOOK, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Deploy Bot",
    avatar: "data:image/png;base64,...", // ou null para tirar a foto
  }),
});
```

| Campo | Tipo | Descrição |
|---|---|---|
| `name` | string | O novo nome do webhook. |
| `avatar` | string \| null | A nova foto, como [data URL](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Schemes/data). `null` tira a foto atual. |

Os dois campos são opcionais — manda só o que quiser trocar. A resposta é `200` com `{ id, name, avatar, channel_id }`. Trocar a sala do webhook e gerar um novo endereço continuam exigindo `manageWebhooks` e login (veja a próxima seção), porque envolvem escolher uma sala do grupo ou revelar o novo endereço a alguém.

## Gerenciando pela API

As mesmas ações da aba Webhooks existem como rotas. Todas exigem `manageWebhooks`:

| Método | Rota | O que faz |
|---|---|---|
| <span class="http get">GET</span> | `/groups/:id/webhooks` | Lista os webhooks das salas que você vê. |
| <span class="http post">POST</span> | `/groups/:id/channels/:cid/webhooks` | Cria um (`{ name }`). |
| <span class="http patch">PATCH</span> | `/groups/:id/webhooks/:wid` | Renomeia (`{ name }`) ou move (`{ channelId }`). |
| <span class="http post">POST</span> | `/groups/:id/webhooks/:wid/avatar` | Troca a foto (`{ image: dataURL }`). |
| <span class="http delete">DELETE</span> | `/groups/:id/webhooks/:wid/avatar` | Tira a foto. |
| <span class="http post">POST</span> | `/groups/:id/webhooks/:wid/token` | Gera um novo endereço. |
| <span class="http delete">DELETE</span> | `/groups/:id/webhooks/:wid` | Apaga. |

Cada rota responde `{ webhook }`:

```ts
{
  id: string
  channelId: string
  name: string
  avatarUrl: string | null
  token: string               // o endereço é /webhooks/<id>/<token>
  createdAt: number
  createdBy: { id: string, name: string }
}
```
