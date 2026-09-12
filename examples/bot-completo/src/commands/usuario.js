import { mentionedIds } from "../golive/structures.js";

export default {
  name: "usuario",
  aliases: ["user", "perfil"],
  description: "Mostra o perfil de alguém (mencione a pessoa, ou nada para você).",
  usage: "!usuario [@pessoa]",
  cooldown: 3,
  async run({ client, message }) {
    // Uma menção chega no texto como <@id>.
    const targetId = mentionedIds(message.text)[0] ?? message.author.id;
    if (targetId.startsWith("guest:")) return message.reply("Convidados não têm perfil.");

    const { account, live } = await client.rest.get(`/users/${targetId}`);
    const created = new Date(account.createdAt).toLocaleDateString("pt-BR");
    const lines = [
      `👤 ${account.displayName} (@${account.username})${account.bot ? " [BOT]" : ""}`,
      account.bio ? `📝 ${account.bio}` : null,
      `📅 Conta criada em ${created}`,
      live ? `🔴 Ao vivo agora: https://golive.nemtudo.me/watch/${live.room} (${live.peopleCount} pessoas)` : null,
      `🔗 https://golive.nemtudo.me/user/${account.username}`,
    ];
    return message.reply(lines.filter(Boolean).join("\n"));
  },
};
