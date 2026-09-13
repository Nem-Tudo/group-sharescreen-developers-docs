# API REST

```
https://apigolive.nemtudo.me
```

- Corpo e respostas em **JSON**. Mande `Content-Type: application/json` **só quando houver corpo** — um `Content-Type` JSON com corpo vazio é recusado com `400`. Nas rotas `POST` sem campos, mande `{}`.
- Autenticação: `Authorization: Bot <token>`. Rotas marcadas como **pública** funcionam sem.
- Erros vêm como `{ "error": "mensagem" }` — veja [Erros](./erros).
- Cada rota tem seu limite de requisições **por IP**, na coluna "Limite" (por minuto, salvo indicação) — veja [Limites](./limites).
- `:id` é o id do grupo, `:cid` o id da sala, `:mid` o id da mensagem, `:userId` o id de uma conta.

## Índice de rotas

### Conta e perfil

| Método | Rota | O que faz | Limite |
|---|---|---|---|
| <span class="http get">GET</span> | [`/auth/me`](#get-auth-me) | A conta do bot. | 120 |
| <span class="http patch">PATCH</span> | [`/account/profile`](#patch-account-profile) | Edita nome, bio e avatar do bot. | 30 |
| <span class="http get">GET</span> | [`/account/avatars`](#get-account-avatars) | Avatares que o bot pode usar. | 60 |
| <span class="http get">GET</span> | [`/users/:usuarioOuId`](#get-users-id) | Perfil público de uma conta. **Pública.** | 60 |
| <span class="http get">GET</span> | `/account/bots` | Bots de uma conta. **Sessão de pessoa**, não de bot. | 60 |
| <span class="http post">POST</span> | `/account/bots` | Cria um bot. **Sessão de pessoa.** | 5 / 15 min |
| <span class="http post">POST</span> | `/account/bots/:id/token` | Gera novo token. **Sessão de pessoa.** | 10 / 5 min |

### Grupos

| Método | Rota | O que faz | Permissão | Limite |
|---|---|---|---|---|
| <span class="http get">GET</span> | [`/groups`](#get-groups) | Grupos em que o bot está. | — | 120 |
| <span class="http get">GET</span> | [`/groups/:id`](#get-groups-id) | Salas, cargos, permissões e o bot no grupo. | membro | 240 |
| <span class="http get">GET</span> | `/groups/:id/voice` | Quem está em cada sala de voz. | membro | 240 |
| <span class="http post">POST</span> | [`/groups`](#post-groups) | Cria um grupo (o bot vira dono). | — | 10 |
| <span class="http patch">PATCH</span> | [`/groups/:id`](#patch-groups-id) | Muda nome e descrição. | `manageGroup` | 30 |
| <span class="http post">POST</span> | `/groups/:id/icon` | Troca o ícone (`{ image: dataURL }`). | `manageGroup` | 10 |
| <span class="http delete">DELETE</span> | `/groups/:id/icon` | Remove o ícone. | `manageGroup` | 30 |
| <span class="http put">PUT</span> | [`/groups/:id/notify`](#put-groups-id-notify) | Nível de notificação do bot no grupo. | membro | 60 |
| <span class="http put">PUT</span> | `/groups/:id/visibility` | `{ visibility: "public" \| "private" }`. | dono | 20 |
| <span class="http put">PUT</span> | `/groups/:id/location` | Posição no mapa (`{ location: { lat, lng } \| null }`). | `manageGroup` | 30 |
| <span class="http put">PUT</span> | `/groups/:id/custom-invite` | Link personalizado (`{ code }`). Plano Pro Max do dono. | `manageGroup` | 20 |
| <span class="http post">POST</span> | `/groups/:id/transfer` | Passa o grupo para outro membro (`{ userId }`). | dono | 10 |
| <span class="http post">POST</span> | [`/groups/:id/leave`](#post-groups-id-leave) | Sai do grupo. | membro | 20 |
| <span class="http delete">DELETE</span> | `/groups/:id` | Apaga o grupo. | dono | 10 |
| <span class="http post">POST</span> | [`/groups/:id/join`](#post-groups-id-join) | Entra num grupo público. | — | 20 |
| <span class="http get">GET</span> | `/groups/:id/preview` | Cartão de um grupo público. **Pública.** | — | 60 |
| <span class="http get">GET</span> | `/groups/search?q=` | Busca grupos públicos pelo nome. **Pública.** | — | 60 |
| <span class="http get">GET</span> | `/groups/map` | Grupos no mapa-múndi. **Pública.** | — | 60 |
| <span class="http put">PUT</span> | `/groups/order` | Ordem dos grupos na barra lateral (`{ ids }`). | — | 60 |

### Salas e categorias

| Método | Rota | O que faz | Permissão | Limite |
|---|---|---|---|---|
| <span class="http post">POST</span> | [`/groups/:id/channels`](#post-groups-id-channels) | Cria uma sala. | `manageChannels` | 30 |
| <span class="http patch">PATCH</span> | `/groups/:id/channels/:cid` | Renomeia (`{ name }`). | `manageChannels` | 30 |
| <span class="http delete">DELETE</span> | `/groups/:id/channels/:cid` | Apaga a sala. | `manageChannels` | 30 |
| <span class="http put">PUT</span> | `/groups/:id/channels/order` | Reordena (`{ ids }`). | `manageChannels` | 30 |
| <span class="http put">PUT</span> | [`/groups/:id/channels/:cid/permissions`](#put-groups-id-channels-cid-permissions) | Exceções de permissão da sala. | `manageChannels` | 60 |
| <span class="http post">POST</span> | `/groups/:id/categories` | Cria categoria (`{ name }`). | `manageChannels` | 30 |
| <span class="http patch">PATCH</span> | `/groups/:id/categories/:catId` | Renomeia categoria (`{ name }`). | `manageChannels` | 30 |
| <span class="http delete">DELETE</span> | `/groups/:id/categories/:catId` | Apaga a categoria (as salas ficam, sem categoria). | `manageChannels` | 30 |
| <span class="http put">PUT</span> | `/groups/:id/layout` | Reorganiza tudo (`{ categories, containers }`). | `manageChannels` | 60 |

### Mensagens

| Método | Rota | O que faz | Permissão | Limite |
|---|---|---|---|---|
| <span class="http get">GET</span> | [`/groups/:id/channels/:cid/messages`](#get-groups-id-channels-cid-messages) | Histórico (50 por página). | ver a sala | 240 |
| <span class="http post">POST</span> | [`/groups/:id/channels/:cid/messages`](#post-groups-id-channels-cid-messages) | Envia mensagem. | `sendMessages` | 120 |
| <span class="http delete">DELETE</span> | [`/groups/:id/channels/:cid/messages/:mid`](#delete-groups-id-channels-cid-messages-mid) | Apaga mensagem. | própria, ou `manageMessages` | 60 |
| <span class="http post">POST</span> | [`/groups/:id/channels/:cid/messages/:mid/reactions`](#post-groups-id-channels-cid-messages-mid-reactions) | Coloca/tira reação. | `addReactions` / `react` | 120 |
| <span class="http get">GET</span> | [`/groups/:id/channels/:cid/messages/:mid/reactions?emoji=`](#get-groups-id-channels-cid-messages-mid-reactions) | Quem reagiu com um emoji, paginado. | ver a sala | 120 |
| <span class="http delete">DELETE</span> | `/groups/:id/channels/:cid/messages/:mid/reactions?emoji=&userId=` | Tira a reação de alguém. Resposta: `{ reactions }`. | a própria, ou `manageReactions` | 120 |
| <span class="http post">POST</span> | [`/groups/:id/channels/:cid/typing`](#post-groups-id-channels-cid-typing) | "Está digitando...". | `sendMessages` | 120 |
| <span class="http post">POST</span> | `/groups/:id/channels/:cid/read` | Marca a sala como lida. | ver a sala | 240 |

### Membros e moderação

| Método | Rota | O que faz | Permissão | Limite |
|---|---|---|---|---|
| <span class="http get">GET</span> | [`/groups/:id/members`](#get-groups-id-members) | Lista de membros. | membro | 120 |
| <span class="http post">POST</span> | `/groups/:id/members/:userId/kick` | Expulsa. | `kickMembers` | 30 |
| <span class="http get">GET</span> | `/groups/:id/bans` | Banidos. | `banMembers` | 60 |
| <span class="http post">POST</span> | `/groups/:id/bans/:userId` | Bane. | `banMembers` | 30 |
| <span class="http delete">DELETE</span> | `/groups/:id/bans/:userId` | Desbane. | `banMembers` | 30 |

### Cargos e permissões

| Método | Rota | O que faz | Permissão | Limite |
|---|---|---|---|---|
| <span class="http post">POST</span> | [`/groups/:id/roles`](#post-groups-id-roles) | Cria cargo. | `manageRoles` | 30 |
| <span class="http patch">PATCH</span> | `/groups/:id/roles/:roleId` | Edita cargo (mesmos campos). | `manageRoles` | 60 |
| <span class="http delete">DELETE</span> | `/groups/:id/roles/:roleId` | Apaga cargo. | `manageRoles` | 30 |
| <span class="http put">PUT</span> | `/groups/:id/roles/order` | Reordena (`{ ids }`, do mais alto ao mais baixo). | `manageRoles` | 30 |
| <span class="http put">PUT</span> | [`/groups/:id/members/:userId/roles`](#put-groups-id-members-userid-roles) | Define os cargos de um membro. | `manageRoles` | 60 |
| <span class="http put">PUT</span> | `/groups/:id/permissions` | Permissões do @everyone (mescla). | `manageRoles` | 60 |

### Convites

| Método | Rota | O que faz | Permissão | Limite |
|---|---|---|---|---|
| <span class="http get">GET</span> | `/groups/:id/invites` | Convites ativos. | `createInvites` ou `manageGroup` | 60 |
| <span class="http post">POST</span> | [`/groups/:id/invites`](#post-groups-id-invites) | Cria convite. | `createInvites` | 20 |
| <span class="http delete">DELETE</span> | `/groups/:id/invites/:code` | Revoga convite. | criador, ou `manageGroup` | 30 |
| <span class="http get">GET</span> | [`/invites/:code`](#get-invites-code) | Para onde o convite leva. **Pública.** | — | 60 |
| <span class="http post">POST</span> | [`/invites/:code/accept`](#post-invites-code-accept) | Aceita o convite. | — | 20 |

### Mensagens diretas

| Método | Rota | O que faz | Limite |
|---|---|---|---|
| <span class="http get">GET</span> | `/dm` | Conversas do bot. | 120 |
| <span class="http get">GET</span> | `/dm/:userId?before=` | Histórico com uma conta. | 120 |
| <span class="http post">POST</span> | [`/dm/:userId`](#post-dm-userid) | Envia DM. | 60 |
| <span class="http post">POST</span> | `/dm/:userId/read` | Marca como lida. | 120 |
| <span class="http post">POST</span> | `/dm/:userId/typing` | "Está digitando...". | 120 |
| <span class="http post">POST</span> | `/dm/:userId/messages/:mid/reactions` | Reage (`{ emoji, on? }`). | 120 |
| <span class="http get">GET</span> | `/dm/settings` | `{ readReceipts }` da conta. | 60 |
| <span class="http put">PUT</span> | `/dm/settings` | Liga/desliga confirmações de leitura. | 30 |

### Social

| Método | Rota | O que faz | Limite |
|---|---|---|---|
| <span class="http get">GET</span> | `/social` | Amigos, pedidos recebidos/enviados e bloqueados. | 120 |
| <span class="http get">GET</span> | `/social/search?q=` | Procura contas por nome (mín. 2 letras). | 60 |
| <span class="http post">POST</span> | `/social/friends/:userId` | Pede amizade. | 30 |
| <span class="http post">POST</span> | `/social/friends/:userId/accept` | Aceita um pedido. | 30 |
| <span class="http delete">DELETE</span> | `/social/friends/:userId` | Desfaz amizade ou pedido. | 30 |
| <span class="http post">POST</span> | `/social/blocks/:userId` | Bloqueia. | 30 |
| <span class="http delete">DELETE</span> | `/social/blocks/:userId` | Desbloqueia. | 30 |

### Outros

| Método | Rota | O que faz | Limite |
|---|---|---|---|
| <span class="http get">GET</span> | `/stats` | `{ peopleOnline }` nas salas ao vivo. **Pública.** | 60 |
| <span class="http get">GET</span> | `/rooms` | Salas ao vivo públicas agora. **Pública.** | 60 |
| <span class="http get">GET</span> | `/rooms/:handle/exists` | Se uma sala ao vivo existe. **Pública.** | 60 |
| <span class="http get">GET</span> | `/presence?ids=a,b,c` | Presença de até 400 contas. **Pública.** | 120 |
| <span class="http get">GET</span> | `/health` | Se a API está no ar. **Pública.** | sem limite |

---

## Conta

### GET /auth/me

A conta dona do token. Primeira chamada de todo bot: confere o token e dá o id.

```js
// 200
{
  account: { id: "f3a9...", username: "musica_bot", displayName: "DJ do Grupo", bot: true, /* ... */ },
  connections: { /* formas de login — vazio para bots */ }
}
```

`401` se o token for inválido; `503` com `retryable: true` se o servidor estiver iniciando. Veja o objeto [Account](./objetos#account).

### PATCH /account/profile

| Campo | Regras |
|---|---|
| `displayName` | 1 a 24 caracteres. |
| `bio` | Até 500 caracteres; `null` apaga. |
| `avatar` | Caminho de um avatar liberado (veja abaixo); `null` remove. *Data URL* só com o plano Pro Max. |

Mande só o que for mudar. Detalhes em [Perfil do bot](/guia/perfil-do-bot).

### GET /account/avatars

```js
{
  defaults: ["/assets/default_avatars/01.png", "/assets/default_avatars/02.png"],
  gallery: ["/assets/avatars/01.png", /* ... */],
  canUseGallery: false,   // plano Pro
  canUpload: false        // plano Pro Max
}
```

### GET /users/:id

Aceita o @usuário (sem o @) ou o id. Pública.

```js
{
  account: { id, username, displayName, bio, avatarUrl, bannerUrl, flags, bot, createdAt, /* ... */ },
  live: { room: "sala-do-joao", peopleCount: 12 } // ou null
}
```

---

## Grupos

### GET /groups

```js
{
  groups: [
    {
      id: "k2x9d0a1b3", name: "Meu Grupo", iconUrl: null, flags: [],
      role: "member",            // "owner" | "admin" | "member"
      memberCount: 42, onlineCount: 7,
      unread: true, mentions: 1,
      suspended: true            // só se o grupo estiver suspenso
    }
  ]
}
```

### GET /groups/:id

```js
{
  group: {                          // objeto Group
    id, name, description, iconUrl, visibility, flags, ownerId,
    permissions,                    // do @everyone
    roles: [ /* Role, do mais alto ao mais baixo */ ],
    memberCount, createdAt, /* ... */
  },
  categories: [ { id, name, position } ],
  channels: [                       // só as salas que o bot vê
    { id, kind: "text", name: "geral", categoryId: null, position: 0,
      permissions: {}, roleOverrides: {}, unread: false, mentions: 0 }
  ],
  voice: { /* channelId → participantes */ },
  voiceRooms: { /* channelId → { music } */ },
  memberRoles: { /* userId → [roleId] */ },
  me: {
    id, role, roleIds, rank,        // rank: posição do cargo mais alto (-1 = dono)
    permissions,                    // tudo o que O BOT pode, já calculado
    notify: "mentions",
    guest: false
  },
  chatAvailable: true
}
```

`404` se o bot não é membro (a API não revela se o grupo existe). `423` se o grupo está suspenso.

### POST /groups

| Campo | Descrição |
|---|---|
| `name` | Até 50 caracteres. |
| `visibility` | `"public"` ou `"private"` (padrão). |

Uma conta pode ser dona de até 10 grupos. Resposta: `{ group }`.

### PATCH /groups/:id

`{ name?, description? }` — nome até 50, descrição até 200 caracteres. Resposta: `{ group }`.

### PUT /groups/:id/notify

`{ level: "all" | "mentions" | "none" }` — de quais mensagens o bot recebe [`group-notify`](./eventos#group-notify). Padrão: `"mentions"`.

::: tip
Não afeta o `group-message`: o bot recebe todas as mensagens das salas que vê, qualquer que seja o nível.
:::

### POST /groups/:id/leave

Corpo `{}`. O dono não pode sair (transfira ou apague o grupo antes).

### POST /groups/:id/join

Corpo `{}`. Só grupos públicos. Mesmos erros de [aceitar convite](#post-invites-code-accept). Resposta: `{ groupId }`.

---

## Salas

### POST /groups/:id/channels

| Campo | Descrição |
|---|---|
| `kind` | `"text"` (padrão) ou `"voice"`. |
| `name` | Até 32 caracteres. Salas de texto ficam em minúsculas. |
| `categoryId` | Categoria onde criar, ou `null`. |

Até 50 salas por grupo. Resposta: `{ channel }`.

### PUT /groups/:id/channels/:cid/permissions

| Campo | Descrição |
|---|---|
| `roleId` | O cargo a que as exceções se aplicam; omitido = @everyone. Só cargos abaixo do bot. |
| `permissions` | `{ chave: true \| false }`. Chave omitida ou `null` = herda do grupo. |

Substitui todas as exceções daquele alvo na sala. Chaves válidas: as de `general`, `text` (salas de texto) ou `voice` (salas de voz) — veja [Permissões](./permissoes).

---

## Mensagens

### GET /groups/:id/channels/:cid/messages

Query: `before` (ms, opcional). Até 50 mensagens anteriores a `before`, da mais antiga para a mais nova.

```js
{
  messages: [ /* GroupMessage */ ],
  authors: { /* userId → GroupUser: autores e mencionados da página */ }
}
```

### POST /groups/:id/channels/:cid/messages

| Campo | Tipo | Descrição |
|---|---|---|
| `text` | string | Até 2000 caracteres. |
| `images` | string[] | Até 3 *data URLs* (PNG, JPEG, WebP, GIF, AVIF); 5 MB cada, 8 MB no total. Exige `sendImages`. |
| `url` | string | GIF do Giphy. Exige `sendGifs`. |
| `replyTo` | objeto | `{ id, name, text?, kind?, images?, userId? }`. `userId` notifica o autor. |
| `mentions` | string[] | `"@everyone"` (exige `mentionEveryone`) e `"@role:<id>"`. Pessoas vão no texto como `<@id>`. |
| `nonce` | string | 8–64 caracteres `[A-Za-z0-9_-]`. Repetir com o mesmo nonce em até 10 min devolve a mensagem já criada. |

Pelo menos um de `text`, `images`, `url`. Resposta: `{ message, author, nonce? }`. Guia: [Enviando mensagens](/guia/enviando-mensagens).

### DELETE /groups/:id/channels/:cid/messages/:mid

Sem corpo. Resposta: `{ ok: true }`. `403` se não for do bot e ele não tiver `manageMessages`.

### POST /groups/:id/channels/:cid/messages/:mid/reactions

| Campo | Descrição |
|---|---|
| `emoji` | Exatamente um emoji Unicode padrão. |
| `on` | `true` (padrão) coloca; `false` tira. |

Resposta: `{ reactions: [ { emoji, users } ] }`. Máx. 20 emoji diferentes por mensagem.

### GET /groups/:id/channels/:cid/messages/:mid/reactions

| Parâmetro | Descrição |
|---|---|
| `emoji` | O emoji (obrigatório). |
| `sort` | `recent` (padrão, mais recentes primeiro), `oldest` ou `name` (alfabética). |
| `q` | Só quem tem isso no nome ou no @usuário. |
| `after` | O `next` da página anterior. |
| `limit` | 1–100, padrão 50. |

Resposta: `{ people: [GroupUser], total, next }` — `total` é quantos batem com a busca; `next` é `null` na última página.

### POST /groups/:id/channels/:cid/typing

`{ typing: true | false }`. Resposta: `{ ok: true }`.

---

## Membros

### GET /groups/:id/members

Sem query, a lista inteira:

```js
{
  members: [
    { id, name, username, avatarUrl, nameColor, flags, bot, guest,
      role: "member", roleIds: ["r0l3..."], online: true, joinedAt: 1757000000000 }
  ]
}
```

Em grupos grandes, peça **fatias**:

| Query | Devolve |
|---|---|
| `?online=1` | Todos os membros online. |
| `?online=0&limit=100&after=<id>` | Uma página dos offline (máx. 200). Continue com o `next` da resposta. |
| `?q=texto` | Membros cujo nome contém o texto (sem acento, padrão 20 resultados). |
| `&channel=<cid>` | Combina com os de cima: só quem vê aquela sala. |

Com query, a resposta ganha `total`, `online` e (na paginação) `next`.

---

## Cargos

### POST /groups/:id/roles

| Campo | Descrição |
|---|---|
| `name` | Até 32 caracteres. |
| `color` | `"#rrggbb"` ou `null`. |
| `hoist` | Mostrar separado na lista de membros. |
| `mentionable` | Qualquer um pode mencioná-lo. |
| `permissions` | `{ manage: {...}, general: {...}, text: {...}, voice: {...} }` — só as que o bot tem são aceitas. |

O cargo novo entra no fim da lista (posição 1). Até 50 cargos por grupo. Resposta: `{ role }`.

### PUT /groups/:id/members/:userId/roles

`{ roleIds: [...] }` — a lista **completa** de cargos que a pessoa deve ter. Só cargos abaixo do bot mudam; os demais ficam como estavam. Resposta: `{ roleIds }`.

---

## Convites

### POST /groups/:id/invites

| Campo | Descrição |
|---|---|
| `expiresIn` | `"30m"`, `"1h"`, `"6h"`, `"1d"`, `"7d"` (padrão) ou `"never"`. |
| `maxUses` | Número de usos (1 a 10000), ou omitido para ilimitado. |

Resposta: `{ invite: { code, createdBy, createdAt, expiresAt, maxUses, uses } }`. Link: `https://golive.nemtudo.me/invite/<code>`.

### GET /invites/:code

```js
{
  invite: { code: "AbC12345", state: "ok", expiresAt: 1758300000000 },  // state: ok | expired | revoked | exhausted
  group: { id, name, description, iconUrl, flags, memberCount, onlineCount },
  member: false   // se o bot já está no grupo
}
```

### POST /invites/:code/accept

Corpo `{}`. Resposta: `{ groupId }` (também se o bot já for membro).

| Status | Motivo |
|---|---|
| `403` | Banido do grupo, grupo cheio, ou o bot já está em 100 grupos. |
| `404` | Convite inválido. |
| `410` | Expirado, revogado ou esgotado (`state` na resposta). |
| `423` | Grupo suspenso. |

---

## Mensagens diretas

### POST /dm/:userId

| Campo | Descrição |
|---|---|
| `text` | Até 2000 caracteres. |
| `images` | Até 3 *data URLs*, mesmas regras dos grupos. |
| `url` | GIF do Giphy. |
| `replyTo` | `{ id, name, text?, kind?, images? }`. |
| `clientId` | Um rótulo seu (1–64 `[A-Za-z0-9_-]`), devolvido no evento `dm`. |

Resposta: `{ message }`. `404 User not found.` também quando há bloqueio entre as contas. Guia: [Mensagens diretas](/guia/mensagens-diretas).

`GET /dm/:userId` responde `{ user, messages, seenTs }` — `seenTs` é até quando a outra conta leu, ou `null` se um dos dois desligou as confirmações de leitura.
