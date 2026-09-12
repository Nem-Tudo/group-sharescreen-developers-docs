# Criando seu bot

Todo bot pertence a uma conta de pessoa — a sua. É por ela que você cria o bot e gera o token dele.

## Pelo site (o jeito normal)

1. Entre no [GoLive](https://golive.nemtudo.me) com a sua conta.
2. Abra o **menu da conta** (sua foto, no canto superior direito).
3. Clique em **Criar bot**. Aparece a lista "Meus bots".
4. Clique em **Criar bot** de novo e preencha:
   - **Usuário do bot** — só letras minúsculas, números e `_`, até 16 caracteres. O `_bot` do final é colocado sozinho: digitando `musica`, o bot vira `@musica_bot`.
   - **Nome de exibição** — como o nome aparece nas conversas (até 24 caracteres). Opcional: vazio, usa o usuário sem o `_bot`.
5. Clique em **Criar bot**.
6. O site mostra o **token** do bot. **Copie e guarde agora** — ele não aparece de novo.
7. Clique em **Pronto**.

O texto copiado já vem no formato certo para usar: `Bot ` seguido do token.

```
Bot ZjNhOWMxZTItOGI0ZC00YjE3LTk5YzUtM2Q2ZTFhMGI3YzQ1.q8Xr3...
```

::: danger O token é a senha do bot
Quem tiver o token controla o bot: fala por ele, modera com os cargos dele, lê as DMs dele. Nunca publique o token, nunca o coloque no código que vai para o GitHub, nunca mande em print. Veja [como guardar com segurança](./autenticacao#guardando-o-token-com-seguranca).
:::

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

Na lista "Meus bots", clique em **Gerar novo token** no bot e confirme.

- O token novo aparece uma única vez, como na criação.
- O token antigo **para de funcionar na hora**, em todo lugar. Se o bot estiver rodando com ele, desconecta.

É assim que se revoga um token vazado: gerando outro.

## Pela API (avançado)

As mesmas três ações existem na API, para quem quer automatizar (por exemplo, um painel próprio). Elas exigem o **token de sessão de uma pessoa** (`Authorization: Bearer <jwt>`) — **nunca** um token de bot. Assim um token de bot vazado não consegue criar mais bots nem trocar o próprio token.

| Ação | Rota | Limite |
|---|---|---|
| Listar meus bots | <span class="http get">GET</span> `/account/bots` | 60/min |
| Criar bot | <span class="http post">POST</span> `/account/bots` | 5 a cada 15 min |
| Gerar novo token | <span class="http post">POST</span> `/account/bots/:id/token` | 10 a cada 5 min |

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

Respostas:

```js
// GET /account/bots
{ "bots": [ /* contas (objeto Account) */ ], "max": 10 }

// POST /account/bots
{ "bot": { /* Account */ }, "token": "ZjNh...q8Xr3" }

// POST /account/bots/:id/token
{ "token": "ZjNh...N7wP1" }
```

Erros possíveis: `400` (usuário inválido), `401` (não é sessão de pessoa), `403` (conta banida), `404` (bot não é seu), `409` (nome em uso, ou já tem 10 bots).

## Próximo passo

Com o token em mãos, veja [como autenticar](./autenticacao).
