// O menor bot possível: responde "!ping" com "Pong!".
//
//   npm install ws
//   GOLIVE_TOKEN="Bot seu-token" node index.js

import WebSocket from "ws";

const API = process.env.GOLIVE_API_URL ?? "https://apigolive.nemtudo.me";
const GATEWAY = process.env.GOLIVE_GATEWAY_URL ?? "wss://apigolive.nemtudo.me/ws";
const TOKEN = process.env.GOLIVE_TOKEN?.startsWith("Bot ")
  ? process.env.GOLIVE_TOKEN
  : `Bot ${process.env.GOLIVE_TOKEN}`;

// 1. Descobre quem é o bot (e confere se o token funciona).
const meResponse = await fetch(`${API}/auth/me`, { headers: { Authorization: TOKEN } });
if (!meResponse.ok) throw new Error(`Token inválido (HTTP ${meResponse.status})`);
const { account: me } = await meResponse.json();

// 2. Abre a conexão em tempo real e se registra com o token.
const ws = new WebSocket(GATEWAY);

ws.on("open", () => {
  ws.send(JSON.stringify({ type: "register", token: TOKEN }));
});

ws.on("message", async (data) => {
  const event = JSON.parse(data.toString());

  if (event.type === "registered") {
    console.log(`Conectado como ${me.displayName} (@${me.username})`);
  }

  // 3. Uma mensagem nova numa sala de texto de algum grupo do bot.
  if (event.type === "group-message") {
    const { message, author } = event;
    if (author.bot) return; // ignora outros bots e a si mesmo
    if (message.text.trim() !== "!ping") return;

    // 4. Responde pela API HTTP.
    await fetch(`${API}/groups/${message.groupId}/channels/${message.channelId}/messages`, {
      method: "POST",
      headers: { Authorization: TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Pong! 🏓",
        replyTo: { id: message.id, name: author.name, text: message.text, userId: author.id },
      }),
    });
  }
});

ws.on("close", (code) => {
  console.log(`Conexão fechada (${code}). Num bot de verdade, reconecte aqui.`);
});
