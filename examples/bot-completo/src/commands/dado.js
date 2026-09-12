import { randomInt } from "node:crypto";

export default {
  name: "dado",
  aliases: ["roll"],
  description: "Rola um dado (6 lados, ou quantos você disser).",
  usage: "!dado [lados]",
  cooldown: 2,
  async run({ message, args }) {
    const sides = args[0] === undefined ? 6 : Number(args[0]);
    if (!Number.isInteger(sides) || sides < 2 || sides > 1000) {
      return message.reply("Diga um número de lados entre 2 e 1000. Ex.: !dado 20");
    }
    return message.reply(`🎲 Deu ${randomInt(1, sides + 1)} (d${sides})`);
  },
};
