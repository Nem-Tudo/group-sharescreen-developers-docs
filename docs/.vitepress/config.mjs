import { defineConfig } from "vitepress";

const SITE_URL = "https://golive-docs-developers.nemtudo.me";

export default defineConfig({
  lang: "pt-BR",
  title: "GoLive Developers",
  description: "Documentação da API de bots do GoLive: autenticação, mensagens, comandos, reações e muito mais.",
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: SITE_URL },

  head: [
    ["link", { rel: "icon", href: "/favicon.ico" }],
    ["link", { rel: "apple-touch-icon", href: "/icon.png" }],
    ["meta", { name: "theme-color", content: "#0a8cff" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "GoLive Developers" }],
    ["meta", { property: "og:image", content: `${SITE_URL}/icon.png` }],
  ],

  markdown: {
    theme: { light: "github-light", dark: "github-dark" },
    lineNumbers: false,
  },

  themeConfig: {
    logo: "/icon.png",
    siteTitle: "GoLive Developers",

    nav: [
      { text: "Guia", link: "/guia/introducao", activeMatch: "/guia/" },
      { text: "Referência", link: "/referencia/rest", activeMatch: "/referencia/" },
      { text: "Exemplos", link: "/exemplos/bot-completo", activeMatch: "/exemplos/" },
      { text: "Portal do desenvolvedor", link: "https://golive.nemtudo.me/developers" },
      { text: "Abrir o GoLive", link: "https://golive.nemtudo.me" },
    ],

    sidebar: {
      "/": [
        {
          text: "Começando",
          items: [
            { text: "Introdução", link: "/guia/introducao" },
            { text: "Criando seu bot", link: "/guia/criando-um-bot" },
            { text: "Autenticação", link: "/guia/autenticacao" },
            { text: "Seu primeiro bot", link: "/guia/primeiro-bot" },
            { text: "Colocando o bot num grupo", link: "/guia/entrando-em-grupos" },
          ],
        },
        {
          text: "O essencial",
          items: [
            { text: "Conexão em tempo real", link: "/guia/gateway" },
            { text: "Enviando mensagens", link: "/guia/enviando-mensagens" },
            { text: "Respondendo mensagens", link: "/guia/respondendo-mensagens" },
            { text: "Mensagens diretas (DM)", link: "/guia/mensagens-diretas" },
            { text: "Perfil do bot", link: "/guia/perfil-do-bot" },
          ],
        },
        {
          text: "Avançado",
          items: [
            { text: "Criando comandos", link: "/guia/comandos" },
            { text: "Reações e enquetes", link: "/guia/reacoes" },
            { text: "Páginas por reação", link: "/guia/paginas-por-reacao" },
            { text: "Permissões e cargos", link: "/guia/permissoes" },
            { text: "Moderação", link: "/guia/moderacao" },
            { text: "Webhooks", link: "/guia/webhooks" },
            { text: "Entrar com GoLive (OAuth2)", link: "/guia/oauth2" },
            { text: "OpenID Connect", link: "/guia/openid-connect" },
            { text: "Organizando um bot grande", link: "/guia/estrutura" },
            { text: "Salas ao vivo (experimental)", link: "/guia/salas-ao-vivo" },
          ],
        },
        {
          text: "Produção",
          items: [
            { text: "Limites e boas práticas", link: "/guia/boas-praticas" },
            { text: "Colocando no ar", link: "/guia/hospedagem" },
            { text: "Perguntas frequentes", link: "/guia/faq" },
          ],
        },
        {
          text: "Referência",
          items: [
            { text: "API REST", link: "/referencia/rest" },
            { text: "OAuth2", link: "/referencia/oauth2" },
            { text: "Eventos do WebSocket", link: "/referencia/eventos" },
            { text: "Objetos", link: "/referencia/objetos" },
            { text: "Permissões", link: "/referencia/permissoes" },
            { text: "Limites", link: "/referencia/limites" },
            { text: "Erros", link: "/referencia/erros" },
          ],
        },
        {
          text: "Exemplos",
          items: [
            { text: "Ping-pong (mínimo)", link: "/exemplos/ping-pong" },
            { text: "Bot completo", link: "/exemplos/bot-completo" },
          ],
        },
      ],
    },

    search: {
      provider: "local",
      options: {
        translations: {
          button: { buttonText: "Buscar", buttonAriaLabel: "Buscar na documentação" },
          modal: {
            displayDetails: "Mostrar detalhes",
            resetButtonTitle: "Limpar busca",
            backButtonTitle: "Fechar busca",
            noResultsText: "Nada encontrado para",
            footer: {
              selectText: "abrir",
              selectKeyAriaLabel: "enter",
              navigateText: "navegar",
              navigateUpKeyAriaLabel: "seta para cima",
              navigateDownKeyAriaLabel: "seta para baixo",
              closeText: "fechar",
              closeKeyAriaLabel: "esc",
            },
          },
        },
      },
    },

    outline: { level: [2, 3], label: "Nesta página" },
    docFooter: { prev: "Anterior", next: "Próxima" },
    lastUpdated: { text: "Atualizado em", formatOptions: { dateStyle: "short" } },
    darkModeSwitchLabel: "Aparência",
    lightModeSwitchTitle: "Mudar para o tema claro",
    darkModeSwitchTitle: "Mudar para o tema escuro",
    sidebarMenuLabel: "Menu",
    returnToTopLabel: "Voltar ao topo",
    externalLinkIcon: true,
    notFound: {
      title: "PÁGINA NÃO ENCONTRADA",
      quote: "Esse endereço não existe — talvez a página tenha mudado de nome.",
      linkLabel: "ir para o início",
      linkText: "Voltar ao início",
    },
    footer: {
      message: "Feito para quem constrói bots no GoLive.",
      copyright: "GoLive · nemtudo.me",
    },
  },
});
