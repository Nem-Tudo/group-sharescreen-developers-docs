import { mention, mentionedIds } from "../golive/structures.js";
import { GoLiveApiError } from "../golive/rest.js";

export default {
  name: "banir",
  aliases: ["ban"],
  description: "Bane alguém do grupo (não pode voltar até ser desbanido).",
  usage: "!banir @pessoa [motivo]",
  permission: "banMembers",
  async run({ client, message }) {
    const [targetId] = mentionedIds(message.text);
    if (!targetId) return message.reply(`Mencione quem deve ser banido. Uso: ${this.usage}`);
    if (targetId === client.user.id) return message.reply("Não vou me banir 😅");

    try {
      await client.rest.post(`/groups/${message.groupId}/bans/${targetId}`);
    } catch (err) {
      if (err instanceof GoLiveApiError && (err.status === 403 || err.status === 404)) {
        return message.reply(`Não consegui: ${err.body?.error ?? "sem permissão"}`);
      }
      throw err;
    }
    const reason = message.text.replace(/^\S+\s*/, "").replace(/<@[^>]+>/g, "").trim();
    return message.send(`🔨 ${mention(targetId)} foi banido(a).${reason ? ` Motivo: ${reason}` : ""}`);
  },
};
