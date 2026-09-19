# Entrar com GoLive (OAuth2)

Deixe que as pessoas entrem no **seu** site com a conta do GoLive, do mesmo jeito que existe "entrar com o Discord" ou "entrar com o Google".

Quem pede o acesso é o **seu bot**: ele é o aplicativo. O id do bot é o `client_id`, e o nome, a foto e a bio dele são o que a pessoa vê na tela de consentimento. Não existe uma "aplicação" separada para manter em dia.

::: tip Usa uma biblioteca de OIDC?
Se você integra com NextAuth, Passport, Keycloak ou parecidos, pule direto para [OpenID Connect](./openid-connect): é só apontar a biblioteca para o issuer. Esta página é o fluxo por baixo, para quem escreve a integração na mão.
:::

::: tip Isto não é sobre bots em grupos
O token de bot (`Authorization: Bot ...`) é o bot agindo como ele mesmo. O OAuth2 é o seu site agindo **em nome de outra pessoa**, só dentro do que ela autorizou. São duas credenciais diferentes e nenhuma funciona no lugar da outra.
:::

## 1. Crie as credenciais

No [portal do desenvolvedor](https://golive.nemtudo.me/developers), abra o seu bot e vá em **OAuth2**:

1. **Criar aplicação OAuth2**. Você recebe o `client_secret` **uma única vez** — guarde num lugar seguro, ele não aparece de novo.
2. Cadastre pelo menos uma **URL de redirecionamento** — para onde o GoLive devolve a pessoa depois do consentimento.
3. Use o **gerador de URL** para montar o link de login com os escopos que você precisa.

::: warning A URL de redirecionamento é comparada por igualdade exata
`https://seusite.com/callback` e `https://seusite.com/callback/` são endereços diferentes. Cadastre exatamente o que o seu servidor usa, barra final incluída.

`http://` só é aceito em `localhost` (e `127.0.0.1`), para você testar na sua máquina. Em qualquer outro lugar, `https://`.
:::

## 2. Mande a pessoa para a tela de consentimento

```
https://golive.nemtudo.me/oauth2/authorize
  ?client_id=SEU_CLIENT_ID
  &response_type=code
  &redirect_uri=https%3A%2F%2Fseusite.com%2Fcallback
  &scope=identify%20email
  &state=UM_VALOR_ALEATORIO
```

| Parâmetro | Obrigatório | O que é |
|---|---|---|
| `client_id` | sim | O id do seu bot. |
| `response_type` | sim | Sempre `code`. |
| `redirect_uri` | sim | Uma das URLs cadastradas, escrita igualzinho. |
| `scope` | sim | Escopos separados por espaço (veja abaixo). |
| `state` | recomendado | Um valor aleatório seu, devolvido igual no redirect. |
| `code_challenge` | não | PKCE — veja [mais abaixo](#pkce). |
| `nonce` | não | Só com `openid`. Volta dentro do `id_token` — veja [OpenID Connect](./openid-connect#nonce). |

::: tip Use `state` sempre
Gere um valor aleatório, guarde na sessão do visitante e **compare** quando ele voltar. É o que impede alguém de forçar um login que não foi pedido por aquela pessoa (CSRF).
:::

Se a pessoa autorizar, o GoLive devolve ela para a sua `redirect_uri` com o código:

```
https://seusite.com/callback?code=abc123...&state=UM_VALOR_ALEATORIO
```

Se ela recusar (ou algo estiver errado no pedido), volta com um erro no lugar do código:

```
https://seusite.com/callback?error=access_denied&error_description=...&state=...
```

::: warning Quando a pessoa **não** volta
Se o `client_id` não existir, ou a `redirect_uri` não estiver cadastrada, o GoLive **não** redireciona: mostra o erro na própria tela. Devolver alguém para um endereço que ninguém cadastrou é exatamente como um código de autorização vaza.
:::

## 3. Troque o código por um token

No **seu servidor** — nunca no navegador, porque isto usa o `client_secret`:

```js
const res = await fetch("https://apigolive.nemtudo.me/oauth2/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: process.env.GOLIVE_CLIENT_ID,
    client_secret: process.env.GOLIVE_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: "https://seusite.com/callback",
  }),
});

const token = await res.json();
// {
//   access_token: "eyJhbGciOi...",
//   token_type: "Bearer",
//   expires_in: 604800,
//   refresh_token: "N2QzZjhh....xk9...",
//   scope: "identify email"
// }
```

O código vale **10 minutos** e só pode ser trocado **uma vez**. Uma segunda tentativa com o mesmo código responde `400 invalid_grant`, mesmo que a primeira tenha falhado.

## 4. Use o token

```js
const res = await fetch("https://apigolive.nemtudo.me/users/@me", {
  headers: { Authorization: `Bearer ${token.access_token}` },
});
const user = await res.json();

console.log(user.id, user.username, user.displayName);
```

::: warning `Bearer`, não `Bot`
Aqui é o contrário da [autenticação do bot](./autenticacao): um access token de OAuth2 vai como `Bearer`. E ele **não** serve para as rotas de bot — só para as rotas listadas na [referência de OAuth2](/referencia/oauth2).
:::

## Escopos

Peça só o que o seu site realmente usa. Cada escopo a mais é uma linha a mais na tela de consentimento, e um motivo a mais para a pessoa desistir.

| Escopo | O que libera |
|---|---|
| `openid` | Liga o [OpenID Connect](./openid-connect): a resposta do token ganha um `id_token` assinado e `/oauth2/userinfo` passa a responder. |
| `identify` | `GET /users/@me` sem o e-mail. **Sempre incluído**, mesmo que você não peça. |
| `email` | Acrescenta `email` e `emailVerified` ao `GET /users/@me`. |
| `groups` | `GET /users/@me/groups` — os grupos de que a pessoa participa. |
| `friends` | `GET /users/@me/friends` — as amizades **já aceitas**. Pedidos pendentes nunca aparecem. |

Um escopo que o GoLive não conhece é **ignorado**, não recusado: uma URL copiada de um tutorial antigo continua abrindo a tela de consentimento, só que sem aquele item.

## Renovando o token

O access token vale **7 dias** (`expires_in`, em segundos). Para continuar sem mandar a pessoa autorizar de novo:

```js
const res = await fetch("https://apigolive.nemtudo.me/oauth2/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: process.env.GOLIVE_CLIENT_ID,
    client_secret: process.env.GOLIVE_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: guardado.refresh_token,
  }),
});
```

::: warning O refresh token **muda** a cada uso
Cada renovação devolve um `refresh_token` novo e mata o anterior na hora. Guarde sempre o último que você recebeu — se você reusar o antigo, a resposta é `400 invalid_grant`.
:::

O refresh token não expira sozinho. Ele acaba quando a pessoa remove o acesso, ou quando você apaga a aplicação.

## Descobrindo o que um token é

<span class="http get">GET</span> `/oauth2/@me` responde qual aplicação, quais escopos e de quem é o token — é a chamada para saber se aquele token guardado no cookie ainda vale:

```js
const res = await fetch("https://apigolive.nemtudo.me/oauth2/@me", {
  headers: { Authorization: `Bearer ${accessToken}` },
});
if (res.status === 401) {
  // Expirado, ou a pessoa removeu o acesso. Mande autorizar de novo.
}
```

## Encerrando o acesso

Quando alguém sai do seu site, devolva o token:

```js
await fetch("https://apigolive.nemtudo.me/oauth2/token/revoke", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: process.env.GOLIVE_CLIENT_ID,
    client_secret: process.env.GOLIVE_CLIENT_SECRET,
    token: accessToken,
  }),
});
```

A pessoa também pode remover o acesso sozinha, em **Aplicativos conectados**, na conta dela no GoLive. Nos dois casos o access token e o refresh token param de funcionar na hora.

## PKCE

Se o seu aplicativo não consegue guardar um segredo — um app de celular, uma página que roda só no navegador — use **PKCE** além do `client_secret`:

1. Gere um `code_verifier` aleatório (43 a 128 caracteres) e guarde.
2. Mande `code_challenge` = base64url(sha256(verifier)) e `code_challenge_method=S256` na URL de autorização.
3. Mande o `code_verifier` junto na troca do código por token.

```js
import { createHash, randomBytes } from "node:crypto";

const codeVerifier = randomBytes(32).toString("base64url");
const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
```

Só `S256` é aceito. `plain` deixaria o verificador no mesmo lugar em que o código já está, o que não protege de nada.

## Testando sem navegador

Para experimentar as rotas antes de montar a tela de login, o `client_credentials` devolve um token **da sua própria conta** (a dona do bot), sem tela de consentimento:

```bash
curl -X POST https://apigolive.nemtudo.me/oauth2/token \
  -d "client_id=$GOLIVE_CLIENT_ID" \
  -d "client_secret=$GOLIVE_CLIENT_SECRET" \
  -d "grant_type=client_credentials" \
  -d "scope=identify groups"
```

Não vem `refresh_token`: gerar outro é uma requisição só, com o secret que você já tem.

## Erros

As respostas seguem o padrão do OAuth2: `{ "error": "...", "error_description": "..." }` — e não o `{ "error": "mensagem" }` do resto da API, porque é isso que as bibliotecas de OAuth2 sabem ler.

| `error` | Quando |
|---|---|
| `invalid_client` | `client_id` desconhecido, ou `client_secret` errado. |
| `invalid_token` | Access token inválido, expirado ou revogado (`401`, nas rotas de recurso). |
| `invalid_grant` | Código expirado, já usado, de outra aplicação, `redirect_uri` diferente, ou refresh token morto. |
| `invalid_request` | Falta um campo, ou a `redirect_uri` não está cadastrada. |
| `invalid_scope` | Nenhum escopo conhecido foi pedido. |
| `unsupported_response_type` | `response_type` diferente de `code`. |
| `unsupported_grant_type` | `grant_type` que não é um dos três. |
| `access_denied` | A pessoa recusou, ou o token não tem o escopo daquela rota (`403`). |

A lista completa de rotas, campos e respostas está em [Referência → OAuth2](/referencia/oauth2).
