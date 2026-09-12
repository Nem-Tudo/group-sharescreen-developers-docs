import { chunkLines, paginate } from "../lib/paginator.js";

const ROLE_BADGE = { owner: "👑", admin: "🛡️", member: "•" };

export default {
  name: "membros",
  aliases: ["members"],
  description: "Lista os membros do grupo em páginas (navegue com ⬅️ ➡️).",
  usage: "!membros",
  cooldown: 10,
  async run({ client, message }) {
    // Sem parâmetros, a rota devolve o grupo inteiro. Em grupos muito grandes,
    // prefira as fatias: ?online=1, ?online=0&after=<id>&limit=100, ?q=nome.
    const { members } = await client.rest.get(`/groups/${message.groupId}/members`);
    const lines = members.map((m) => {
      const status = m.online ? "🟢" : "⚫";
      const tag = m.bot ? " [BOT]" : m.guest ? " (convidado)" : "";
      return `${status} ${ROLE_BADGE[m.role] ?? "•"} ${m.name}${tag}`;
    });
    const pages = chunkLines(lines, 10).map((page) => `👥 Membros (${members.length})\n\n${page}`);
    await paginate(message, pages, { time: 120_000 });
  },
};
