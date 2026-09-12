import { mention, mentionedIds } from "../golive/structures.js";
import { GoLiveApiError } from "../golive/rest.js";

export default {
  name: "expulsar",
  aliases: ["kick"],
  description: "Expulsa alguém do grupo (a pessoa pode voltar com um convite).",
  usage: "!expulsar @pessoa [motivo]",
  permission: "kickMembers",
  async run({ client, message }) {
    const [targetId] = mentionedIds(message.text);
    if (!targetId) return message.reply(`Mencione quem deve sair. Uso: ${this.usage}`);
    if (targetId === client.user.id) return message.reply("Não vou me expulsar 😅");

    try {
      await client.rest.post(`/groups/${message.groupId}/members/${targetId}/kick`);
    } catch (err) {
      // 403: o bot não tem a permissão, ou a pessoa tem cargo igual/acima do dele.
      if (err instanceof GoLiveApiError && (err.status === 403 || err.status === 404)) {
        return message.reply(`Não consegui: ${err.body?.error ?? "sem permissão"}`);
      }
      throw err;
    }
    const reason = message.text.replace(/^\S+\s*/, "").replace(/<@[^>]+>/g, "").trim();
    return message.send(`👢 ${mention(targetId)} foi expulso(a).${reason ? ` Motivo: ${reason}` : ""}`);
  },
};
