# Eventos do WebSocket

Tudo o que trafega em `wss://apigolive.nemtudo.me/ws`. Cada mensagem é um objeto JSON com o campo `type`. Para o ciclo de conexão e reconexão, veja [Conexão em tempo real](/guia/gateway).

## Índice

### Recebidos pelo bot (servidor → bot)

| Evento | Categoria | Quando chega |
|---|---|---|
| [`welcome`](#welcome) | Conexão | Logo ao conectar. |
| [`registered`](#registered) | Conexão | O `register` deu certo. |
| [`register-error`](#register-error) | Conexão | O `register` foi recusado. |
| [`banned`](#banned) | Conexão | A conta ou o IP está banido (a conexão fecha em seguida). |
| [`error`](#error) | Conexão | Uma mensagem enviada pelo bot era inválida. |
| [`group-message`](#group-message) | Grupos | Mensagem nova numa sala de texto. |
| [`group-message-updated`](#group-message-updated) | Grupos | O autor editou o texto de uma mensagem. |
| [`group-message-deleted`](#group-message-deleted) | Grupos | Mensagem apagada. |
| [`group-message-reactions`](#group-message-reactions) | Grupos | As reações de uma mensagem mudaram. |
| [`group-typing`](#group-typing) | Grupos | Alguém começou/parou de digitar. |
| [`group-notify`](#group-notify) | Grupos | O bot foi mencionado ou respondido. |
| [`group-updated`](#group-updated) | Grupos | Algo mudou no grupo. |
| [`group-added`](#group-added) | Grupos | Alguém adicionou o bot a um grupo. |
| [`group-removed`](#group-removed) | Grupos | O bot saiu/foi tirado de um grupo. |
| [`group-voice`](#group-voice) | Grupos | Mudou quem está nas salas de voz. |
| [`group-read`](#group-read) | Grupos | Outra conexão do bot marcou uma sala como lida. |
| [`group-order`](#group-order) | Grupos | A ordem da lista de grupos do bot mudou. |
| [`dm`](#dm) | DMs | DM enviada ou recebida. |
| [`dm-read`](#dm-read) | DMs | Outra conexão do bot marcou uma conversa como lida. |
| [`dm-typing`](#dm-typing) | DMs | Alguém começou/parou de digitar para o bot. |
| [`dm-seen`](#dm-seen) | DMs | A outra conta leu a conversa. |
| [`dm-reactions`](#dm-reactions) | DMs | As reações de uma DM mudaram. |
| [`dm-edited`](#dm-edited) | DMs | O autor editou o texto de uma DM. |
| [`dm-deleted`](#dm-deleted) | DMs | O autor apagou uma DM. |
| [`dm-settings`](#dm-settings) | DMs | Outra conexão do bot mudou as confirmações de leitura. |
| [`social-update`](#social-update) | Social | Amizade pedida/aceita/desfeita, bloqueio. |
| [`presence-state`](#presence-state) | Presença | Resposta/atualização de um `presence-watch`. |
| [`announcement`](#eventos-que-o-bot-pode-ignorar) | Site | Aviso do site para todos. Ignore. |
| [`alert-target`](#eventos-que-o-bot-pode-ignorar) | Site | Qual aba toca notificações. Ignore. |
| [`call-incoming`, `call-outgoing`, `call-accepted`, `call-ended`](#eventos-que-o-bot-pode-ignorar) | Chamadas | Ligações 1:1. Ignore. |
| [`supporters`, `desktop-update-check`, `theme-liked`, `premium-gift`...](#eventos-que-o-bot-pode-ignorar) | Site | Coisas da interface do site. Ignore. |
| [`room-state`, `chat-message`, `peer-joined`...](#salas-ao-vivo) | Salas ao vivo | Só depois de um `join`. |

### Enviados pelo bot (bot → servidor)

| Mensagem | Para quê |
|---|---|
| [`register`](#register) | Se identificar com o token. **Obrigatória.** |
| [`presence-watch`](#presence-watch) | Acompanhar quem está online. |
| [`join`, `leave`, `chat`, `typing`](#salas-ao-vivo) | Chat das salas ao vivo (experimental). |

Todo o resto — enviar mensagem em grupo, reagir, DM, moderar — é pela [API REST](./rest).

---

## Conexão

### `welcome`

```js
{ type: "welcome", id: "c0nn3ct10n1d" }
```

Chega assim que a conexão abre. Nada a fazer além de mandar o [`register`](#register).

### `register`

*Bot → servidor.*

```js
{ type: "register", token: "Bot ZjNh...q8Xr3" }
```

| Campo | Descrição |
|---|---|
| `token` | A credencial completa, com o prefixo `Bot `. |

Limite: 10 por minuto por conexão.

### `registered`

```js
{
  type: "registered",
  id: "c0nn3ct10n1d",        // id desta conexão
  name: "DJ do Grupo",       // nome de exibição do bot
  account: { username: "musica_bot", flags: [], bot: true },
  guestToken: null
}
```

A partir daqui os eventos do bot passam a chegar. O id da **conta** não vem aqui — use [`GET /auth/me`](./rest#get-auth-me).

### `register-error`

```js
{ type: "register-error", message: "Invalid name.", retryable: true /* às vezes */ }
```

| `message` | Significado | O que fazer |
|---|---|---|
| `Invalid name.` | Token inválido ou revogado. | Parar e conferir o token. |
| `Account not found.` | A conta do bot foi apagada. | Parar. |
| `Server starting. Trying again…` (com `retryable: true`) | O servidor está subindo. | Mandar `register` de novo em alguns segundos. |
| `Too many attempts. Wait a moment.` | Mais de 10 `register` por minuto. | Esperar. |

### `banned`

```js
{ type: "banned", subject: "account", reason: "Spam" }
```

`subject` é `"account"` ou `"fingerprint"`. A conexão fecha em seguida com o código `4003`. **Não reconecte.** (Um IP banido nem chega a receber isso: a conexão já fecha com `4003`.)

### `error`

```js
{ type: "error", message: "Invalid room." }
```

Resposta a uma mensagem malformada enviada pelo bot (em geral, nas salas ao vivo).

### Códigos de fechamento

| Código | Significado | Reconectar? |
|---|---|---|
| `1000` | Fechamento normal. | Se foi você que fechou, não. |
| `1006` | Caiu sem aviso (rede, servidor reiniciando, sem resposta ao ping). | Sim, com espera. |
| `4000` | Outra conexão assumiu esta sessão. | Não (só acontece reutilizando `clientId`). |
| `4003` | Banido. | **Não.** |
| `4004` | O token foi trocado no portal do desenvolvedor, ou o bot foi excluído. | **Não** com o token antigo. |

---

## Grupos

### `group-message`

Mensagem nova numa sala de texto que o bot consegue ver — **inclusive as enviadas pelo próprio bot**.

```js
{
  type: "group-message",
  message: {                       // objeto GroupMessage
    id: "8c1f2d3e-6b7a-4c5d-9e8f-0a1b2c3d4e5f",
    groupId: "k2x9d0a1b3",
    channelId: "q7w3e5r9t1y2",
    from: "a41c...",
    fromName: "Maria",
    text: "!ping",
    kind: "text",
    ts: 1757700000000
  },
  author: {                        // objeto GroupUser
    id: "a41c...", name: "Maria", username: "maria", avatarUrl: null,
    nameColor: null, flags: [], bot: false, guest: false
  },
  mentioned: {},                   // id → GroupUser, para cada <@id> do texto
  nonce: "..."                     // só se quem enviou mandou um nonce
}
```

Veja [GroupMessage](./objetos#groupmessage) e [GroupUser](./objetos#groupuser).

### `group-message-updated`

O autor editou o texto de uma mensagem ([PATCH da mensagem](./rest#patch-groups-id-channels-cid-messages-mid)). Chega para todos que veem a sala, inclusive quando quem editou foi o próprio bot.

```js
{
  type: "group-message-updated",
  groupId: "k2x9d0a1b3",
  channelId: "q7w3e5r9t1y2",
  message: {                       // objeto GroupMessage, como está agora
    id: "8c1f2d3e-6b7a-4c5d-9e8f-0a1b2c3d4e5f",
    groupId: "k2x9d0a1b3",
    channelId: "q7w3e5r9t1y2",
    from: "a41c...",
    fromName: "Maria",
    text: "!ping (corrigido)",
    kind: "text",
    ts: 1757700000000,             // quando foi enviada: não muda
    editedAt: 1757700042000
  },
  mentioned: {}                    // id → GroupUser, para cada <@id> do texto novo
}
```

Não traz `author` nem o texto anterior. Para comparar antes e depois, guarde as mensagens quando chegam (como no exemplo de registro em [Moderação](/guia/moderacao)). Uma edição não gera `group-notify`, mesmo que o texto novo mencione o bot.

### `group-message-deleted`

```js
{ type: "group-message-deleted", groupId: "k2x9d0a1b3", channelId: "q7w3e5r9t1y2", messageId: "8c1f..." }
```

Não informa quem apagou nem o conteúdo.

### `group-message-reactions`

```js
{
  type: "group-message-reactions",
  groupId: "k2x9d0a1b3",
  channelId: "q7w3e5r9t1y2",
  messageId: "8c1f...",
  reactions: [ { emoji: "👍", users: ["a41c...", "f3a9..."] } ]
}
```

Traz o **estado completo** das reações depois da mudança, não quem mudou. Compare com o estado anterior para descobrir — veja [Descobrindo quem reagiu](/guia/reacoes#descobrindo-quem-reagiu-diff).

### `group-typing`

```js
{ type: "group-typing", groupId: "k2x9d0a1b3", channelId: "q7w3e5r9t1y2", userId: "a41c...", name: "Maria", typing: true }
```

Um `typing: true` sem o `false` depois expira sozinho em alguns segundos.

### `group-notify`

O bot foi mencionado (`<@id>`, `@everyone`, um cargo dele, um `@online` enquanto estava conectado, uma [combinação](/guia/enviando-mensagens#online-offline-e-combinacoes) que o inclui) ou alguém respondeu a uma mensagem dele. Chega **além** do `group-message`.

```js
{
  type: "group-notify",
  groupId: "k2x9d0a1b3",
  channelId: "q7w3e5r9t1y2",
  messageId: "8c1f...",
  title: "Maria in #geral · Meu Grupo",
  body: "@DJ do Grupo toca a próxima?",
  url: "/groups/k2x9d0a1b3/q7w3e5r9t1y2",
  icon: "https://..."   // ícone do grupo, se tiver
}
```

Depende do nível de notificação do bot no grupo (padrão: só menções) — veja [`PUT /groups/:id/notify`](./rest#put-groups-id-notify).

### `group-updated`

```js
{ type: "group-updated", groupId: "k2x9d0a1b3" }
```

Algo mudou: nome, ícone, salas, categorias, cargos, permissões, alguém entrou ou saiu. Não diz o quê — se você guarda dados do grupo, busque de novo com [`GET /groups/:id`](./rest#get-groups-id).

### `group-added`

```js
{ type: "group-added", groupId: "k2x9d0a1b3", addedBy: "a41c..." }
```

Alguém que gerencia o grupo acabou de adicionar o bot (`addedBy` é o id dessa pessoa). É assim — e só assim — que um bot entra num grupo: veja [Colocando o bot num grupo](/guia/entrando-em-grupos). A partir daqui o bot recebe os eventos do grupo; busque as salas com [`GET /groups/:id`](./rest#get-groups-id).

### `group-removed`

```js
{ type: "group-removed", groupId: "k2x9d0a1b3", reason: "kicked" }
```

| `reason` | |
|---|---|
| `left` | O bot saiu. |
| `kicked` | O bot foi expulso. |
| `banned` | O bot foi banido. |
| `deleted` | O grupo foi apagado. |

### `group-voice`

Quem está em cada sala de voz do grupo (só as que o bot vê). Chega sempre que alguém entra, sai, liga o microfone, compartilha a tela etc. — é o retrato completo, não a diferença.

```js
{
  type: "group-voice",
  groupId: "k2x9d0a1b3",
  voice: {
    "v01c3r00m001": [
      { userId: "a41c...", name: "Maria", avatarUrl: null, mic: true, sharing: false,
        deafened: false, camera: false, screen: false }
    ]
  },
  voiceRooms: {
    "v01c3r00m001": { music: { playing: true } }   // só salas com música
  }
}
```

Sala vazia não aparece em `voice`. Dá para anunciar "Maria entrou na call" comparando com o retrato anterior.

### `group-read`

```js
{ type: "group-read", groupId: "k2x9d0a1b3", channelId: "q7w3e5r9t1y2" }
```

Outra conexão da mesma conta marcou a sala como lida. Bots normalmente ignoram.

### `group-order`

```js
{ type: "group-order", ids: ["k2x9d0a1b3", "..."] }
```

A ordem dos grupos na barra lateral da conta mudou. Bots ignoram.

---

## Mensagens diretas

### `dm`

Chega para **os dois lados** da conversa — inclusive quando é o bot quem envia.

```js
{
  type: "dm",
  message: {                        // objeto DirectMessage
    id: "d1e2...",
    conversationId: "...",
    from: "a41c...",
    to: "f3a9...",
    text: "oi bot",
    kind: "text",
    ts: 1757700000000,
    clientId: "..."                 // só se quem enviou mandou
  },
  fromUser: {                       // objeto DmUser (quem enviou)
    id: "a41c...", username: "maria", displayName: "Maria",
    avatarUrl: null, nameColor: null, flags: [], bot: false
  }
}
```

### `dm-read`

```js
{ type: "dm-read", otherId: "a41c..." }
```

Outra conexão do bot marcou a conversa com `otherId` como lida.

### `dm-typing`

```js
{ type: "dm-typing", from: "a41c...", typing: true }
```

Um `typing: true` sem o `false` depois expira sozinho em alguns segundos. Uma DM de `from` também apaga.

### `dm-seen`

```js
{ type: "dm-seen", by: "a41c...", ts: 1757700000000 }
```

`by` leu a conversa com o bot até `ts`. Só chega quando os dois lados compartilham confirmações de leitura.

### `dm-reactions`

```js
{ type: "dm-reactions", messageId: "d1e2...", from: "a41c...", to: "f3a9...", reactions: [ { emoji: "👍", users: ["a41c..."] } ] }
```

`from`/`to` são os da mensagem reagida. Traz o **estado completo** das reações, para os dois lados.

### `dm-edited`

```js
{
  type: "dm-edited",
  message: {                        // objeto DirectMessage, como está agora
    id: "d1e2...", from: "a41c...", to: "f3a9...",
    text: "oi bot (corrigido)", kind: "text",
    ts: 1757700000000,              // quando foi enviada: não muda
    editedAt: 1757700042000
  }
}
```

Chega para os dois lados. Não traz o texto anterior e não gera notificação.

### `dm-deleted`

```js
{ type: "dm-deleted", messageId: "d1e2...", from: "a41c...", to: "f3a9..." }
```

A mensagem foi apagada para os dois lados. `from`/`to` são os da mensagem apagada.

### `dm-settings`

```js
{ type: "dm-settings", readReceipts: false }
```

---

## Social

### `social-update`

```js
{ type: "social-update", kind: "friend-request", from: "a41c...", to: "f3a9..." }
```

| `kind` | Significado |
|---|---|
| `friend-request` | `from` pediu amizade a `to`. |
| `friend-accepted` | `from` aceitou a amizade de `to`. |
| `friend-removed` | A amizade (ou o pedido) entre os dois acabou. |
| `blocked` | O bot bloqueou `to` (só quem bloqueia é avisado). |
| `unblocked` | O bot desbloqueou `to`. |

Um bot pode aceitar pedidos automaticamente com [`POST /social/friends/:id/accept`](./rest#social).

---

## Presença

### `presence-watch`

*Bot → servidor.* Pede para acompanhar se certas contas estão online. Cada chamada **substitui** a lista anterior (até 400 ids).

```js
ws.send(JSON.stringify({ type: "presence-watch", ids: ["a41c...", "b77e..."] }));
```

### `presence-state`

A resposta imediata, com todos os ids pedidos, e depois só as mudanças:

```js
{
  type: "presence-state",
  presence: {
    "a41c...": { state: "online", device: "mobile" },
    "b77e...": { state: "offline" }
  }
}
```

| `state` | |
|---|---|
| `online` | Com o site ou o app na frente (bolinha verde). |
| `away` | Site aberto numa aba ou janela que não está à vista (azul). |
| `background` | App instalado rodando escondido: na bandeja, minimizado, Android em segundo plano (amarelo). |
| `offline` | Sem nenhuma conexão. |

Um bot conectado aparece como `online`.

`device` (opcional): `"app"` (aplicativo de computador) ou `"mobile"`.

Sem WebSocket, a mesma informação sai em [`GET /presence?ids=a,b`](./rest#outros).

---

## Eventos que o bot pode ignorar

O WebSocket é o mesmo que o site usa, então chegam coisas da interface. Um bot pode ignorar qualquer `type` que não conhece — e deve, porque novos tipos podem aparecer a qualquer momento.

| Evento | O que é |
|---|---|
| `announcement` | O aviso (banner) que a administração do site mostra para todos. |
| `alert-target` | Qual conexão da conta deve tocar som de notificação. |
| `supporters` | A lista de apoiadores exibida no site. |
| `desktop-update-check` | Pede ao aplicativo de computador para procurar atualização. |
| `call-incoming`, `call-outgoing`, `call-accepted`, `call-ended` | Ligações entre contas. |
| `theme-liked`, `premium-gift`, `premium-gift-redeemed` | Notificações da loja e dos temas. |
| `ads-config`, `partner` | Configuração de anúncios do site. |

---

## Salas ao vivo

Depois de um `join` numa sala ao vivo, chegam os eventos da sala (`room-state`, `chat-message`, `peer-joined`, `peer-left`, `peer-typing`, `room-settings`, `signal` e outros). Eles estão documentados em [Salas ao vivo (experimental)](/guia/salas-ao-vivo).
