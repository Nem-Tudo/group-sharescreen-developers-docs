# Criando comandos

Comandos são mensagens que começam com um **prefixo** — `!ajuda`, `!dado 20`, `!expulsar @fulano spam`. O GoLive não tem comandos de barra nem botões: o bot lê o texto e decide.

Vamos do mais simples ao sistema completo que o [bot completo](/exemplos/bot-completo) usa.

## Anatomia de um comando

```
!escolher pizza | sushi
│└──┬───┘ └─────┬─────┘
│   nome      argumentos
prefixo
```

## Nível 1: um `switch`

Serve para bots com 3 ou 4 comandos:

```js
const PREFIX = "!";

async function onMessage(event) {
  const { message, author } = event;
  if (author.bot || !message.text.startsWith(PREFIX)) return;

  const [name, ...args] = message.text.slice(PREFIX.length).trim().split(/\s+/);

  switch (name.toLowerCase()) {
    case "ping":
      return reply(event, "Pong! 🏓");
    case "dado": {
      const sides = Number(args[0]) || 6;
      return reply(event, `🎲 ${1 + Math.floor(Math.random() * sides)}`);
    }
    case "ola":
      return reply(event, `Olá, ${author.name}!`);
  }
}
```

(`reply` é a função de [Respondendo mensagens](./respondendo-mensagens#respondendo-com-citacao).)

## Nível 2: comandos como objetos

Quando cresce, cada comando vira um objeto com nome, descrição e a função que executa. Ganhamos apelidos e uma ajuda automática de brinde:

```js
const commands = new Map();

function register(command) {
  commands.set(command.name, command);
  for (const alias of command.aliases ?? []) commands.set(alias, command);
}

register({
  name: "ping",
  description: "Responde pong",
  run: ({ event }) => reply(event, "Pong! 🏓"),
});

register({
  name: "ajuda",
  aliases: ["help"],
  description: "Lista os comandos",
  run: ({ event }) => {
    const unique = [...new Set(commands.values())];
    return reply(event, unique.map((c) => `!${c.name} — ${c.description}`).join("\n"));
  },
});

async function onMessage(event) {
  const { message, author } = event;
  if (author.bot || !message.text.startsWith(PREFIX)) return;

  const body = message.text.slice(PREFIX.length).trim();
  const [name, ...args] = body.split(/\s+/);
  const command = commands.get(name.toLowerCase());
  if (!command) return;

  await command.run({ event, args, rest: body.slice(name.length).trim() });
}
```

`args` é o texto quebrado em palavras; `rest` é tudo depois do nome, inteiro — melhor quando o argumento tem espaços ("!enquete Qual filme? | Matrix | Duna").

## Nível 3: um arquivo por comando

Com dezenas de comandos, cada um vai para um arquivo em `src/commands/`, e o bot carrega a pasta inteira ao iniciar:

```
src/
├─ index.js
├─ lib/commands.js
└─ commands/
   ├─ ping.js
   ├─ dado.js
   ├─ ajuda.js
   └─ expulsar.js
```

::: code-group

<<< @/../examples/bot-completo/src/commands/dado.js [commands/dado.js]

<<< @/../examples/bot-completo/src/commands/escolher.js [commands/escolher.js]

<<< @/../examples/bot-completo/src/commands/ajuda.js [commands/ajuda.js]

:::

O carregador:

```js
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

async function loadFolder(folderUrl) {
  const dir = fileURLToPath(folderUrl);
  for (const file of await readdir(dir)) {
    if (!file.endsWith(".js")) continue;
    const module = await import(pathToFileURL(join(dir, file)).href);
    register(module.default);
  }
}

await loadFolder(new URL("./commands/", import.meta.url));
```

Para criar um comando novo, basta criar um arquivo — nada mais muda.

## Lendo argumentos

### Números

```js
const amount = Number(args[0]);
if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
  return message.reply("Diga um número entre 1 e 100.");
}
```

Sempre valide: `args[0]` pode não existir, ser `"abc"` ou `"99999999"`.

### Menções

Uma pessoa mencionada chega no texto como `<@id>`. Para extrair os ids:

```js
function mentionedIds(text) {
  return [...new Set([...text.matchAll(/<@([A-Za-z0-9:_-]{1,80})>/g)].map((m) => m[1]))];
}

// "!abraçar <@a41c...>"
const [targetId] = mentionedIds(message.text);
if (!targetId) return message.reply("Mencione alguém!");
await message.send(`🤗 <@${message.author.id}> abraçou <@${targetId}>`);
```

### Texto entre aspas

Para comandos como `!apelido "Maria Clara" "Mari"`:

```js
function parseQuoted(input) {
  return [...input.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]);
}

parseQuoted('"Maria Clara" "Mari" extra'); // ["Maria Clara", "Mari", "extra"]
```

### Opções separadas por `|`

```js
// !escolher pizza | hambúrguer | sushi
const options = rest.split("|").map((o) => o.trim()).filter(Boolean);
```

## Cooldown (tempo entre usos)

Evita que alguém dispare o mesmo comando sem parar — e protege o bot dos [limites da API](./boas-praticas):

```js
const cooldowns = new Map(); // "comando:usuario" → quando libera

function checkCooldown(command, userId) {
  if (!command.cooldown) return 0;
  const key = `${command.name}:${userId}`;
  const now = Date.now();
  const until = cooldowns.get(key) ?? 0;
  if (now < until) return Math.ceil((until - now) / 1000);
  cooldowns.set(key, now + command.cooldown * 1000);
  return 0;
}

const wait = checkCooldown(command, author.id);
if (wait) return message.reply(`⏳ Espere ${wait}s para usar de novo.`);
```

## Permissões

Um comando de moderação precisa checar se **quem pediu** pode fazer aquilo — a API só checa o bot. Declare a permissão no comando e confira antes de executar:

<<< @/../examples/bot-completo/src/commands/expulsar.js

A função que responde "fulano tem a permissão X?" está em [Permissões e cargos](./permissoes#checando-a-permissao-de-quem-usou-o-comando).

## Tratando erros

Um erro dentro de um comando não pode derrubar o bot. Envolva a execução:

```js
try {
  await command.run({ client, message, args, rest });
} catch (err) {
  console.error(`[comando ${command.name}]`, err);
  await message.reply("❌ Algo deu errado ao executar esse comando.").catch(() => {});
}
```

E como garantia final, no `index.js`:

```js
process.on("unhandledRejection", (err) => console.error("Promise rejeitada:", err));
```

## Prefixo por menção

Além de `!`, dá para aceitar `@bot comando`:

```js
function stripPrefix(text) {
  if (text.startsWith(PREFIX)) return text.slice(PREFIX.length);
  const mention = `<@${me.id}>`;
  if (text.startsWith(mention)) return text.slice(mention.length);
  return null;
}
```

## O sistema completo

Juntando tudo — objetos, pasta, apelidos, cooldown, permissão e erros:

<<< @/../examples/bot-completo/src/lib/commands.js

E o uso no `index.js`:

```js
import { GoLiveClient } from "./golive/client.js";
import { CommandHandler } from "./lib/commands.js";

const client = new GoLiveClient({ token: process.env.GOLIVE_TOKEN });
const commands = new CommandHandler(client, { prefix: "!" });
await commands.loadFolder(new URL("./commands/", import.meta.url));

client.on("messageCreate", (message) => commands.handle(message));
await client.login();
```

::: tip Ideias de comandos
`!avatar @pessoa` (manda a foto de perfil), `!sorteio` (sorteia entre quem reagiu), `!clima cidade` (API externa + "digitando..."), `!ranking` (pontos guardados num arquivo, com [páginas](./paginas-por-reacao)), `!lembrete` (por [DM](./mensagens-diretas)).
:::
