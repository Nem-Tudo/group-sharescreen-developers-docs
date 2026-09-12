# Limites e boas práticas

Um bot bem-comportado não é bloqueado, não é banido e não irrita o grupo. Esta página junta o que mais importa.

## Respeite os limites de requisições

Cada rota aceita um número de requisições por minuto, **por IP** (a lista completa está em [Limites](/referencia/limites)). Os principais para bots:

| Ação | Limite |
|---|---|
| Enviar mensagem | 120 / min |
| Reagir | 120 / min |
| Apagar mensagem | 60 / min |
| Enviar DM | 60 / min |
| Rotas sem limite próprio | 100 / min |

Ao passar, a resposta é `429` com o cabeçalho `retry-after` (em segundos). Espere e tente de novo — nunca repita na hora:

```js
if (res.status === 429) {
  const seconds = Number(res.headers.get("retry-after")) || 5;
  await new Promise((r) => setTimeout(r, seconds * 1000));
  return retry();
}
```

::: warning O limite é do IP, não do bot
Três bots no mesmo servidor dividem os mesmos 120 envios por minuto. Planeje por máquina.
:::

### Fila de envio

Se o bot pode gerar muitas mensagens de uma vez (um anúncio para vários grupos, um relatório), passe tudo por uma fila com intervalo:

```js
class SendQueue {
  #queue = [];
  #running = false;

  constructor(intervalMs = 600) {
    this.intervalMs = intervalMs; // ~100 por minuto, com folga
  }

  push(task) {
    return new Promise((resolve, reject) => {
      this.#queue.push({ task, resolve, reject });
      this.#run();
    });
  }

  async #run() {
    if (this.#running) return;
    this.#running = true;
    while (this.#queue.length > 0) {
      const { task, resolve, reject } = this.#queue.shift();
      try { resolve(await task()); } catch (err) { reject(err); }
      await new Promise((r) => setTimeout(r, this.intervalMs));
    }
    this.#running = false;
  }
}

const queue = new SendQueue();
for (const groupId of groups) {
  queue.push(() => client.sendMessage(groupId, channelId, "📢 Novidade!"));
}
```

## Cuidado com o WebSocket

- **Reconecte com espera crescente**, nunca em loop — o servidor aceita 30 conexões por minuto por IP.
- **Não repita `register`** sem motivo — 10 por minuto.
- **Estourar os limites do WebSocket 6 vezes em um minuto bane o IP por uma hora.** Isso derruba todos os bots daquela máquina.
- Não reconecte depois de `4003`/`banned` nem de um `register-error` sem `retryable`.

## Não entre em loop

- **Ignore mensagens de bots** (`author.bot`), inclusive as suas. Dois bots que se respondem esgotam os limites em segundos.
- **Não reaja às próprias reações** — ao montar enquetes e páginas, o bot recebe o evento das próprias reações.
- **Uma instância por vez.** Duas cópias do bot rodando = tudo respondido em dobro.

## Seja um bom membro do grupo

- **Fale quando for chamado.** Comandos e menções, sim; comentar toda mensagem, não.
- **Não use `@everyone`** a não ser que o grupo tenha pedido exatamente isso.
- **Notificação custa atenção.** Uma resposta com `replyTo.userId` notifica; em respostas automáticas e frequentes, deixe o `userId` de fora.
- **DM só em resposta** a algo que a pessoa fez.
- **Mensagens curtas.** Listas grandes vão em [páginas](./paginas-por-reacao).
- O GoLive filtra algumas palavras em todo o site (`400 ... blocked word`); não tente contornar.

## Segurança

- **O token é segredo.** `.env` fora do Git, nunca em print ou log. Vazou? [Gere outro](./criando-um-bot#perdi-o-token-o-token-vazou).
- **Cheque a permissão de quem pediu**, não só a do bot — veja [Duas perguntas diferentes](./permissoes#duas-perguntas-diferentes).
- **Valide todo argumento.** Números podem ser `NaN` ou gigantes, textos podem ter 2000 caracteres, menções podem ser do próprio bot ou do dono.
- **Nunca rode `eval`** com texto vindo do chat, nem monte comandos de terminal com ele.
- **Cuidado ao repetir texto do usuário**: um `!falar @everyone ...` com a permissão do bot vira um `@everyone` que o usuário não poderia mandar. O `@everyone` só vale se estiver em `mentions` — não coloque texto do usuário lá.

## Resiliência

- Envolva cada comando e cada handler em `try/catch`; um erro não pode derrubar o bot.
- Adicione uma rede de segurança:

  ```js
  process.on("unhandledRejection", (err) => console.error("Promise rejeitada:", err));
  process.on("uncaughtException", (err) => console.error("Erro não tratado:", err));
  ```

- Registre o que o bot faz (com data e hora) — é o que salva quando alguém pergunta "por que o bot me expulsou?".
- Faça cache do que muda pouco (`GET /groups/:id`) e descarte no `group-updated`.
- Limite o tamanho de todo `Map` que cresce com o uso (reações, cooldowns, histórico).
