# Colocando o bot num grupo

Um bot **não entra em grupo sozinho** — nem por convite, nem num grupo público. Quem coloca o bot num grupo é uma **pessoa que gerencia o grupo**, como num servidor do Discord: ela abre o link do bot, escolhe o grupo e pronto.

Isso existe para que um link de convite vazado não sirva para encher um grupo de bots, e para que todo bot num grupo esteja lá porque alguém do grupo quis.

## 1. Pegue o link do bot

No [portal do desenvolvedor](https://golive.nemtudo.me/developers), abra o bot e vá na aba **Instalação**. O link tem esta cara:

```
https://golive.nemtudo.me/bots/<id-do-bot>/add
https://golive.nemtudo.me/bots/<id-do-bot>/add?permissions=6160
```

Como no Discord, o `?permissions=` diz quais [permissões](#_3-permissoes-ao-entrar) o bot pede. Sem ele, valem as **permissões padrão** que você marcou na aba Instalação.

Como o link só depende do id, o próprio bot consegue montá-lo:

```js
const { account } = await fetch(`${API}/auth/me`, { headers: { Authorization: TOKEN } }).then((r) => r.json());
console.log(`Me adicione: https://golive.nemtudo.me/bots/${account.id}/add`);
```

O perfil do bot no site (`golive.nemtudo.me/user/<usuario>`) também tem um botão **Adicionar a um grupo** que leva para a mesma página.

## 2. Quem gerencia o grupo adiciona

A pessoa abre o link, entra na conta dela (se ainda não estiver), escolhe um dos grupos em que tem a permissão **Gerenciar grupo** (o dono e os administradores têm) e clica em **Continuar**. Aparece a lista das permissões que o bot pede; ela pode desmarcar qualquer uma e clica em **Autorizar**.

O bot recebe no WebSocket:

```js
{ type: "group-added", groupId: "k2x9d0a1b3", addedBy: "a41c..." } // addedBy: quem adicionou
```

A partir daí ele é membro como qualquer outro. O [bot completo](/exemplos/bot-completo) avisa no terminal e, se ainda não estiver em nenhum grupo, mostra o próprio link ao iniciar. Tem também um script:

```bash
npm run link
# 🤖 DJ do Grupo (@musica_bot)
# ➕ Link para adicionar a um grupo: https://golive.nemtudo.me/bots/f3a9.../add
```

### Bot público ou privado

Na aba **Instalação** do portal:

| | Quem pode adicionar pelo link |
|---|---|
| **Público** (padrão) | qualquer pessoa que gerencia um grupo |
| **Privado** | só você, o dono do bot — nos grupos que você gerencia |

Use **privado** para um bot feito só para os seus grupos.

### Pela API

A página do site usa duas rotas, que também servem para quem quer automatizar:

<span class="http get">GET</span> `/bots/:idOuUsuario` — pública (a sessão é opcional). Devolve o bot, se ele é público, e — para uma pessoa logada — os grupos que ela gerencia, dizendo em quais o bot já está:

```js
{
  bot: { id, username, displayName, avatarUrl, bannerUrl, bio, flags, groupCount, createdAt },
  public: true,
  owner: false,        // quem pergunta é o dono do bot?
  canInstall: true,    // quem pergunta pode adicionar?
  signedIn: true,
  defaultPermissions: 6160, // as permissões padrão do bot (bitfield)
  groups: [ { id, name, iconUrl, memberCount, member: false, grantablePermissions: 67108863 } ]
}
```

`grantablePermissions` é o que **quem pergunta** consegue dar ao bot naquele grupo (bitfield).

<span class="http post">POST</span> `/groups/:id/bots` com `{ "botId": "...", "permissions": 6160 }` — adiciona o bot. `permissions` é opcional (sem ele, valem as padrão do bot). Exige o **token de sessão de uma pessoa** com **Gerenciar grupo** no grupo; um token de bot é recusado (um bot não adiciona outro).

| Status | Significado |
|---|---|
| `400` | `permissions` não é um bitfield válido. |
| `403` | Sem a permissão "Gerenciar grupo", bot privado (e você não é o dono), bot banido do grupo ou do GoLive, grupo cheio, ou o bot já está em 100 grupos. |
| `404` | Grupo não existe (ou você não é membro), ou bot não existe. |
| `423` | O grupo foi suspenso pela administração do GoLive. |

Se o bot já estiver no grupo, a resposta é a mesma (`{ groupId }`).

## O que o bot *não* consegue fazer

| Rota | Para um bot |
|---|---|
| <span class="http post">POST</span> `/invites/:code/accept` | `403`, `reason: "bot_self_join"` — sem gastar um uso do convite |
| <span class="http post">POST</span> `/groups/:id/join` (grupo público) | `403`, `reason: "bot_self_join"` |
| <span class="http post">POST</span> `/groups` (criar grupo) | `403` — bot não é dono de grupo |
| <span class="http post">POST</span> `/groups/:id/transfer` para o bot | `400` — um grupo não pode ser passado para um bot |

Transformar uma sala ao vivo em grupo também não leva o bot junto: ele fica de fora até alguém adicioná-lo.

`GET /invites/:code` continua funcionando — ele só mostra para onde um convite leva.

## 3. Permissões ao entrar

Ao entrar, o bot ganha um **cargo próprio**, com o nome dele, que guarda as permissões autorizadas — como o cargo de integração do Discord. Ele soma ao **@everyone**, como qualquer cargo.

- As permissões são as do `?permissions=` do link ou, sem ele, as **padrão** do portal.
- Quem adiciona só consegue dar permissões **que tem** (administradores e o dono podem todas). As outras chegam desligadas.
- O cargo entra logo **abaixo do cargo mais alto de quem adicionou** (no topo, se foi o dono).
- Depois, qualquer pessoa com **Gerenciar cargos** pode mudar o nome, as permissões e a posição desse cargo, como de qualquer outro.
- Mas ele **não pode ser dado a outra pessoa**, **nem tirado do bot**, **nem apagado** à mão (`403`). Ele some sozinho quando o bot sai do grupo.

No `GET /groups/:id`, esse cargo vem com `managedBy` = id do bot (os outros cargos vêm com `managedBy: null`).

O bot só consegue agir sobre quem tem cargo **abaixo** do dele — se precisar, suba o cargo dele na lista. Mais em [Permissões e cargos](./permissoes).

### O bitfield

Cada permissão é um bit, na ordem abaixo. Some os valores das que o bot precisa:

| Bit | Valor | Permissão | | Bit | Valor | Permissão |
|---|---|---|---|---|---|---|
| 0 | 1 | `administrator` | | 13 | 8192 | `sendImages` |
| 1 | 2 | `manageGroup` | | 14 | 16384 | `mentionMembers` |
| 2 | 4 | `manageChannels` | | 15 | 32768 | `mentionEveryone` |
| 3 | 8 | `manageRoles` | | 16 | 65536 | `addReactions` |
| 4 | 16 | `kickMembers` | | 17 | 131072 | `react` |
| 5 | 32 | `banMembers` | | 18 | 262144 | `connect` |
| 6 | 64 | `manageMessages` | | 19 | 524288 | `mic` |
| 7 | 128 | `manageReactions` | | 20 | 1048576 | `screen` |
| 8 | 256 | `createInvites` | | 21 | 2097152 | `camera` |
| 9 | 512 | `manageWebhooks` | | 22 | 4194304 | `videoSource` |
| 10 | 1024 | `viewChannel` | | 23 | 8388608 | `chat` |
| 11 | 2048 | `sendMessages` | | 24 | 16777216 | `gif` |
| 12 | 4096 | `sendGifs` | | 25 | 33554432 | `image` |

```js
const BITS = { kickMembers: 16, manageMessages: 64, sendMessages: 2048 };
const permissions = BITS.kickMembers | BITS.manageMessages | BITS.sendMessages; // 2128
console.log(`https://golive.nemtudo.me/bots/${account.id}/add?permissions=${permissions}`);
```

A aba **Instalação** do portal monta esse número para você.

## Descobrindo grupos e salas

<span class="http get">GET</span> `/groups` — os grupos em que o bot está:

```js
const { groups } = await fetch(`${API}/groups`, { headers: { Authorization: TOKEN } }).then((r) => r.json());
for (const g of groups) console.log(g.id, g.name, g.memberCount);
```

<span class="http get">GET</span> `/groups/:id` — tudo sobre um grupo: salas, cargos, quem tem qual cargo e o que o próprio bot pode fazer:

```js
const data = await fetch(`${API}/groups/k2x9d0a1b3`, { headers: { Authorization: TOKEN } }).then((r) => r.json());

const textRooms = data.channels.filter((c) => c.kind === "text");
console.log(textRooms.map((c) => `#${c.name} (${c.id})`));

console.log(data.me.permissions.manage.kickMembers); // o bot pode expulsar?
```

::: tip Pegando ids pelo navegador
A URL de uma sala no site é `golive.nemtudo.me/groups/<groupId>/<channelId>`. Abra a sala e copie da barra de endereço.
:::

A aba **Instalação** do portal também lista os grupos em que o bot está.

## Saindo de um grupo

<span class="http post">POST</span> `/groups/:id/leave` (corpo `{}`). Para voltar, alguém do grupo precisa adicionar o bot de novo.

## Sendo removido

Quando o bot sai, é expulso, banido ou o grupo é apagado, o WebSocket recebe:

```js
{ type: "group-removed", groupId: "k2x9d0a1b3", reason: "kicked" } // "left" | "kicked" | "banned" | "deleted"
```

E sempre que algo muda num grupo (nome, salas, cargos, alguém entrou ou saiu):

```js
{ type: "group-updated", groupId: "k2x9d0a1b3" }
```

Esse evento não diz *o que* mudou — se o seu bot guarda dados do grupo em cache, descarte e busque de novo com `GET /groups/:id`.

## Limites

| | |
|---|---|
| Grupos por conta (bot incluso) | 100 |
| Adicionar bot (`POST /groups/:id/bots`) | 20 por minuto |
