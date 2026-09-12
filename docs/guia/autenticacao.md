# Autenticação

O bot se identifica com o token em **toda** requisição HTTP e **uma vez** ao abrir o WebSocket.

## O formato

A credencial completa é a palavra `Bot`, um espaço e o token:

```
Bot ZjNhOWMxZTItOGI0ZC00YjE3LTk5YzUtM2Q2ZTFhMGI3YzQ1.q8Xr3...
```

O token em si tem duas partes separadas por ponto: o id da conta do bot (em base64url) e um segredo aleatório. Ele **não expira** — vale até você gerar um novo.

::: warning `Bot`, não `Bearer`
`Bearer` é para sessões de pessoas. Um token de bot enviado como `Bearer ...` (ou sem prefixo nenhum) é recusado com `401`.
:::

## No HTTP

Mande no cabeçalho `Authorization`:

```js
const API = "https://apigolive.nemtudo.me";
const TOKEN = process.env.GOLIVE_TOKEN; // "Bot ZjNh..."

const res = await fetch(`${API}/auth/me`, {
  headers: { Authorization: TOKEN },
});
```

## No WebSocket

Depois de conectar, mande uma mensagem `register` com a mesma credencial no campo `token`:

```js
ws.send(JSON.stringify({ type: "register", token: TOKEN }));
```

Os detalhes da conexão estão em [Conexão em tempo real](./gateway).

## Conferindo o token e descobrindo quem é o bot

<span class="http get">GET</span> `/auth/me` devolve a conta dona do token. É a melhor primeira chamada de qualquer bot: confirma que o token funciona e dá o **id** do bot — que você vai precisar para, por exemplo, ignorar as próprias mensagens.

```js
const res = await fetch(`${API}/auth/me`, { headers: { Authorization: TOKEN } });
if (res.status === 401) throw new Error("Token inválido ou revogado");
const { account } = await res.json();

console.log(account.id);          // "f3a9c1e2-8b4d-4b17-99c5-3d6e1a0b7c45"
console.log(account.username);    // "musica_bot"
console.log(account.displayName); // "DJ do Grupo"
console.log(account.bot);         // true
```

::: tip
O evento `registered` do WebSocket **não** traz o id da conta. Guarde o `account.id` do `/auth/me`.
:::

## Aceitando o token com ou sem prefixo

O site copia o token já com `Bot `, a API de criação devolve sem. Uma função pequena evita confusão:

```js
function toCredential(token) {
  const t = String(token ?? "").trim();
  return t.startsWith("Bot ") ? t : `Bot ${t}`;
}
```

## Guardando o token com segurança

Nunca escreva o token no código. Use uma variável de ambiente, lida de um arquivo `.env` que **não** vai para o Git.

::: code-group

```ini [.env]
GOLIVE_TOKEN=Bot ZjNhOWMxZTItOGI0ZC00YjE3LTk5YzUtM2Q2ZTFhMGI3YzQ1.q8Xr3...
```

```txt [.gitignore]
node_modules/
.env
```

```js [index.js]
const TOKEN = process.env.GOLIVE_TOKEN;
if (!TOKEN) throw new Error("Defina GOLIVE_TOKEN no arquivo .env");
```

:::

Rode com o `.env` carregado (Node 20.6+ faz isso sozinho):

```bash
node --env-file=.env index.js
```

Se o token vazar: [gere um novo](./criando-um-bot#perdi-o-token-o-token-vazou) — o antigo morre na hora.

## Erros de autenticação

| Sintoma | Causa provável |
|---|---|
| HTTP `401 {"error":"unauthorized"}` | Token errado, revogado (gerou outro), sem o prefixo `Bot ` ou com `Bearer`. |
| WebSocket responde `register-error` com `"Invalid name."` | O token do `register` é inválido. Sem um token válido o servidor trata a conexão como um visitante sem nome — daí a mensagem estranha. |
| WebSocket responde `banned` e fecha com código `4003` | A conta do bot (ou o IP) foi banida. Não adianta reconectar. |

## Próximo passo

Hora de escrever código: [seu primeiro bot](./primeiro-bot).
