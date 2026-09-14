import { GoLiveClient } from "./golive/client.js";
import { CommandHandler } from "./lib/commands.js";

const client = new GoLiveClient({
  token: process.env.GOLIVE_TOKEN,
  apiUrl: process.env.GOLIVE_API_URL,
  gatewayUrl: process.env.GOLIVE_GATEWAY_URL,
});

const commands = new CommandHandler(client, { prefix: process.env.PREFIX || "!" });
await commands.loadFolder(new URL("./commands/", import.meta.url));

client.on("ready", async (me) => {
  console.log(`✅ Conectado como ${me.displayName} (@${me.username})`);
  const groups = await client.fetchGroups();
  console.log(`📚 Estou em ${groups.length} grupo(s): ${groups.map((g) => g.name).join(", ") || "nenhum"}`);
  if (groups.length === 0) {
    console.log(`➕ Para me colocar num grupo, quem gerencia o grupo abre: ${client.installUrl(process.env.GOLIVE_SITE_URL)}`);
  }
  console.log(`⌨️  ${commands.commands.size} comandos carregados. Prefixo: ${commands.prefix}`);
});

client.on("reconnected", () => console.log("🔄 Reconectado."));
client.on("reconnecting", ({ delay }) => console.log(`⚠️  Conexão perdida, tentando de novo em ${delay} ms...`));
client.on("error", (err) => console.error("❌", err.message));

// Comandos com prefixo.
client.on("messageCreate", (message) => {
  commands.handle(message).catch((err) => console.error(err));
});

// Quando alguém menciona o bot sem usar um comando, ele se apresenta.
client.on("messageCreate", async (message) => {
  if (message.author.bot || commands.parse(message.text)) return;
  if (!message.mentionsUser(client.user.id)) return;
  await message.reply(`Oi, ${message.author.name}! 👋 Digite ${commands.prefix}ajuda para ver o que eu sei fazer.`);
});

// Mensagens diretas.
client.on("directMessage", async (dm) => {
  if (dm.author.bot) return;
  const text = dm.text.trim().toLowerCase();
  if (text === "ajuda" || text === `${commands.prefix}ajuda`) {
    const list = [...commands.commands.values()].map((c) => `• ${commands.prefix}${c.name} — ${c.description}`);
    await dm.reply(`Meus comandos funcionam nas salas de texto dos grupos:\n${list.join("\n")}`);
  } else {
    await dm.reply("Oi! Mande \"ajuda\" para ver meus comandos. 🤖");
  }
});

client.on("groupAdd", async ({ groupId }) => {
  const { group } = await client.fetchGroup(groupId);
  console.log(`🎉 Fui adicionado ao grupo ${group.name}.`);
});
client.on("groupRemove", ({ groupId, reason }) => console.log(`🚪 Saí do grupo ${groupId} (${reason}).`));

// Um erro esquecido num handler não pode derrubar o bot.
process.on("unhandledRejection", (err) => console.error("Promise rejeitada:", err));

function shutdown() {
  console.log("\n👋 Desligando...");
  client.destroy(); // fecha o WebSocket sem tentar reconectar
  setTimeout(() => process.exit(0), 500);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await client.login();
