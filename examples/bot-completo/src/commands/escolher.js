import { randomInt } from "node:crypto";

export default {
  name: "escolher",
  aliases: ["choose"],
  description: "Escolhe uma entre as opções separadas por |.",
  usage: "!escolher pizza | hambúrguer | sushi",
  async run({ message, rest }) {
    const options = rest.split("|").map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) return message.reply("Me dê pelo menos duas opções separadas por |.");
    return message.reply(`🤔 Eu escolho: ${options[randomInt(options.length)]}`);
  },
};
