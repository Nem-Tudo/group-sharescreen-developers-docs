# GoLive Developers

Documentação para quem cria bots para o GoLive — publicada em **https://developers-golive.nemtudo.me**.

Os bots em si são criados e gerenciados no portal do desenvolvedor (**https://golive.nemtudo.me/developers**), que é outro repositório: `sharescreen-developers`.

Feita com [VitePress](https://vitepress.dev). O site é estático: o build gera HTML puro em `docs/.vitepress/dist`.

## Rodando

```bash
npm install
npm run dev        # http://localhost:5173, recarrega ao salvar
npm run build      # gera docs/.vitepress/dist
npm run preview    # serve o build localmente
```

## Estrutura

```
docs/
├─ index.md              página inicial
├─ guia/                 o passo a passo, do básico ao avançado
├─ referencia/           rotas, eventos, objetos, permissões, limites, erros
├─ exemplos/             páginas que exibem o código de examples/
├─ public/               ícones
└─ .vitepress/           configuração (menu, busca) e tema
examples/
├─ ping-pong/            o bot mínimo
└─ bot-completo/         comandos, páginas por reação, enquete, moderação, DMs
scripts/
├─ mock-api.mjs          imitação local da API do GoLive
└─ check-examples.mjs    roda os bots de exemplo contra a imitação
```

As páginas de exemplo importam o código direto de `examples/` (`<<< @/../examples/...`), então a documentação mostra sempre o mesmo código que é testado.

## Testando os exemplos

```bash
npm run check:examples
```

Sobe `scripts/mock-api.mjs` (HTTP + WebSocket, só em `127.0.0.1`), roda os dois bots de exemplo contra ela e confere comandos, respostas, menções, permissões, páginas por reação, enquete, DMs e reconexão. Nada fala com a API de verdade.

Ao mudar a API do GoLive (em `sharescreen-api/server`), atualize a imitação e as páginas de referência junto.

## Publicando

Qualquer hospedagem de site estático serve. Configure:

- **Comando de build:** `npm run build`
- **Pasta publicada:** `docs/.vitepress/dist`
- **Node:** 20 ou mais novo

O site usa URLs sem `.html` (`cleanUrls`), e a hospedagem precisa servir `/guia/x` a partir de `guia/x.html`. Sem isso, a navegação dentro do site funciona, mas F5 ou um link externo recebem o `404.html` e a página fica vazia. Na Vercel, o `vercel.json` já liga isso (`"cleanUrls": true`). Num nginx próprio, use `try_files $uri $uri.html $uri/ =404;`.

## De onde vêm as informações

Tudo aqui foi escrito a partir do código do servidor (`sharescreen-api/server`): `auth.ts` e `accountStore.ts` (tokens de bot), `accountRoutes.ts` (criação, exclusão e token dos bots), `signaling.ts` (`PATCH /account/bots/:id` e o captcha das salas), `entitlements.ts` (o que um bot ganha sem plano), `groupRoutes.ts`/`groupStore.ts`/`groupPermissions.ts` (grupos, mensagens, reações, cargos), `dmRoutes.ts`, `socialRoutes.ts`, `signaling.ts` (WebSocket e salas ao vivo), `rateLimiter.ts` e `index.ts` (limites).
