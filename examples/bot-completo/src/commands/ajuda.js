export default {
  name: "ajuda",
  aliases: ["help", "comandos"],
  description: "Lista os comandos, ou explica um deles.",
  usage: "!ajuda [comando]",
  async run({ message, args, handler }) {
    const p = handler.prefix;
    if (args[0]) {
      const command = handler.find(args[0].replace(p, ""));
      if (!command) return message.reply(`Não conheço o comando "${args[0]}".`);
      const aliases = command.aliases?.length ? `\nTambém: ${command.aliases.map((a) => p + a).join(", ")}` : "";
      return message.reply(`${p}${command.name} — ${command.description}\nUso: ${command.usage ?? p + command.name}${aliases}`);
    }
    const lines = [...handler.commands.values()].map((c) => `• ${p}${c.name} — ${c.description}`);
    return message.reply(`📖 Comandos disponíveis:\n${lines.join("\n")}\n\nDigite ${p}ajuda <comando> para detalhes.`);
  },
};
