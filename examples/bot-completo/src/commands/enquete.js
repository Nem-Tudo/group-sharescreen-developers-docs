const NUMBERS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
const DURATION_S = 60;

export default {
  name: "enquete",
  aliases: ["poll"],
  description: `Cria uma votação por reações que termina em ${DURATION_S}s.`,
  usage: "!enquete Qual filme? | Matrix | Duna | Interestelar",
  cooldown: 30,
  async run({ client, message, rest }) {
    const [question, ...options] = rest.split("|").map((part) => part.trim()).filter(Boolean);
    if (!question || options.length < 2 || options.length > NUMBERS.length) {
      return message.reply(`Uso: ${this.usage} (de 2 a ${NUMBERS.length} opções)`);
    }

    const lines = options.map((option, i) => `${NUMBERS[i]} ${option}`);
    const poll = await message.send(
      `📊 ${question}\n\n${lines.join("\n")}\n\nVote reagindo! Resultado em ${DURATION_S} segundos.`
    );
    for (let i = 0; i < options.length; i += 1) {
      await client.react(message.groupId, message.channelId, poll.id, NUMBERS[i]);
    }

    setTimeout(async () => {
      try {
        // Lê as reações direto da API: mais confiável que o cache se o bot
        // tiver reconectado durante a votação.
        const final = await client.fetchMessage(message.groupId, message.channelId, poll.id, poll.ts);
        if (!final) return; // a enquete foi apagada
        const votes = options.map((option, i) => {
          const reaction = final.reactions?.find((r) => r.emoji === NUMBERS[i]);
          // O próprio bot reagiu em todas as opções: não conta como voto.
          const count = (reaction?.users ?? []).filter((id) => id !== client.user.id).length;
          return { option, count };
        });
        const top = Math.max(...votes.map((v) => v.count));
        const result = votes.map((v, i) => `${NUMBERS[i]} ${v.option}: ${v.count} voto(s)${v.count === top && top > 0 ? " 🏆" : ""}`);
        await client.sendMessage(message.groupId, message.channelId, {
          text: `📊 Resultado — ${question}\n\n${result.join("\n")}`,
          replyTo: { id: poll.id, name: client.user.displayName, text: poll.text.slice(0, 200) },
        });
      } catch (err) {
        console.error("[enquete]", err);
      }
    }, DURATION_S * 1000);
  },
};
