// Páginas por reação: o bot mostra uma página e reage com ⬅️ ➡️ ❌. Quem
// clicar numa seta vê a página seguinte.
//
// A API ainda não tem edição de mensagens, então "virar a página" é enviar a
// página nova e apagar a anterior. O efeito na tela é o mesmo: uma mensagem
// só, sempre no fim da conversa.

export const PREV = "⬅️";
export const NEXT = "➡️";
export const STOP = "❌";

/**
 * @param {import("../golive/structures.js").GroupMessage} message
 *   a mensagem que pediu as páginas (define a sala e quem pode navegar)
 * @param {string[]} pages o texto de cada página
 * @param {{ time?: number, authorOnly?: boolean }} options
 *   time: quanto tempo (ms) sem uso até o paginador parar
 *   authorOnly: só quem pediu pode virar as páginas
 */
export async function paginate(message, pages, { time = 120_000, authorOnly = true } = {}) {
  const { client, groupId, channelId } = message;
  if (pages.length === 0) throw new Error("Nada para paginar.");

  let index = 0;
  let current = null;
  let busy = false;
  let timer = null;
  let stopped = false;

  const render = (i) => (pages.length > 1 ? `${pages[i]}\n\n📄 Página ${i + 1}/${pages.length}` : pages[i]);

  async function show(i) {
    const previous = current;
    // Sem replyTo com userId: cada página nova notificaria o autor de novo.
    current = await client.sendMessage(groupId, channelId, { text: render(i) });
    if (previous) await client.deleteMessage(groupId, channelId, previous.id).catch(() => {});
    if (pages.length > 1) {
      // Uma de cada vez, para as setas aparecerem sempre na mesma ordem.
      for (const emoji of [PREV, NEXT, STOP]) await client.react(groupId, channelId, current.id, emoji);
    }
  }

  function armTimer() {
    clearTimeout(timer);
    timer = setTimeout(() => void stop({ deleteMessage: false }), time);
  }

  async function stop({ deleteMessage }) {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    client.off("reactionAdd", onReaction);
    if (!current) return;
    if (deleteMessage) {
      await client.deleteMessage(groupId, channelId, current.id).catch(() => {});
    } else if (pages.length > 1) {
      // Tira as setas do bot: sinal de que o paginador expirou.
      for (const emoji of [PREV, NEXT, STOP]) {
        await client.react(groupId, channelId, current.id, emoji, false).catch(() => {});
      }
    }
  }

  async function onReaction(event) {
    if (stopped || busy || !current || event.messageId !== current.id) return;
    if (event.userId === client.user.id) return;
    if (authorOnly && event.userId !== message.author.id) return;

    let next;
    if (event.emoji === PREV) next = index === 0 ? pages.length - 1 : index - 1;
    else if (event.emoji === NEXT) next = (index + 1) % pages.length;
    else if (event.emoji === STOP) return stop({ deleteMessage: true });
    else return;

    busy = true;
    try {
      index = next;
      await show(index);
      armTimer();
    } catch (err) {
      console.error("[paginador]", err);
    } finally {
      busy = false;
    }
  }

  await show(index);
  if (pages.length > 1) {
    client.on("reactionAdd", onReaction);
    armTimer();
  }
  return { stop: () => stop({ deleteMessage: false }) };
}

/** Divide uma lista em páginas de `size` linhas. */
export function chunkLines(lines, size = 10) {
  const pages = [];
  for (let i = 0; i < lines.length; i += size) pages.push(lines.slice(i, i + size).join("\n"));
  return pages;
}
