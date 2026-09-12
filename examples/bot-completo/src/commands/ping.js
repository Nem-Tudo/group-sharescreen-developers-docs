export default {
  name: "ping",
  description: "Mostra se o bot está vivo e quanto a API demora para responder.",
  usage: "!ping",
  cooldown: 3,
  async run({ message }) {
    const start = Date.now();
    const sent = await message.reply("🏓 Pong!");
    await message.send(`⏱️ A API respondeu em ${Date.now() - start} ms.`);
    return sent;
  },
};
