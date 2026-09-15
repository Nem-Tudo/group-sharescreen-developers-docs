# OAuth2

Rotas de **Entrar com GoLive** — o seu site agindo em nome de uma pessoa. O guia passo a passo está em [Entrar com GoLive](/guia/oauth2).

```
https://apigolive.nemtudo.me
```

- A tela de consentimento fica no site: `https://golive.nemtudo.me/oauth2/authorize`. A API responde o mesmo caminho com um `302` para lá, então os dois endereços servem.
- `/oauth2/token` e `/oauth2/token/revoke` aceitam **`application/x-www-form-urlencoded`** (o padrão do OAuth2) e também JSON. As credenciais do cliente podem ir no corpo ou em `Authorization: Basic base64(client_id:client_secret)`.
- As rotas de recurso usam `Authorization: Bearer <access_token>`.
- Erros seguem o formato `{ "error": "...", "error_description": "..." }` — veja a [tabela no guia](/guia/oauth2#erros).
- Sem MongoDB configurado no servidor, todas respondem `503 temporarily_unavailable`.

## Índice de rotas

| Método | Rota | O que faz | Autenticação | Limite |
|---|---|---|---|---|
| <span class="http get">GET</span> | [`/oauth2/authorize`](#get-oauth2-authorize) | `302` para a tela de consentimento. | — | 60 |
| <span class="http post">POST</span> | [`/oauth2/token`](#post-oauth2-token) | Código, refresh ou client credentials → token. | cliente | 60 |
| <span class="http post">POST</span> | [`/oauth2/token/revoke`](#post-oauth2-token-revoke) | Devolve um token. | cliente | 60 |
| <span class="http get">GET</span> | [`/oauth2/@me`](#get-oauth2-me) | O que este token é. | `Bearer` | 120 |
| <span class="http get">GET</span> | [`/users/@me`](#get-users-me) | O perfil de quem autorizou. | `Bearer` + `identify` | 120 |
| <span class="http get">GET</span> | [`/users/@me/groups`](#get-users-me-groups) | Os grupos dessa pessoa. | `Bearer` + `groups` | 60 |
| <span class="http get">GET</span> | [`/users/@me/friends`](#get-users-me-friends) | As amizades aceitas dessa pessoa. | `Bearer` + `friends` | 60 |
| <span class="http get">GET</span> | [`/oauth2/openid-configuration`](#openid-connect) | O documento de descoberta OIDC. **Pública.** | — | 120 |
| <span class="http get">GET</span> | [`/.well-known/openid-configuration`](#openid-connect) | `308` para o issuer (o site). **Pública.** | — | 120 |
| <span class="http get">GET</span> | [`/.well-known/jwks.json`](#openid-connect) | Chave pública dos `id_token`. **Pública.** | — | 120 |
| <span class="http get">GET</span> <span class="http post">POST</span> | [`/oauth2/userinfo`](#openid-connect) | Os claims padrão do OIDC. | `Bearer` + `openid` | 120 |

E, para a pessoa administrar o que autorizou (**sessão de pessoa**, não token de OAuth2 — um aplicativo nunca alcança a rota que tira o acesso dele):

| Método | Rota | O que faz | Limite |
|---|---|---|---|
| <span class="http get">GET</span> | `/account/authorizations` | Aplicativos que essa conta autorizou. | 60 |
| <span class="http delete">DELETE</span> | `/account/authorizations/:clientId` | Remove o acesso de um aplicativo. | 30 |

## GET /oauth2/authorize

Redireciona (`302`) para `https://golive.nemtudo.me/oauth2/authorize` com a mesma query. Existe para que o endereço que você guarda no código seja da API, como todos os outros.

Query: `client_id`, `response_type=code`, `redirect_uri`, `scope`, `state`, `code_challenge`, `code_challenge_method`, `nonce`.

## POST /oauth2/token

Corpo em `application/x-www-form-urlencoded`. Sempre exige as credenciais do cliente (corpo ou `Basic`).

### `grant_type=authorization_code`

| Campo | Obrigatório | O que é |
|---|---|---|
| `code` | sim | O código que chegou na `redirect_uri`. Vale 10 min, uma vez só. |
| `redirect_uri` | sim | Exatamente a mesma usada para pedir o código. |
| `code_verifier` | se usou PKCE | O verificador de onde saiu o `code_challenge`. |

### `grant_type=refresh_token`

| Campo | Obrigatório | O que é |
|---|---|---|
| `refresh_token` | sim | O último recebido. Cada uso devolve um novo e mata o anterior. |

### `grant_type=client_credentials`

| Campo | Obrigatório | O que é |
|---|---|---|
| `scope` | não | Escopos para o token. `identify` entra sempre. |

Não vem `id_token` aqui, mesmo pedindo `openid`: não houve login de ninguém para atestar.

Devolve um token da conta **dona do bot**, sem tela de consentimento e sem `refresh_token`.

### Resposta

```json
{
  "access_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 604800,
  "refresh_token": "N2QzZjhh...",
  "scope": "openid identify email",
  "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
}
```

`refresh_token` não vem no `client_credentials`. `expires_in` é em segundos (7 dias). `id_token` só aparece quando o escopo `openid` foi concedido — veja [OpenID Connect](/guia/openid-connect).

## POST /oauth2/token/revoke

Corpo: `{ token }`, mais as credenciais do cliente. Aceita access token ou refresh token — os dois acabam com a autorização inteira daquela pessoa naquele aplicativo.

Responde `200 { "ok": true }` **mesmo quando não havia nada para revogar**, como manda a RFC 7009: uma resposta diferente para "esse token existia" transformaria esta rota num jeito de testar tokens.

## GET /oauth2/@me

```json
{
  "application": {
    "id": "f3a9c1e2-...",
    "username": "musica_bot",
    "displayName": "DJ do Grupo",
    "avatarUrl": "https://...",
    "bio": "...",
    "bot": true,
    "owner": { "id": "...", "username": "ana", "displayName": "Ana" }
  },
  "scopes": ["identify", "email"],
  "user": { "id": "...", "username": "ana", "...": "..." }
}
```

`401` quando o token expirou, não existe ou foi revogado — é a chamada para conferir um token guardado.

## GET /users/@me

Escopo: `identify`.

```json
{
  "id": "0b1c...",
  "username": "ana",
  "displayName": "Ana",
  "avatarUrl": "https://...",
  "bannerUrl": null,
  "bio": null,
  "flags": [],
  "features": ["profile_gradient"],
  "bot": false,
  "createdAt": 1737600000000
}
```

Com o escopo `email`, a resposta ganha `email` (que pode ser `null`) e `emailVerified`.

`features` é o que a conta pode fazer agora — a forma honesta de perguntar "esta pessoa assina o Pro" sem o seu site ter que acompanhar nomes de plano.

::: warning `/users/@me` e `/users/:id` são rotas diferentes
`/users/:id` é pública e devolve o perfil de qualquer conta. `/users/@me` precisa do access token e devolve a conta que autorizou o seu aplicativo.
:::

## GET /users/@me/groups

Escopo: `groups`.

```json
{
  "groups": [
    { "id": "...", "name": "Sala da Ana", "iconUrl": null, "memberCount": 42, "owner": true }
  ]
}
```

## GET /users/@me/friends

Escopo: `friends`. Só amizades **aceitas** — um pedido pendente é um fato sobre alguém que ainda não respondeu, e não é da pessoa autorizada compartilhar.

```json
{
  "friends": [
    { "id": "...", "username": "bia", "displayName": "Bia", "avatarUrl": null, "bot": false, "since": 1737600000000 }
  ]
}
```

## Rotas do dono da aplicação

Criadas e administradas pelo portal do desenvolvedor, com a **sessão de pessoa** do dono do bot — nunca com o token do bot, para que um token vazado não consiga criar um `client_secret` nem cadastrar um redirect próprio.

| Método | Rota | O que faz | Limite |
|---|---|---|---|
| <span class="http get">GET</span> | `/account/bots/:id/oauth2` | A aplicação do bot (ou `app: null`), escopos disponíveis e limites. | 60 |
| <span class="http post">POST</span> | `/account/bots/:id/oauth2` | Cria a aplicação. Devolve o `secret` **uma única vez**. | 10 / 15 min |
| <span class="http patch">PATCH</span> | `/account/bots/:id/oauth2` | Salva as URLs (`{ redirectUris: [...] }`), no máximo 10. | 30 / 5 min |
| <span class="http post">POST</span> | `/account/bots/:id/oauth2/secret` | Gera um novo `client_secret`. O antigo morre na hora. | 10 / 5 min |
| <span class="http delete">DELETE</span> | `/account/bots/:id/oauth2` | Apaga a aplicação e encerra todas as autorizações. | 10 / 5 min |

Trocar o secret **não** desfaz as autorizações já dadas: elas são entre a pessoa e o aplicativo, não entre a pessoa e uma senha que fica no seu servidor. Apagar a aplicação, ou [apagar o bot](/referencia/rest#rotas-do-dono-do-bot), desfaz.

## OpenID Connect

Guia: [OpenID Connect](/guia/openid-connect). Ligado pelo escopo `openid`.

### A descoberta mora no site

O `issuer` é **`https://golive.nemtudo.me`**, e o OIDC exige que o documento seja servido em `<issuer>/.well-known/openid-configuration` e devolva esse mesmo issuer. Então:

| URL | O que acontece |
|---|---|
| `https://golive.nemtudo.me/.well-known/openid-configuration` | **A descoberta.** O site busca o documento na API e serve. |
| `https://apigolive.nemtudo.me/.well-known/openid-configuration` | `308` para a URL acima. |
| `https://apigolive.nemtudo.me/oauth2/openid-configuration` | O documento cru, escrito pela API — a fonte única do que o site serve. |
| `https://golive.nemtudo.me/.well-known/jwks.json` | `307` para a API, onde a chave realmente está. |

Uma cópia do mesmo JSON nos dois domínios seria inválida num deles, porque o `issuer` de dentro contradiria a URL de fora. Por isso um redireciona em vez de copiar.

### GET /oauth2/openid-configuration

**Público**, `Cache-Control: public, max-age=3600`. Responde `503` num servidor sem chave de assinatura carregada.

O `authorization_endpoint` aponta para o site, porque a tela de consentimento precisa perguntar algo a uma pessoa; o resto aponta para a API. Um issuer identifica o provedor, não localiza os endpoints dele.

```json
{
  "issuer": "https://golive.nemtudo.me",
  "authorization_endpoint": "https://golive.nemtudo.me/oauth2/authorize",
  "token_endpoint": "https://apigolive.nemtudo.me/oauth2/token",
  "userinfo_endpoint": "https://apigolive.nemtudo.me/oauth2/userinfo",
  "jwks_uri": "https://apigolive.nemtudo.me/.well-known/jwks.json",
  "revocation_endpoint": "https://apigolive.nemtudo.me/oauth2/token/revoke",
  "scopes_supported": ["openid", "identify", "email", "groups", "friends"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token", "client_credentials"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "token_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"],
  "code_challenge_methods_supported": ["S256"]
}
```

### GET /.well-known/jwks.json

A chave pública que verifica os `id_token`. **Pública**, cache de 1 hora. Uma chave RSA, `alg: "RS256"`, `use: "sig"`, com `kid` — o mesmo `kid` que aparece no cabeçalho do token.

```json
{ "keys": [{ "kty": "RSA", "n": "t1ZYNylHIAro...", "e": "AQAB", "kid": "mKGTAI1f...", "use": "sig", "alg": "RS256" }] }
```

### GET/POST /oauth2/userinfo

Escopo: `openid`. Os mesmos fatos do [`GET /users/@me`](#get-users-me), com os nomes do padrão OIDC.

```json
{
  "sub": "0b1c8f2e-...",
  "name": "Ana",
  "preferred_username": "ana",
  "picture": "https://cdn.../ana.png",
  "updated_at": 1737500000,
  "email": "ana@exemplo.com",
  "email_verified": true
}
```

`email` e `email_verified` só com o escopo `email`. `POST` aceita corpo vazio — existe para clientes que evitam mandar token num `GET`.

### Configuração do servidor

| Variável | Para quê |
|---|---|
| `OIDC_SITE_URL` | O endereço público do site: tela de consentimento e issuer padrão. Sem ela, a primeira origem **https e fora de localhost** de `WEB_ORIGINS` — não a primeira entrada da lista, que costuma ser `localhost`. |
| `OIDC_ISSUER` | O `iss` dos tokens e o endereço da descoberta, se precisar ser diferente do site. Padrão: o mesmo valor acima. |
| `OIDC_API_BASE` | Onde a API responde, para as URLs de endpoint dentro do documento. Derivado da requisição quando não definido; `OAUTH_CALLBACK_BASE` também serve. |
| `OIDC_PRIVATE_KEY` | A chave RSA de assinatura, em PEM PKCS#8. Sem ela, uma chave é gerada e guardada no MongoDB — e, sem MongoDB, gerada por processo, o que só serve para desenvolvimento com um worker só. |

No site (Next.js), a descoberta é uma reescrita de `/.well-known/openid-configuration` para uma rota que busca o documento na API — veja `next.config.ts` e `app/api/oidc-configuration`. A API que ela consulta vem de `NEXT_PUBLIC_SIGNALING_URL`, a mesma variável que o resto do site usa.
