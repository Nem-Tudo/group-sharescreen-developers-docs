# Permissões e cargos

O GoLive usa o mesmo modelo do Discord. Entender ele evita a maior parte dos `403` — e evita uma falha de segurança séria em bots de moderação.

## Como a permissão é calculada

Para saber se alguém pode fazer algo, a API olha, nesta ordem:

1. **Dono do grupo?** → pode tudo.
2. **Tem `administrator`** (no @everyone ou em algum cargo)? → pode tudo, em todas as salas.
3. Senão, a permissão precisa estar ligada no **@everyone** *ou* em **algum cargo** da pessoa. Cargos só **somam**: um cargo com a permissão desligada não tira nada.
4. Para permissões de sala (texto e voz), a **sala** pode sobrescrever: ligar ou desligar para o @everyone e para cada cargo.

As permissões de **gerenciamento** (`kickMembers`, `banMembers`, `manageMessages`...) valem para o grupo todo e nunca mudam por sala.

A lista completa está na [referência de permissões](/referencia/permissoes).

## Hierarquia

Cada cargo tem uma **posição** (`position`: 1 é o mais baixo). A posição de uma pessoa é a do seu cargo mais alto; o dono está acima de todos.

Você só pode **expulsar, banir, editar ou dar cargos** para quem/o que está **abaixo** da sua posição. Isso vale para o bot:

::: warning Coloque o cargo do bot no alto
Um bot com `kickMembers` mas com cargo abaixo do "Moderação" não consegue expulsar um moderador — nem ninguém do mesmo nível que ele. Nas configurações do grupo, arraste o cargo do bot para cima dos cargos que ele deve gerenciar.
:::

## Duas perguntas diferentes

Um bot de moderação precisa responder duas perguntas antes de agir:

| Pergunta | Quem responde |
|---|---|
| **O bot** pode expulsar essa pessoa? | A **API**. Se não puder, a rota responde `403`. |
| **Quem digitou o comando** pode expulsar alguém? | **O seu código.** A API não sabe quem pediu — para ela, quem está expulsando é o bot. |

::: danger Não pule a segunda checagem
Se o `!expulsar` não confere a permissão de quem o usou, **qualquer membro** passa a expulsar qualquer um, usando os poderes do bot. É a falha mais comum em bots de moderação.
:::

## Lendo as permissões

<span class="http get">GET</span> `/groups/:id` traz tudo o que é preciso:

```js
const data = await api("GET", `/groups/${groupId}`);

data.group.ownerId;      // o dono
data.group.permissions;  // as do @everyone
data.group.roles;        // [{ id, name, color, position, permissions, ... }], do mais alto ao mais baixo
data.memberRoles;        // { [userId]: [roleId, ...] } — só quem tem algum cargo
data.me.permissions;     // o que O BOT pode fazer, já calculado
data.me.rank;            // a posição do bot (-1 se ele fosse o dono)
data.channels;           // cada sala com permissions/roleOverrides
```

Cada conjunto de permissões tem quatro seções:

```js
{
  manage:  { administrator, manageGroup, manageChannels, manageRoles, kickMembers, banMembers, manageMessages, manageReactions, createInvites, manageWebhooks },
  general: { viewChannel, useCustomEmojis, useExternalEmojis },
  text:    { sendMessages, sendGifs, sendImages, mentionMembers, mentionEveryone, addReactions, react },
  voice:   { connect, mic, screen, camera, videoSource, chat, gif, image }
}
```

### O que o próprio bot pode fazer

Já vem calculado em `me.permissions`:

```js
const { me } = await api("GET", `/groups/${groupId}`);
if (!me.permissions.manage.kickMembers) {
  console.warn("Dê ao bot um cargo com 'Expulsar membros' para o !expulsar funcionar.");
}
```

### Checando a permissão de quem usou o comando

Refazendo a conta da API para outra pessoa, com os dados do mesmo `GET /groups/:id`:

<<< @/../examples/bot-completo/src/golive/permissions.js

```js
const data = await api("GET", `/groups/${message.groupId}`);
if (!hasPermission(data, message.author.id, "kickMembers")) {
  return message.reply("🚫 Você não tem permissão para usar este comando.");
}
// e, para dar uma mensagem melhor que o 403 da API:
if (rankOf(data, targetId) >= rankOf(data, message.author.id)) {
  return message.reply("🚫 Essa pessoa tem cargo igual ou acima do seu.");
}
```

::: tip Cache
`GET /groups/:id` é chamado a cada comando de moderação. Guarde a resposta por um minuto e jogue fora quando chegar `{ type: "group-updated", groupId }` — é o que o `GoLiveClient.fetchGroup` do [bot completo](/exemplos/bot-completo) faz.
:::

## O cargo do próprio bot

Todo bot ganha, ao entrar num grupo, um cargo com o nome dele e as permissões autorizadas por quem o adicionou (veja [Colocando o bot num grupo](./entrando-em-grupos#_3-permissoes-ao-entrar)). Ele vem com `managedBy` igual ao id do bot. Esse cargo pode ser editado e reordenado, mas não pode ser dado a outra pessoa, tirado do bot ou apagado — e some quando o bot sai.

```js
const myRole = data.roles.find((r) => r.managedBy === BOT_ID);
```

## Gerenciando cargos pelo bot

Com `manageRoles`, o bot cria, edita e distribui cargos — sempre abaixo do próprio cargo, e só ligando permissões que ele mesmo tem.

| Ação | Rota |
|---|---|
| Criar cargo | <span class="http post">POST</span> `/groups/:id/roles` — `{ name, color, hoist, mentionable, permissions }` |
| Editar cargo | <span class="http patch">PATCH</span> `/groups/:id/roles/:roleId` — mesmos campos |
| Apagar cargo | <span class="http delete">DELETE</span> `/groups/:id/roles/:roleId` |
| Reordenar | <span class="http put">PUT</span> `/groups/:id/roles/order` — `{ ids: [...] }`, do mais alto ao mais baixo |
| Cargos de um membro | <span class="http put">PUT</span> `/groups/:id/members/:userId/roles` — `{ roleIds: [...] }` |

```js
// Cria um cargo "Silenciado" que não pode escrever (as permissões de um cargo começam desligadas)
const { role } = await api("POST", `/groups/${groupId}/roles`, {
  name: "Silenciado",
  color: "#6b7280",
  hoist: false,
  mentionable: false,
});
```

::: warning `PUT .../roles` substitui a lista inteira
Mande **todos** os cargos que a pessoa deve ter, não só o novo. Leia os atuais em `memberRoles[userId]`, adicione ou remova, e envie. Cargos acima do bot ficam como estavam, independentemente do que for enviado.

Um cargo com `managedBy` não entra nessa conta: mandá-lo para outra pessoa, ou tirá-lo do próprio bot, dá `403`. `DELETE` num cargo desses também dá `403`.
:::

## Permissões por sala

<span class="http put">PUT</span> `/groups/:id/channels/:cid/permissions` (exige `manageChannels`) define as exceções de uma sala, para o @everyone ou para um cargo:

```js
// Sala de anúncios: ninguém escreve, só reage
await api("PUT", `/groups/${groupId}/channels/${channelId}/permissions`, {
  permissions: { sendMessages: false, react: true },
});

// ...exceto o cargo "Equipe"
await api("PUT", `/groups/${groupId}/channels/${channelId}/permissions`, {
  roleId: equipeRoleId,
  permissions: { sendMessages: true },
});
```

A chave omitida (ou `null`) volta a herdar do grupo. Cada chamada substitui todas as exceções daquele alvo na sala.
