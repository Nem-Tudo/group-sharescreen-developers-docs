---
layout: home

hero:
  name: GoLive Developers
  text: Crie bots para o GoLive
  tagline: Uma API HTTP para agir e um WebSocket para ouvir. Comandos, respostas, reações, páginas, moderação — tudo em JavaScript.
  image:
    src: /icon.png
    alt: GoLive
  actions:
    - theme: brand
      text: Começar agora
      link: /guia/introducao
    - theme: alt
      text: Seu primeiro bot em 5 minutos
      link: /guia/primeiro-bot
    - theme: alt
      text: Referência da API
      link: /referencia/rest

features:
  - icon: 🔑
    title: Um token, e pronto
    details: Crie o bot pelo menu da sua conta, copie o token e envie no cabeçalho <code>Authorization&#58; Bot …</code>. Sem OAuth, sem burocracia.
    link: /guia/criando-um-bot
    linkText: Criar um bot
  - icon: ⚡
    title: Eventos em tempo real
    details: Uma conexão WebSocket entrega cada mensagem, reação, DM e mudança de grupo no instante em que acontece.
    link: /guia/gateway
    linkText: Entender a conexão
  - icon: ⌨️
    title: Comandos
    details: Monte um sistema de comandos com prefixo, argumentos, apelidos, cooldown e checagem de permissão.
    link: /guia/comandos
    linkText: Criar comandos
  - icon: 📄
    title: Páginas por reação
    details: Listas longas viram páginas que as pessoas folheiam clicando em ⬅️ ➡️ — o clássico dos bots, passo a passo.
    link: /guia/paginas-por-reacao
    linkText: Montar um paginador
  - icon: 🛡️
    title: Moderação
    details: Apague mensagens, expulse e bana membros, gerencie cargos — com as mesmas regras de hierarquia que as pessoas seguem.
    link: /guia/moderacao
    linkText: Moderar com o bot
  - icon: 🧪
    title: Exemplos testados
    details: O bot de exemplo tem testes que o rodam contra uma imitação da API — comandos, páginas, DMs e reconexão.
    link: /exemplos/bot-completo
    linkText: Ver o bot completo
---
