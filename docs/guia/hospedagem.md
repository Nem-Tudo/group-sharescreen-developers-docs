# Colocando no ar

Enquanto o bot roda no seu computador, ele só funciona com o computador ligado. Para ficar 24 horas no ar, ele precisa rodar num servidor.

## O que o bot precisa

- **Node.js 20.6+** rodando o tempo todo.
- **Internet de saída** para `apigolive.nemtudo.me` (porta 443). O bot **não** precisa de porta aberta, domínio nem HTTPS próprio — ele só se conecta, ninguém se conecta a ele.
- A variável de ambiente `GOLIVE_TOKEN`.
- Pouca memória: um bot típico usa 50–100 MB.

Qualquer VPS, serviço de hospedagem de bots ou máquina que fique ligada serve.

## Com PM2 (VPS ou máquina própria)

O [PM2](https://pm2.keymetrics.io/) mantém o bot rodando, reinicia se ele cair e sobe junto com a máquina.

```bash
npm install -g pm2

# na pasta do bot, com o .env pronto:
pm2 start src/index.js --name meu-bot --node-args="--env-file=.env"

pm2 save        # lembra a lista de processos
pm2 startup     # e mostra o comando para iniciar com o sistema
```

Comandos do dia a dia:

```bash
pm2 logs meu-bot       # ver o que o bot está escrevendo
pm2 restart meu-bot    # reiniciar depois de atualizar o código
pm2 stop meu-bot       # parar
```

## Com Docker

::: code-group

```dockerfile [Dockerfile]
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
CMD ["node", "src/index.js"]
```

```ini [.dockerignore]
node_modules
.env
```

:::

```bash
docker build -t meu-bot .
docker run -d --name meu-bot --restart unless-stopped --env-file .env meu-bot
```

O `--env-file` do Docker entrega o `GOLIVE_TOKEN` como variável de ambiente — por isso o `CMD` não precisa do `--env-file` do Node. O `--restart unless-stopped` religa o bot se ele cair ou se a máquina reiniciar.

## Em serviços de hospedagem

Em plataformas que rodam apps Node (Square Cloud, Discloud, Railway, Render e similares):

- **Comando de início:** `node src/index.js`.
- **Variáveis de ambiente:** cadastre `GOLIVE_TOKEN` (e `PREFIX`, se usar) no painel. Não envie o `.env`.
- **Tipo de serviço:** "worker" ou "bot", não "web" — o bot não abre porta HTTP, e serviços "web" podem desligar o que não responde numa porta.

## Desligando com elegância

Ao receber o sinal de parada (um `pm2 stop`, um `docker stop`, um novo deploy), feche a conexão antes de sair:

```js
function shutdown() {
  console.log("Desligando...");
  client.destroy(); // fecha o WebSocket sem tentar reconectar
  setTimeout(() => process.exit(0), 500);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

## Checklist antes de publicar

- [ ] O token está numa variável de ambiente, e o `.env` está no `.gitignore`.
- [ ] Só **uma** cópia do bot está rodando (desligue a do seu computador!).
- [ ] O bot reconecta sozinho (teste derrubando a internet).
- [ ] O bot ignora mensagens de bots.
- [ ] Comandos de moderação checam a permissão de quem pediu.
- [ ] Erros são tratados e registrados, não derrubam o processo.
- [ ] O bot tem um cargo com só as permissões de que precisa.
