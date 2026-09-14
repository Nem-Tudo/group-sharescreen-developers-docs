# Erros

Quando algo dá errado, a API responde com um status HTTP de erro e um corpo:

```json
{ "error": "You do not have permission to send messages in this room." }
```

As mensagens de `error` são em inglês e podem mudar — decida pelo **status**, e use o texto só para mostrar ou registrar.

## Status HTTP

| Status | Nome | Significado para o bot |
|---|---|---|
| `400` | Bad Request | O corpo está errado: campo faltando, valor inválido, emoji que não é emoji, palavra bloqueada. Não adianta repetir igual. |
| `401` | Unauthorized | Token ausente, inválido ou revogado — ou uma rota que exige sessão de pessoa. |
| `403` | Forbidden | O bot não tem a permissão, ou tentou agir sobre alguém de cargo igual/acima. Com `reason: "bot_suspended"`, o bot foi suspenso pela administração do GoLive — veja abaixo. |
| `404` | Not Found | Não existe **ou o bot não tem acesso**: grupo em que ele não está, sala que ele não vê, conta que bloqueou. A API não diferencia de propósito. |
| `409` | Conflict | Conflito de estado: nome em uso, limite de bots atingido, pedido de amizade repetido. |
| `410` | Gone | Convite expirado, revogado ou esgotado. |
| `413` | Payload Too Large | Imagem grande demais. |
| `423` | Locked | O grupo está suspenso pela administração do GoLive. A resposta traz `suspended: true`. |
| `429` | Too Many Requests | Limite de requisições. Espere o `retry-after` (segundos) e tente de novo. |
| `500` | Internal Server Error | Falha do servidor. Tente de novo mais tarde. |
| `502` | Bad Gateway | Falhou o envio de imagem para a CDN. Tente de novo. |
| `503` | Service Unavailable | Recurso indisponível agora (servidor iniciando — com `retryable: true` — ou sem banco de mensagens). |

## Tratando no código

```js
class GoLiveApiError extends Error {
  constructor(status, body) {
    super(`${status}: ${body?.error ?? "erro"}`);
    this.status = status;
    this.body = body;
  }
}

async function api(method, path, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://apigolive.nemtudo.me${path}`, {
      method,
      headers: {
        Authorization: process.env.GOLIVE_TOKEN,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after")) || 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }

    const data = await res.json().catch(() => null);
    if (!res.ok) throw new GoLiveApiError(res.status, data);
    return data;
  }
  throw new Error(`${method} ${path}: limite de requisições persistente`);
}

try {
  await api("POST", `/groups/${groupId}/members/${userId}/kick`, {});
} catch (err) {
  if (err.status === 403) await message.reply("Não tenho permissão para expulsar essa pessoa.");
  else throw err;
}
```

A versão completa, com repetição em falhas de rede, é o [`rest.js` do bot completo](/exemplos/bot-completo#o-cliente-http).

## Bot suspenso

A administração do GoLive pode suspender um bot — por tempo determinado ou até segunda ordem. Enquanto isso:

- **toda** requisição HTTP com o token dele responde `403` com `reason: "bot_suspended"`:

  ```json
  { "error": "This bot has been suspended by GoLive's administration.", "reason": "bot_suspended" }
  ```

- a conexão WebSocket recebe [`banned`](./eventos#banned) e fecha com o código `4003`;
- ninguém consegue adicionar o bot a um grupo.

Não adianta repetir nem reconectar: pare e espere. Nada do bot é apagado — quando a suspensão acaba, ele volta exatamente como estava, nos mesmos grupos.

```js
if (err.status === 403 && err.body?.reason === "bot_suspended") {
  console.error("Bot suspenso pela administração do GoLive.");
  process.exit(1);
}
```

## Mensagens de erro frequentes

| Status | `error` | Causa |
|---|---|---|
| 400 | `Empty message.` | Mensagem sem `text`, `images` nem `url`. |
| 400 | `Invalid message.` | Caracteres de controle no texto. |
| 400 | `Your message contains a blocked word.` | Palavra filtrada pelo GoLive. |
| 400 | `Invalid GIF.` | `url` fora do Giphy. |
| 400 | `Invalid emoji.` | O `emoji` não é exatamente um emoji padrão. |
| 400 | `At most 20 different reactions per message.` | Limite de reações. |
| 400 | `Body cannot be empty when content-type is set to 'application/json'` | `Content-Type` JSON sem corpo — mande `{}`. |
| 401 | `unauthorized` | Token. Veja [Autenticação](/guia/autenticacao#erros-de-autenticacao). |
| 403 | `This bot has been suspended by GoLive's administration.` | Bot suspenso (`reason: "bot_suspended"`). Toda rota responde isso até a suspensão acabar. |
| 403 | `You do not have permission to ...` | Falta de permissão do bot. |
| 403 | `You cannot do this to someone with a role equal to or above your own.` | Hierarquia: suba o cargo do bot. |
| 403 | `Nobody can remove the group's owner.` | Alvo é o dono. |
| 403 | `You can only touch roles below your own.` | Cargo acima do bot. |
| 404 | `Group not found.` | O bot não está no grupo (ou o id está errado). |
| 404 | `Room not found.` | Sala inexistente, de voz, ou invisível para o bot. |
| 404 | `Message not found.` | Mensagem apagada ou de outra sala. |
| 404 | `User not found.` | Conta inexistente ou bloqueio entre as contas. |
| 423 | `This group has been suspended by GoLive's administration...` | Grupo suspenso. |
| 503 | `Text rooms are not available in this installation.` | Instalação sem banco de mensagens (não acontece no GoLive oficial). |
