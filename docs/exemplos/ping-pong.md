# Ping-pong (mínimo)

O menor bot que funciona: responde `!ping` com `Pong! 🏓`. Um arquivo, uma dependência. A explicação linha a linha está em [Seu primeiro bot](/guia/primeiro-bot).

## Arquivos

::: code-group

<<< @/../examples/ping-pong/index.js [index.js]

<<< @/../examples/ping-pong/package.json [package.json]

```ini [.env]
GOLIVE_TOKEN=Bot cole-o-token-aqui
```

:::

## Rodando

```bash
npm install
npm start
```

## Para ir além

Este exemplo não reconecta nem trata erros — é de propósito, para caber numa tela. Para um bot que fica no ar, parta do [bot completo](./bot-completo).
