# OpenID Connect

O GoLive também é um provedor **OpenID Connect** — uma camada fina em cima do [Entrar com GoLive](./oauth2), não um fluxo separado.

Na prática, é isto: se você pedir o escopo `openid`, a resposta do `/oauth2/token` vem com um **`id_token`** — um JWT assinado que diz quem acabou de entrar. Seu servidor confere a assinatura sozinho, sem chamar a API do GoLive.

::: tip Precisa disso?
Se você está escrevendo a integração na mão, **não precisa**: peça `identify` e chame `GET /users/@me`. É mais simples e funciona igual.

O OIDC vale a pena quando você usa uma biblioteca pronta — **NextAuth/Auth.js, Passport, Keycloak, Authelia, Spring Security**. Aí o GoLive vira "mais um provedor", configurado com uma URL, em vez de um adaptador escrito por você.
:::

## Configuração automática

Aponte a sua biblioteca para o **issuer** e ela acha o resto sozinha:

```
https://golive.nemtudo.me
```

::: warning O issuer é o site, não a API
`https://golive.nemtudo.me` — o mesmo domínio em que as pessoas usam o GoLive, e o mesmo que aparece no `iss` de todo `id_token`.

Não é um detalhe cosmético: o OIDC amarra o issuer ao lugar da descoberta. O documento **tem** que ser servido em `<issuer>/.well-known/openid-configuration` e devolver esse mesmo issuer, senão um cliente que segue a especificação recusa. Os *endpoints* continuam na API (`apigolive.nemtudo.me`) — um issuer identifica o provedor, não localiza ele.

Se você pedir `https://apigolive.nemtudo.me/.well-known/openid-configuration`, a API te manda (308) para o endereço certo.
:::

- `GET https://golive.nemtudo.me/.well-known/openid-configuration`
- `GET https://apigolive.nemtudo.me/.well-known/jwks.json` — a chave pública que verifica os `id_token`

### Exemplo: NextAuth / Auth.js

```ts
providers: [
  {
    id: "golive",
    name: "GoLive",
    type: "oidc",
    issuer: "https://golive.nemtudo.me",
    clientId: process.env.GOLIVE_CLIENT_ID,
    clientSecret: process.env.GOLIVE_CLIENT_SECRET,
    authorization: { params: { scope: "openid identify email" } },
  },
]
```

A URL de redirecionamento que você cadastra no portal é a que a sua biblioteca usa — no NextAuth, `https://seusite.com/api/auth/callback/golive`.

::: tip `profile` não existe aqui, e está tudo bem
Bibliotecas de OIDC costumam pedir `openid profile email` por padrão. O GoLive **ignora** escopos que não conhece, e `identify` — que é o mesmo acesso com o nome daqui — entra sempre. Então o pedido padrão funciona sem você mudar nada.
:::

## O `id_token`

```json
{
  "iss": "https://golive.nemtudo.me",
  "sub": "0b1c8f2e-...",
  "aud": "SEU_CLIENT_ID",
  "exp": 1737600600,
  "iat": 1737600000,
  "auth_time": 1737599950,
  "nonce": "n-0S6_WzA2Mj",
  "name": "Ana",
  "preferred_username": "ana",
  "picture": "https://cdn.../ana.png",
  "updated_at": 1737500000,
  "email": "ana@exemplo.com",
  "email_verified": true
}
```

| Claim | O que é |
|---|---|
| `sub` | O id da conta. É um UUID, **nunca reaproveitado** — pode ser a chave primária do seu banco. |
| `auth_time` | Quando a pessoa realmente passou pela tela de consentimento. **Não** muda quando você renova o token. |
| `nonce` | Devolvido igual ao que você mandou na autorização. Só no `id_token` do código — não no de um `refresh_token`. |
| `email` / `email_verified` | Só com o escopo `email`. `email_verified` só é `true` quando um provedor de fato confirmou o endereço. |

Assinatura: **RS256**. O `kid` no cabeçalho aponta para a chave no JWKS.

### Verificando

Sempre confira, nesta ordem: assinatura contra o JWKS, `iss`, `aud` (tem que ser o seu `client_id`), `exp` e — se você mandou um — o `nonce`.

```js
import { createRemoteJWKSet, jwtVerify } from "jose";

const jwks = createRemoteJWKSet(
  new URL("https://apigolive.nemtudo.me/.well-known/jwks.json")
);

const { payload } = await jwtVerify(idToken, jwks, {
  // O issuer é o site; a chave mora na API. Os dois estão certos.
  issuer: "https://golive.nemtudo.me",
  audience: process.env.GOLIVE_CLIENT_ID,
});

if (payload.nonce !== nonceQueVocêGuardou) throw new Error("nonce não confere");
```

::: warning O `id_token` não é uma credencial
Ele é um **recibo**: você confere uma vez, cria a sua própria sessão e joga fora. Ele vale 10 minutos e não abre nenhuma rota. Quem chama a API é o `access_token`.
:::

## `/oauth2/userinfo`

<span class="http get">GET</span> (ou <span class="http post">POST</span>) `/oauth2/userinfo`, com `Authorization: Bearer <access_token>` e o escopo `openid`, devolve os mesmos claims do `id_token`:

```js
const res = await fetch("https://apigolive.nemtudo.me/oauth2/userinfo", {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

É a mesma informação do [`GET /users/@me`](/referencia/oauth2#get-users-me), com os nomes do padrão OIDC (`sub`, `preferred_username`, `picture`) em vez dos nomes do GoLive (`id`, `username`, `avatarUrl`). As duas existem de propósito: uma para bibliotecas genéricas, a outra para quem escreve contra o GoLive.

## `nonce`

Junto com o `state`, é a outra metade da proteção do fluxo:

- **`state`** volta na URL de redirecionamento e protege o *pedido* (CSRF).
- **`nonce`** vai dentro do `id_token` e protege o *token* — amarra aquele token ao login que **você** começou.

Gere um valor aleatório, guarde na sessão, mande em `&nonce=...` na autorização e compare com o claim `nonce` depois de verificar a assinatura. Bibliotecas de OIDC fazem isso sozinhas.

## O que não tem

Para não te deixar procurando:

- **Fluxo implícito e híbrido** (`response_type=id_token` ou `code id_token`): não. Só `code` — os outros entregam tokens pela barra de endereço, e o `code` com [PKCE](./oauth2#pkce) cobre os mesmos casos melhor.
- **`prompt`, `max_age`, `login_hint`, `acr_values`**: ignorados.
- **Logout único (RP-Initiated Logout)**: não. Encerrar o acesso é [`/oauth2/token/revoke`](./oauth2#encerrando-o-acesso), ou a própria pessoa em **Aplicativos conectados**.
- **Registro dinâmico de cliente**: não. As aplicações nascem no [portal do desenvolvedor](https://golive-developers.nemtudo.me).
- **`at_hash`**: não vai no `id_token`. Ele é opcional no fluxo de código, que é o único que existe aqui.
