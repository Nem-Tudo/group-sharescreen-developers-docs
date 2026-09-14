# Perguntas frequentes

## Meu bot não recebe nenhuma mensagem

Confira, nesta ordem:

1. **O `register` deu certo?** O bot precisa receber `{ type: "registered" }`. Se recebeu `register-error`, o token está errado.
2. **O bot está no grupo?** `GET /groups` deve listá-lo. Se não, [coloque-o num grupo](./entrando-em-grupos).
3. **O bot vê a sala?** Salas privadas só aparecem para alguns cargos. `GET /groups/:id` lista só as salas que o bot vê.
4. **O código trata `group-message`?** Imprima todo evento (`console.log(event.type)`) para ver o que está chegando.
5. **A conexão está viva?** Eventos só chegam enquanto o WebSocket está aberto — o que aconteceu durante uma queda não chega depois.

## O registro responde "Invalid name."

O token enviado no `register` é inválido. Sem um token válido, o servidor trata a conexão como um visitante que não disse o nome — daí a mensagem. Confira se mandou a credencial completa (`Bot ...`) e se o token não foi trocado.

## Recebo 401 em tudo

O token está errado, sem o prefixo `Bot `, com `Bearer`, ou foi revogado (alguém gerou um novo). Teste com `GET /auth/me`.

## Recebo 404 "Group not found." num grupo que existe

Para quem não é membro, a API responde como se o grupo não existisse. O bot não está naquele grupo (ou foi expulso).

## O bot responde tudo em dobro

Há duas cópias do bot rodando — cada conexão recebe todos os eventos. Desligue a do seu computador, ou procure um processo esquecido (`pm2 list`, `docker ps`).

## O bot não consegue expulsar/banir

Três causas possíveis:

- O bot não tem a permissão (`kickMembers`/`banMembers`) — dê a ele um cargo que tenha.
- O cargo do bot está **abaixo** (ou no mesmo nível) do cargo da pessoa — suba o cargo do bot na lista.
- A pessoa é a dona do grupo — ninguém a remove.

## Dá para editar uma mensagem?

Ainda não existe edição na API. Apague e envie de novo — veja [Páginas por reação](./paginas-por-reacao#como-virar-a-pagina-sem-editar).

## Tem comandos de barra (`/`), botões, menus ou embeds?

Não. Bots do GoLive usam **comandos com prefixo** (`!ajuda`) e **reações como botões**. Mensagens são texto puro, com links, menções, imagens e GIFs.

## Tem markdown (negrito, itálico, código)?

Não — o texto aparece como foi escrito. Use emoji e quebras de linha para organizar.

## O bot pode entrar em chamadas de voz ou transmitir?

Não. Bots participam das salas de texto, das DMs e, de forma [experimental](./salas-ao-vivo), do chat das salas ao vivo. Um bot também não liga para ninguém nem recebe ligações.

## Como coloco o bot num grupo com um convite?

Não dá: bot não entra em grupo sozinho, nem com convite. Quem gerencia o grupo abre o **link do bot** (aba **Instalação** do [portal do desenvolvedor](https://golive-developers.nemtudo.me)) e escolhe o grupo. Veja [Colocando o bot num grupo](./entrando-em-grupos).

## O bot precisa passar pelo captcha?

Não. A verificação anti-robô é para pessoas; conexões com token de bot nunca recebem `captcha-required`.

## O bot pode ter amigos ou assinar o Pro?

Não. Bots não mandam nem recebem pedidos de amizade, e não compram nem recebem planos. Mas não precisam: avatar próprio, banner, degradê e música de perfil já vêm liberados para bots.

## O bot pode tirar a reação de outra pessoa?

Não, só a própria. Por isso o paginador desta documentação envia uma mensagem nova a cada página, com setas "limpas".

## Como descubro o id de alguém?

- De quem escreveu: `event.author.id`.
- De quem foi mencionado: o `<@id>` no texto.
- Pelo @usuário: `GET /users/<usuario>` → `account.id`.
- Pelo nome, dentro de um grupo: `GET /groups/:id/members?q=nome`.

## E o id de um grupo ou de uma sala?

Abra a sala no site: a URL é `golive.nemtudo.me/groups/<groupId>/<channelId>`. Pelo código, `GET /groups` e `GET /groups/:id`.

## Posso usar outra linguagem?

Pode. A API é HTTP + WebSocket + JSON — Python, Go, C#, Java, qualquer uma. Os exemplos são em JavaScript, mas os formatos são os mesmos.

## Posso colocar um avatar próprio no bot?

Enviar uma imagem própria como avatar é do plano Pro Max. Sem ele, o bot usa um dos avatares padrão — veja [Perfil do bot](./perfil-do-bot#avatar).

## Em quantos grupos um bot pode estar?

100, como qualquer conta.

## Meu IP foi banido

Provavelmente o bot estourou os limites do WebSocket várias vezes seguidas (reconectando ou registrando em loop) — isso bane o IP por 60 minutos. Corrija a [reconexão com espera](./gateway#reconectando) e aguarde.

## Os eventos que perdi enquanto o bot estava desligado voltam?

Não. Para recuperar mensagens, leia o histórico com `GET /groups/:id/channels/:cid/messages` ao iniciar.
