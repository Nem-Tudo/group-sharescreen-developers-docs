# Limites

## Limites de requisições (HTTP)

Contados **por IP**, em janelas fixas. Vários bots no mesmo servidor dividem o mesmo limite. Ao passar, a API responde `429` com o cabeçalho `retry-after` (segundos até liberar).

| Rota | Limite |
|---|---|
| Qualquer rota sem limite próprio | 100 / min |
| `GET /auth/me` | 120 / min |
| `GET /groups` | 120 / min |
| `GET /groups/:id`, `GET /groups/:id/voice` | 240 / min |
| `GET .../messages` (histórico) | 240 / min |
| `POST .../messages` (enviar) | 120 / min |
| `PATCH .../messages/:mid` (editar) · `DELETE .../messages/:mid` | 60 / min |
| `POST .../reactions` · `GET .../reactions` | 120 / min |
| `POST .../typing` | 120 / min |
| `POST .../read` | 240 / min |
| `GET /groups/:id/members` | 120 / min |
| Expulsar, banir, desbanir | 30 / min |
| Cargos: criar/apagar/reordenar · editar/atribuir | 30 / min · 60 / min |
| Salas e categorias: criar, renomear, apagar, reordenar | 30 / min |
| Permissões de sala · `@everyone` · `PUT /groups/:id/layout` | 60 / min |
| Criar convite · aceitar convite · entrar em grupo | 20 / min |
| `POST /groups/:id/bots` (adicionar bot) · `GET /bots/:id` | 20 / min · 60 / min |
| `POST /groups` (criar grupo) | 10 / min |
| `POST /dm/:userId` | 60 / min |
| `PATCH /dm/:userId/messages/:mid` · `DELETE /dm/:userId/messages/:mid` | 60 / min |
| `GET /dm`, `GET /dm/:userId`, `POST /dm/:userId/read` | 120 / min |
| `POST /dm/:userId/typing`, `POST /dm/:userId/messages/:mid/reactions` | 120 / min |
| `GET /dm/settings` · `PUT /dm/settings` | 60 / min · 30 / min |
| `PATCH /account/profile` · `PATCH /account/bots/:id` | 30 / min |
| `POST /account/bots` (criar bot) | 5 a cada 15 min |
| `POST /account/bots/:id/token` · `DELETE /account/bots/:id` | 10 a cada 5 min |
| `GET /users/:id` | 60 / min |
| Rotas `/social/*` (escrita) | 30 / min |
| `GET /presence` | 120 / min |
| `POST /webhooks/:id/:token` | 120 / min por IP, e **5 a cada 2 s por webhook** (resposta no formato do Discord, com `retry_after`) |

## Limites do WebSocket

| O quê | Limite |
|---|---|
| Aberturas de conexão | 30 / min por IP |
| Tamanho de uma mensagem | 64 KB |
| `register` | 10 / min por conexão |
| Mensagens de qualquer tipo | 3500 a cada 10 s por conexão |
| `join` (salas ao vivo) | 15 / min |
| `chat` (salas ao vivo) | 15 a cada 5 s |
| `typing`, `presence-watch` e outros avisos | 60 a cada 10 s |

::: danger Banimento automático
Estourar os limites do WebSocket (`register`, `join` e `chat`) **6 vezes em 60 segundos** faz o servidor tratar o IP como robô abusivo e **bani-lo por 60 minutos**. Um bot que tenta de novo sem esperar cai nisso rápido — e derruba junto qualquer outro bot no mesmo IP.
:::

## Tamanhos e quantidades

| O quê | Limite |
|---|---|
| Texto de mensagem (grupo ou DM) | 2000 caracteres |
| Texto no chat de sala ao vivo | 500 caracteres |
| Embeds por mensagem | 10, com até 6000 caracteres somados ([detalhes](/guia/enviando-mensagens#embeds)) |
| Webhooks por sala | 15 |
| Imagens por mensagem | 3 |
| Tamanho de uma imagem | 5 MB |
| Imagens somadas numa mensagem | 8 MB |
| Emoji diferentes numa mensagem | 20 |
| Mensagens por página de histórico | 50 |
| Menções que notificam, por mensagem | 20 pessoas e 10 cargos |
| Tokens `<@id>`/`<#id>` lidos por mensagem | 50 |
| `nonce` lembrado | 10 minutos |

## Contas e grupos

| O quê | Limite |
|---|---|
| Bots por conta | 10 |
| Usuário do bot | até 16 caracteres + `_bot` |
| Nome de exibição | 1 a 24 caracteres |
| Bio | 500 caracteres |
| Grupos em que uma conta está | 100 |
| Grupos dos quais uma conta é dona | 10 |
| Membros por grupo | 1000 (padrão) |
| Salas por grupo | 50 |
| Categorias por grupo | 20 |
| Cargos por grupo | 50 |
| Convites ativos por grupo | 50 |
| Nome de grupo · descrição | 50 · 200 caracteres |
| Nome de sala, categoria ou cargo | 32 caracteres |
| Contas em `presence-watch` | 400 |
