# Bot completo

Um bot pronto para usar e adaptar, com tudo o que esta documentação ensina funcionando junto:

- ⌨️ Sistema de comandos com prefixo, apelidos, cooldown e permissões
- 💬 Respostas com citação e resposta a menções
- 📄 Páginas por reação (`!membros`)
- 📊 Enquete por reações (`!enquete`)
- 🛡️ Moderação com checagem de permissão (`!expulsar`, `!banir`)
- ✉️ Respostas por DM
- 🔄 Reconexão automática, heartbeat e tratamento de `429`

O código fica em `examples/bot-completo` no repositório desta documentação, e é testado contra uma imitação da API (`npm run check:examples` na raiz do repositório).

## Rodando

```bash
cd examples/bot-completo
npm install
cp .env.example .env     # e cole o token do bot no .env
npm run link    # mostra o link para quem gerencia o grupo adicionar o bot
npm start
```

```
✅ Conectado como DJ do Grupo (@musica_bot)
📚 Estou em 1 grupo(s): Meu Grupo
⌨️  9 comandos carregados. Prefixo: !
```

## Comandos

| Comando | O que faz | Mostra como... |
|---|---|---|
| `!ping` | Responde e mede a latência da API. | responder com citação |
| `!ajuda [comando]` | Lista os comandos ou explica um. | gerar ajuda a partir dos comandos |
| `!dado [lados]` | Rola um dado. | validar argumentos, cooldown |
| `!escolher a \| b \| c` | Escolhe uma opção. | argumentos com separador |
| `!usuario [@pessoa]` | Mostra um perfil. | ler menções `<@id>`, `GET /users/:id` |
| `!membros` | Lista os membros em páginas. | [páginas por reação](/guia/paginas-por-reacao) |
| `!enquete P \| A \| B` | Votação que encerra em 60 s. | [coletar reações](/guia/reacoes#exemplo-enquete) |
| `!expulsar @pessoa [motivo]` | Expulsa do grupo. | [permissões](/guia/permissoes), tratar `403` |
| `!banir @pessoa [motivo]` | Bane do grupo. | idem |

Além dos comandos: mencione o bot e ele se apresenta; mande uma DM e ele responde com a ajuda.

## Configuração

<<< @/../examples/bot-completo/.env.example{ini}

<<< @/../examples/bot-completo/package.json

## Código

### O ponto de entrada

<<< @/../examples/bot-completo/src/index.js

### O cliente HTTP

Token, JSON, repetição automática em `429` e falhas de rede.

<<< @/../examples/bot-completo/src/golive/rest.js

### A conexão em tempo real

`register`, heartbeat, reconexão com espera crescente e os casos em que não se deve reconectar.

<<< @/../examples/bot-completo/src/golive/gateway.js

### O cliente

Junta HTTP e WebSocket, descobre quem reagiu (diff de reações) e expõe atalhos.

<<< @/../examples/bot-completo/src/golive/client.js

### Mensagens com atalhos

<<< @/../examples/bot-completo/src/golive/structures.js

### Permissões

<<< @/../examples/bot-completo/src/golive/permissions.js

### Sistema de comandos

<<< @/../examples/bot-completo/src/lib/commands.js

### Paginador

<<< @/../examples/bot-completo/src/lib/paginator.js

### Os comandos

::: code-group

<<< @/../examples/bot-completo/src/commands/ping.js [ping.js]

<<< @/../examples/bot-completo/src/commands/ajuda.js [ajuda.js]

<<< @/../examples/bot-completo/src/commands/dado.js [dado.js]

<<< @/../examples/bot-completo/src/commands/escolher.js [escolher.js]

<<< @/../examples/bot-completo/src/commands/usuario.js [usuario.js]

<<< @/../examples/bot-completo/src/commands/membros.js [membros.js]

<<< @/../examples/bot-completo/src/commands/enquete.js [enquete.js]

<<< @/../examples/bot-completo/src/commands/expulsar.js [expulsar.js]

<<< @/../examples/bot-completo/src/commands/banir.js [banir.js]

:::

### Script com o link de instalação

Bot não entra em grupo sozinho: quem gerencia o grupo abre este link e escolhe onde (veja [Colocando o bot num grupo](/guia/entrando-em-grupos)).

<<< @/../examples/bot-completo/scripts/link-de-instalacao.js

## Criando o seu comando

Crie um arquivo em `src/commands/` — ele é carregado sozinho na próxima vez que o bot iniciar:

```js
// src/commands/abracar.js
import { mention, mentionedIds } from "../golive/structures.js";

export default {
  name: "abracar",
  aliases: ["hug"],
  description: "Dá um abraço em alguém.",
  usage: "!abracar @pessoa",
  cooldown: 5,
  async run({ message }) {
    const [target] = mentionedIds(message.text);
    if (!target) return message.reply("Mencione quem vai ganhar o abraço!");
    return message.send(`🤗 ${mention(message.author.id)} abraçou ${mention(target)}!`);
  },
};
```
