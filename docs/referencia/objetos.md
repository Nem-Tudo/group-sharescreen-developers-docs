# Objetos

Os formatos que aparecem nas respostas da API e nos eventos. Campos marcados com `?` podem não vir.

## Ids

| Id | Formato | Exemplo |
|---|---|---|
| Conta (pessoa ou bot) | UUID | `f3a9c1e2-8b4d-4b17-99c5-3d6e1a0b7c45` |
| Convidado | `guest:` + id | `guest:x8Yq2...` |
| Grupo | 10 letras/números | `k2x9d0a1b3` |
| Sala, cargo, categoria | 12 letras/números | `q7w3e5r9t1y2` |
| Mensagem | UUID | `8c1f2d3e-6b7a-4c5d-9e8f-0a1b2c3d4e5f` |
| Convite | 8 letras/números (ou o nome do link personalizado) | `AbC12345` |

Datas (`ts`, `createdAt`, `expiresAt`...) são **milissegundos** desde 1970 — `new Date(ts)` no JavaScript.

## Account

Uma conta, de pessoa ou de bot. Vem em `GET /auth/me`, `GET /users/:id` e nas rotas de bots.

```ts
{
  id: string
  username: string            // "musica_bot"
  displayName: string         // "DJ do Grupo"
  bot: boolean
  flags: string[]             // selos: "VERIFIED", "PRO"...
  bio: string | null
  avatarUrl: string | null
  bannerUrl: string | null
  equippedNameColor: string | null   // cor do nome, "#rrggbb"
  points: number
  premium: object | null      // assinatura, se houver
  features: string[]          // o que o plano libera
  createdAt: number
  updatedAt: number
  // ...e campos de perfil e loja que um bot raramente usa
}
```

## GroupUser

Uma pessoa como aparece dentro de um grupo (`author` das mensagens, lista de membros).

```ts
{
  id: string                  // id da conta, ou "guest:..."
  name: string                // nome de exibição
  username: string | null     // null para convidados
  avatarUrl: string | null
  nameColor: string | null
  flags: string[]
  bot: boolean
  guest: boolean
  webhook?: true              // só no autor de uma mensagem de webhook — id "webhook:<id>", sem conta por trás
}
```

Na lista de membros (`GET /groups/:id/members`) ganha também:

```ts
{
  role: "owner" | "admin" | "member"
  roleIds: string[]
  online: boolean
  joinedAt: number
}
```

## GroupMessage

```ts
{
  id: string
  groupId: string
  channelId: string
  from: string                // id do autor
  fromName: string            // nome do autor quando enviou
  text: string                // "" quando é só imagem/GIF
  kind?: "text" | "image" | "gif"
  url?: string                // o GIF
  images?: string[]           // URLs na CDN do GoLive
  replyTo?: ReplyTo | null
  mentions?: string[]         // ids notificados, "@everyone", "@role:<id>", "@online", "@offline", "@expr:<expressão>"
  pingedMe?: boolean          // só no GET de mensagens, com @online/@offline/@expr: — se alcançou quem lê
  reactions?: Reaction[]      // ausente sem reações
  ts: number                  // quando foi enviada (não muda ao editar)
  editedAt?: number           // última edição; ausente se nunca foi editada
  embeds?: Embed[]            // de bots e webhooks; ausente sem embeds
  webhook?: { id: string, avatarUrl: string | null }  // quando um webhook postou; `from` é "webhook:<id>"
}
```

O `text` é o que foi escrito, com o [markdown](/guia/enviando-mensagens#formatacao) e os tokens `<@id>`/`<#id>` como estão.

## Embed

Como a API devolve um embed. O envio aceita o formato do Discord (`icon_url`, `image: { url }`); veja [Embeds](/guia/enviando-mensagens#embeds).

```ts
{
  title?: string
  description?: string        // com markdown
  url?: string                // link do título
  color?: number              // 0xRRGGBB
  author?: { name: string, url?: string, iconUrl?: string }
  footer?: { text: string, iconUrl?: string }
  timestamp?: string          // ISO 8601
  fields?: { name: string, value: string, inline: boolean }[]
  image?: string              // https
  thumbnail?: string          // https
}
```

## ReplyTo

A cópia da mensagem citada numa resposta.

```ts
{
  id: string                  // id da mensagem citada
  name: string                // nome do autor dela
  text?: string               // até 200 caracteres
  kind?: "text" | "image" | "gif"
  images?: string[]
  userId?: string             // só em grupos: o autor, que é notificado
}
```

## Reaction

```ts
{
  emoji: string               // "👍"
  users: string[]             // ids de quem reagiu, na ordem
}
```

## Group

```ts
{
  id: string
  name: string
  description: string
  iconUrl: string | null
  visibility: "public" | "private"
  theme: string | null
  flags: string[]             // "VERIFIED"...
  location: { lat: number, lng: number } | null
  customInvite: string | null
  customInviteAllowed: boolean
  ownerId: string
  permissions: Permissions    // as do @everyone
  roles: Role[]               // do mais alto ao mais baixo
  memberCount: number
  createdAt: number
}
```

## Channel

Uma sala, em `GET /groups/:id` → `channels`.

```ts
{
  id: string
  kind: "text" | "voice"
  name: string
  categoryId: string | null
  position: number
  permissions: { [chave]: boolean }                   // exceções do @everyone nesta sala
  roleOverrides: { [roleId]: { [chave]: boolean } }   // exceções por cargo
  unread: boolean
  mentions: number
}
```

## Role

```ts
{
  id: string
  name: string
  color: string | null        // "#rrggbb"
  position: number            // 1 = mais baixo
  hoist: boolean              // aparece separado na lista de membros
  mentionable: boolean
  permissions: Permissions
}
```

## Permissions

```ts
{
  manage:  { administrator, manageGroup, manageChannels, manageRoles,
             kickMembers, banMembers, manageMessages, manageReactions, createInvites }
  general: { viewChannel, useCustomEmojis, useExternalEmojis }
  text:    { sendMessages, sendGifs, sendImages, mentionMembers,
             mentionEveryone, addReactions, react }
  voice:   { connect, mic, screen, camera, videoSource, chat, gif, image }
}
```

Todos `boolean`. O que cada um faz está em [Permissões](./permissoes).

## Invite

```ts
{
  code: string
  createdBy: string
  createdAt: number
  expiresAt: number | null    // null = não expira
  maxUses: number | null      // null = ilimitado
  uses: number
}
```

## DirectMessage

```ts
{
  id: string
  conversationId: string
  from: string
  to: string
  text: string
  kind?: "text" | "image" | "gif"
  url?: string
  images?: string[]
  replyTo?: ReplyTo | null
  reactions?: Reaction[]      // ausente sem reações
  ts: number                  // quando foi enviada (não muda ao editar)
  editedAt?: number           // última edição; ausente se nunca foi editada
  clientId?: string           // só no evento, se quem enviou mandou
}
```

## DmUser

Quem aparece numa conversa (`fromUser` do evento `dm`, `user` em `GET /dm`).

```ts
{
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  nameColor: string | null
  flags: string[]
  bot: boolean
}
```

## VoiceParticipant

Alguém numa sala de voz (evento `group-voice`).

```ts
{
  userId: string
  name: string
  avatarUrl: string | null
  mic: boolean                // microfone aberto
  sharing: boolean            // transmitindo algo
  deafened: boolean           // silenciou todo mundo para si
  camera: boolean
  screen: boolean             // tela ou outra fonte de vídeo
}
```
