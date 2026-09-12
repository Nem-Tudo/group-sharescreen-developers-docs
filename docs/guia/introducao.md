# Introdução

Bem-vindo à documentação para desenvolvedores do **GoLive**. Aqui você aprende a criar bots — programas que entram nos grupos, leem e respondem mensagens, reagem, moderam e conversam por DM, tudo sozinhos.

Os exemplos são em **JavaScript (Node.js)**, mas a API é HTTP + WebSocket comum: qualquer linguagem que fale os dois serve.

## O que é um bot no GoLive?

Um bot é **uma conta como qualquer outra**, com três diferenças:

| | Pessoa | Bot |
|---|---|---|
| Como entra | senha, Discord ou Google | um **token** secreto |
| Nome de usuário | o que a pessoa escolher | sempre termina em `_bot` (ex.: `@musica_bot`) |
| Aparência | nome normal | nome com a etiqueta **BOT** ao lado |

Tirando isso, o bot é tratado igual a uma pessoa: tem perfil em `golive.nemtudo.me/user/<usuario>`, entra em grupos por convite, recebe cargos, obedece às mesmas permissões e aos mesmos limites.

## O que um bot pode fazer

- 💬 **Ler e enviar mensagens** nas salas de texto dos grupos — com imagens, GIFs, respostas e menções.
- ⌨️ **Responder a comandos** como `!ajuda`, `!dado 20` ou `!enquete`.
- 😀 **Reagir** a mensagens e **perceber as reações** das pessoas — a base de enquetes, páginas e cargos por reação.
- 🛡️ **Moderar**: apagar mensagens, expulsar e banir membros, criar e distribuir cargos.
- ✉️ **Conversar por mensagem direta (DM)** com qualquer conta.
- 👤 **Ter um perfil**: nome de exibição, bio e avatar.

## Como funciona: duas conexões

Um bot conversa com o GoLive por dois canais, cada um com seu papel:

```
                ┌───────────────────────────────┐
   AGIR  ─────▶ │  API HTTP                      │  enviar mensagem, reagir,
   (você pede)  │  https://apigolive.nemtudo.me  │  expulsar, ler histórico...
                └───────────────────────────────┘

                ┌───────────────────────────────┐
   OUVIR ◀───── │  WebSocket (tempo real)        │  "chegou mensagem", "alguém
   (o GoLive    │  wss://apigolive.nemtudo.me/ws │  reagiu", "você recebeu DM"...
    avisa)      └───────────────────────────────┘
```

- **HTTP** é para **fazer coisas**. Cada ação é uma requisição (`POST /groups/.../messages`, por exemplo).
- **WebSocket** é para **ficar sabendo das coisas**. O bot abre uma conexão, se identifica com o token e passa a receber eventos no instante em que acontecem.

O ciclo de quase todo bot é: *ouvir um evento no WebSocket → decidir o que fazer → agir pela API HTTP*.

## Vocabulário

| Termo | O que é |
|---|---|
| **Grupo** | Um espaço permanente com várias salas, membros e cargos (parecido com um servidor do Discord). |
| **Sala de texto** | Um canal de conversa dentro do grupo. Na API: `channel`, com `kind: "text"`. |
| **Sala de voz** | Canal de chamada do grupo (`kind: "voice"`). Bots não participam de chamadas. |
| **Cargo** | Um papel (ex.: "Moderação") que dá permissões a quem o tem. Na API: `role`. |
| **@everyone** | As permissões que todo membro tem por padrão. |
| **Convite** | Um link `golive.nemtudo.me/invite/<código>` que deixa alguém entrar num grupo. |
| **DM** | Mensagem direta entre duas contas. |
| **Sala ao vivo** | As salas de transmissão de tela (`golive.nemtudo.me/watch/<nome>`). Suporte a bots é [experimental](./salas-ao-vivo). |

## Endereços

| | URL |
|---|---|
| API HTTP | `https://apigolive.nemtudo.me` |
| WebSocket | `wss://apigolive.nemtudo.me/ws` |
| Site | `https://golive.nemtudo.me` |

Todas as rotas da API recebem e devolvem **JSON**.

## O que você precisa

- Uma **conta no GoLive** (é ela que cria e é dona dos bots).
- **Node.js 20.6 ou mais novo** — confira com `node -v`.
- Um editor de código e um terminal.

## Por onde seguir

1. [Crie seu bot](./criando-um-bot) e pegue o token.
2. Entenda a [autenticação](./autenticacao).
3. Escreva [seu primeiro bot](./primeiro-bot) — um ping-pong em 30 linhas.
4. [Coloque o bot num grupo](./entrando-em-grupos).
5. Depois, avance: [comandos](./comandos), [reações](./reacoes), [páginas por reação](./paginas-por-reacao), [moderação](./moderacao).

::: tip Pressa?
O [bot completo](/exemplos/bot-completo) tem tudo desta documentação funcionando junto: comandos, páginas, enquete, moderação, DMs e reconexão. Dá para copiar e adaptar.
:::
