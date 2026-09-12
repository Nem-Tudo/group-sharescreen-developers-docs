# Páginas por reação

Uma lista de 50 membros, um ranking, um catálogo de músicas — não cabe numa mensagem só (e se couber, ninguém lê). A solução clássica: o bot mostra **uma página** e reage com setas; quem clicar numa seta vê a página seguinte.

> **DJ do Grupo** `BOT`
>
> 👥 Membros (24)
>
> 🟢 👑 Dona do Grupo<br>
> 🟢 • DJ do Grupo [BOT]<br>
> ⚫ • João<br>
> ...
>
> 📄 Página 1/3
>
> `⬅️ 1` `➡️ 1` `❌ 1`

Esta página constrói esse paginador do zero. Ele usa tudo das páginas anteriores: [enviar](./enviando-mensagens), [apagar](./enviando-mensagens#apagando-mensagens), [reagir e perceber reações](./reacoes).

## Como "virar a página" sem editar

A API do GoLive **não tem edição de mensagens**. Então virar a página é:

1. enviar a página nova;
2. apagar a mensagem da página anterior;
3. reagir com as setas na mensagem nova.

Na tela o efeito é o esperado — uma mensagem só, com a página atual. Mas vale conhecer as consequências:

| Consequência | Como lidar |
|---|---|
| Cada página é uma **mensagem nova**, no fim da conversa. | Tudo bem: quem está navegando está olhando para o fim. |
| Membros que escolheram ser notificados de **todas** as mensagens recebem uma notificação por página. | Não use o paginador em salas movimentadas para listas curtas; 3–10 páginas é o ideal. |
| Uma resposta com `replyTo.userId` notificaria quem pediu **a cada página**. | Envie as páginas **sem** `replyTo` (ou sem o `userId`). |
| Cada virada custa ~5 requisições (1 envio, 1 exclusão, 3 reações). | Um paginador por vez por pessoa; ignore cliques enquanto uma virada está em andamento. |

## Passo 1: dividir em páginas

```js
function chunkLines(lines, size = 10) {
  const pages = [];
  for (let i = 0; i < lines.length; i += size) {
    pages.push(lines.slice(i, i + size).join("\n"));
  }
  return pages;
}

const lines = members.map((m) => `${m.online ? "🟢" : "⚫"} ${m.name}`);
const pages = chunkLines(lines, 10).map((page) => `👥 Membros (${members.length})\n\n${page}`);
```

Lembre do limite de **2000 caracteres** por mensagem: 10–15 linhas por página é confortável.

## Passo 2: mostrar uma página

```js
const PREV = "⬅️", NEXT = "➡️", STOP = "❌";

let current = null; // a mensagem que está na tela
let index = 0;

const render = (i) => `${pages[i]}\n\n📄 Página ${i + 1}/${pages.length}`;

async function show(i) {
  const previous = current;
  current = await client.sendMessage(groupId, channelId, { text: render(i) });
  if (previous) await client.deleteMessage(groupId, channelId, previous.id).catch(() => {});
  for (const emoji of [PREV, NEXT, STOP]) {
    await client.react(groupId, channelId, current.id, emoji); // em ordem
  }
}
```

A página nova é enviada **antes** de apagar a antiga, para a conversa nunca ficar sem nenhuma das duas. O `.catch` na exclusão ignora o caso de alguém já ter apagado a mensagem.

## Passo 3: ouvir as setas

Com o evento `reactionAdd` (o [diff de reações](./reacoes#descobrindo-quem-reagiu-diff)), cada clique vira uma ação:

```js
let busy = false;

async function onReaction(event) {
  if (event.messageId !== current?.id) return;       // outra mensagem
  if (event.userId === client.user.id) return;       // as setas do próprio bot
  if (event.userId !== message.author.id) return;    // só quem pediu navega
  if (busy) return;                                  // uma virada por vez

  let next;
  if (event.emoji === NEXT) next = (index + 1) % pages.length;
  else if (event.emoji === PREV) next = index === 0 ? pages.length - 1 : index - 1;
  else if (event.emoji === STOP) return stop({ deleteMessage: true });
  else return;

  busy = true;
  try {
    index = next;
    await show(index);
  } finally {
    busy = false;
  }
}

client.on("reactionAdd", onReaction);
```

Os filtros importam:

- **O próprio bot** reage com as setas em toda página nova — sem o filtro, ele "clicaria" nelas sozinho.
- **`busy`** evita que dois cliques rápidos disparem duas viradas em paralelo, embaralhando as mensagens.
- **Só quem pediu** — senão qualquer um vira as páginas de qualquer um. (Deixe opcional: numa lista pública, todo mundo navegar pode ser o que você quer.)

## Passo 4: parar

Um paginador não pode ficar ouvindo para sempre — cada um que fica aberto é um listener a mais e memória que não volta. Ele para em dois casos:

- **Clique no ❌** → apaga a mensagem.
- **Tempo sem uso** (ex.: 2 minutos) → tira as setas do bot, sinalizando que expirou.

```js
let timer = null;

function armTimer() {
  clearTimeout(timer);
  timer = setTimeout(() => stop({ deleteMessage: false }), 120_000);
}

async function stop({ deleteMessage }) {
  clearTimeout(timer);
  client.off("reactionAdd", onReaction); // essencial: para de ouvir
  if (deleteMessage) {
    await client.deleteMessage(groupId, channelId, current.id).catch(() => {});
  } else {
    for (const emoji of [PREV, NEXT, STOP]) {
      await client.react(groupId, channelId, current.id, emoji, false).catch(() => {});
    }
  }
}
```

Chame `armTimer()` ao mostrar a primeira página e a cada virada — assim o prazo conta a partir do último uso.

## O paginador completo

Tudo junto, numa função reutilizável:

<<< @/../examples/bot-completo/src/lib/paginator.js

## Usando num comando

<<< @/../examples/bot-completo/src/commands/membros.js

Qualquer comando que gere uma lista vira paginado com uma linha: `await paginate(message, pages)`.

## Variações

**Primeira e última página** — adicione ⏮️ e ⏭️:

```js
if (event.emoji === "⏮️") next = 0;
if (event.emoji === "⏭️") next = pages.length - 1;
```

**Todo mundo navega** — `paginate(message, pages, { authorOnly: false })`.

**Uma página só** — o paginador detecta e não põe setas nem fica ouvindo.

**Páginas com imagem** — cada página pode ser `{ text, images }` em vez de texto: troque o `sendMessage(..., { text: render(i) })` por um objeto montado da página.

**Menu por números** — em vez de setas, reações 1️⃣ 2️⃣ 3️⃣ que levam direto a cada seção (ótimo para um `!ajuda` com categorias).

::: tip Por que não reagir de novo para voltar?
Em outras plataformas o bot tira a reação da pessoa depois do clique, para ela poder clicar de novo. No GoLive o bot não pode tirar reações alheias — mas como cada página é uma mensagem nova com setas novas, a pessoa sempre tem uma seta "limpa" para clicar.
:::
