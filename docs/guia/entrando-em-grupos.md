# Colocando o bot num grupo

Um bot entra num grupo do mesmo jeito que uma pessoa: **por um convite** ou, se o grupo for público, **entrando direto**. A diferença é que quem "clica" é o seu código.

## 1. Crie um convite no grupo

No grupo, quem tem permissão de criar convites (o dono, por padrão) gera um link de convite pela interface do GoLive. Ele tem esta cara:

```
https://golive.nemtudo.me/invite/AbC12345
```

O que importa é o **código** do final: `AbC12345`. Grupos com link personalizado também servem (`/invite/meugrupo` → código `meugrupo`).

::: tip Convite de uso único
Para o bot, um convite que expira em 30 minutos e vale para 1 uso é o mais seguro — ninguém mais aproveita o link.
:::

## 2. Faça o bot aceitar o convite

<span class="http post">POST</span> `/invites/:code/accept`

```js
const API = "https://apigolive.nemtudo.me";
const TOKEN = process.env.GOLIVE_TOKEN;

const res = await fetch(`${API}/invites/AbC12345/accept`, {
  method: "POST",
  headers: { Authorization: TOKEN, "Content-Type": "application/json" },
  body: "{}",
});
const data = await res.json();
if (!res.ok) throw new Error(data.error);
console.log("Entrei no grupo", data.groupId);
```

Se o bot já estiver no grupo, a resposta é a mesma (`{ groupId }`) e nenhum uso do convite é gasto.

Quer ver para onde o convite leva antes de aceitar? <span class="http get">GET</span> `/invites/:code` devolve o nome do grupo, quantos membros tem e se o bot já é membro:

```js
const preview = await fetch(`${API}/invites/AbC12345`, { headers: { Authorization: TOKEN } })
  .then((r) => r.json());
// { invite: { code, state: "ok", expiresAt }, group: { id, name, memberCount, ... }, member: false }
```

O [bot completo](/exemplos/bot-completo) tem um script pronto para isso:

```bash
npm run entrar -- https://golive.nemtudo.me/invite/AbC12345
```

### Erros ao aceitar

| Status | Significado |
|---|---|
| `404` | Convite não existe. |
| `410` | Convite expirado, revogado ou esgotado (`state` diz qual). |
| `403` | O bot foi banido do grupo, o grupo está cheio, ou o bot já está em 100 grupos. |
| `423` | O grupo foi suspenso pela administração do GoLive. |

## Grupos públicos: entrando sem convite

Um grupo público pode ser acessado direto pelo id:

<span class="http post">POST</span> `/groups/:id/join`

```js
await fetch(`${API}/groups/k2x9d0a1b3/join`, {
  method: "POST",
  headers: { Authorization: TOKEN, "Content-Type": "application/json" },
  body: "{}",
});
```

Para achar grupos públicos: <span class="http get">GET</span> `/groups/search?q=nome`.

## 3. Dê um cargo ao bot

Ao entrar, o bot tem só as permissões do **@everyone** — em geral, ver as salas, escrever e reagir. Para moderar (apagar mensagens dos outros, expulsar, banir, distribuir cargos) ele precisa de um **cargo** com essas permissões.

Nas configurações do grupo, na aba de cargos: crie um cargo (ex.: "Bot") com as permissões necessárias e dê ao bot. Lembre que o bot só consegue agir sobre quem tem cargo **abaixo** do dele — por isso deixe o cargo do bot alto na lista. Mais em [Permissões e cargos](./permissoes).

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

## Saindo de um grupo

<span class="http post">POST</span> `/groups/:id/leave` (corpo `{}`).

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
| Convites ativos por grupo | 50 |
