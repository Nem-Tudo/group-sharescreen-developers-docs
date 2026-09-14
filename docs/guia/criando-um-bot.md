# Criando seu bot

Todo bot pertence a uma conta de pessoa — a sua. Você cria e gerencia os seus bots no **portal do desenvolvedor**:

**https://golive-developers.nemtudo.me**

## Pelo portal (o jeito normal)

1. Abra o [portal do desenvolvedor](https://golive-developers.nemtudo.me) e entre com a sua conta do GoLive — a mesma do site (usuário e senha, Discord ou Google). No site, o menu da conta também tem o atalho **Portal do desenvolvedor**.
2. Clique em **Novo bot** e preencha:
   - **Usuário do bot** — só letras minúsculas, números e `_`, até 16 caracteres. O `_bot` do final é colocado sozinho: digitando `musica`, o bot vira `@musica_bot`. **Não dá para mudar depois.**
   - **Nome de exibição** — como o nome aparece nas conversas (até 24 caracteres). Opcional: vazio, usa o usuário sem o `_bot`.
3. Confirme que o bot segue os termos de uso e clique em **Criar bot**.
4. O portal abre a aba **Token** do bot, com o token à mostra. **Copie e guarde agora** — ele não aparece de novo.

O texto copiado já vem no formato certo para usar: `Bot ` seguido do token.

```
Bot ZjNhOWMxZTItOGI0ZC00YjE3LTk5YzUtM2Q2ZTFhMGI3YzQ1.q8Xr3...
```

::: danger O token é a senha do bot
Quem tiver o token controla o bot: fala por ele, modera com os cargos dele, lê as DMs dele. Nunca publique o token, nunca o coloque no código que vai para o GitHub, nunca mande em print. Veja [como guardar com segurança](./autenticacao#guardando-o-token-com-seguranca).
:::

## O que o portal tem

Cada bot tem três abas:

| Aba | O que dá para fazer |
|---|---|
| **Informações gerais** | Nome de exibição, descrição, avatar, banner, fundo em degradê e música do perfil — com prévia ao vivo. Também é onde se **exclui** o bot. |
| **Token** | Ver o token recém-criado (uma vez só), **gerar um novo** e copiar o ID do bot. |
| **Instalação** | O **link para adicionar o bot a um grupo**, a opção **bot público/privado** e a lista dos grupos em que o bot está. |

Bots têm todos os extras de perfil (imagem própria, banner, degradê, música) **sem precisar de plano** — veja [Perfil do bot](./perfil-do-bot).

## Regras e limites

| Regra | Valor |
|---|---|
| Bots por conta | **10** |
| Tamanho do usuário | até 16 caracteres + `_bot` (letras, números e `_`) |
| Tamanho do nome de exibição | até 24 caracteres |
| Quem pode criar | qualquer conta registrada e não banida |
| Bot pode criar bot? | **Não** |

O usuário do bot divide o espaço de nomes com as pessoas: se `@musica_bot` já existe, escolha outro.

## Perdi o token / o token vazou

Na aba **Token**, clique em **Gerar novo token** e confirme.

- O token novo aparece uma única vez, como na criação.
- O token antigo **para de funcionar na hora**, em todo lugar. Se o bot estiver conectado com ele, o WebSocket é fechado com o código **4004** — não adianta reconectar, troque pelo token novo.

É assim que se revoga um token vazado: gerando outro.

## Excluindo o bot

Na aba **Informações gerais**, no fim da página, **Excluir bot** (é preciso digitar o usuário do bot para confirmar). O bot sai de todos os grupos, é desconectado (código **4004**), o token para de funcionar e o usuário fica livre para outro bot. Não dá para desfazer.

Um bot que é **dono** de um grupo não pode ser excluído: transfira a posse do grupo antes. (Bots criados agora não podem ter grupos, mas bots antigos podem.)

## Pela API (avançado)

As mesmas ações existem na API, para quem quer automatizar. Elas exigem o **token de sessão de uma pessoa** (`Authorization: Bearer <jwt>`) — **nunca** um token de bot. Assim um token de bot vazado não consegue criar mais bots, mexer nos outros bots da conta nem trocar o próprio token.

| Ação | Rota | Limite |
|---|---|---|
| Listar meus bots | <span class="http get">GET</span> `/account/bots` | 60/min |
| Criar bot | <span class="http post">POST</span> `/account/bots` | 5 a cada 15 min |
| Ver um bot e seus grupos | <span class="http get">GET</span> `/account/bots/:id` | 120/min |
| Editar perfil / público | <span class="http patch">PATCH</span> `/account/bots/:id` | 30/min |
| Gerar novo token | <span class="http post">POST</span> `/account/bots/:id/token` | 10 a cada 5 min |
| Excluir bot | <span class="http delete">DELETE</span> `/account/bots/:id` | 10 a cada 5 min |

```js
const API = "https://apigolive.nemtudo.me";
const SESSION = process.env.GOLIVE_SESSION; // o JWT de uma conta de pessoa

// Criar um bot
const res = await fetch(`${API}/account/bots`, {
  method: "POST",
  headers: { Authorization: `Bearer ${SESSION}`, "Content-Type": "application/json" },
  body: JSON.stringify({ username: "musica", displayName: "DJ do Grupo" }),
});
const { bot, token } = await res.json();
console.log(bot.username); // "musica_bot"
console.log(token);        // o token, SEM o prefixo "Bot " — guarde!
```

O `PATCH /account/bots/:id` aceita os mesmos campos do [`PATCH /account/profile`](./perfil-do-bot#editando-o-perfil) (`displayName`, `bio`, `avatar`, `banner`, `profileTheme`, `song`, `songVolume`) e mais `public` (`true`/`false`).

Respostas:

```js
// GET /account/bots
{ "bots": [ /* Bot */ ], "max": 10 }

// POST /account/bots
{ "bot": { /* Bot */ }, "token": "ZjNh...q8Xr3" }

// GET /account/bots/:id
{ "bot": { /* Bot */ }, "groups": [ { "id", "name", "iconUrl", "memberCount" } ] }

// PATCH /account/bots/:id
{ "bot": { /* Bot */ } }

// POST /account/bots/:id/token
{ "token": "ZjNh...N7wP1" }

// DELETE /account/bots/:id  →  204, sem corpo
```

O objeto **Bot** é o [Account](/referencia/objetos) do bot com mais dois campos, que só o dono vê: `public` (qualquer pessoa que gerencia um grupo pode adicioná-lo) e `ownerId`.

Erros possíveis: `400` (usuário ou campo inválido), `401` (não é sessão de pessoa), `403` (conta banida), `404` (bot não existe ou não é seu), `409` (nome em uso, já tem 10 bots, ou o bot é dono de um grupo e não pode ser excluído).

## Próximo passo

Com o token em mãos, veja [como autenticar](./autenticacao).
