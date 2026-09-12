// Objetos com atalhos em volta do que a API entrega.

/** `<@id>` — como uma mensagem menciona alguém. */
export const mention = (userId) => `<@${userId}>`;

/** `<#id>` — como uma mensagem aponta para uma sala de texto. */
export const channelMention = (channelId) => `<#${channelId}>`;

/** Os ids mencionados com `<@id>` num texto, em ordem e sem repetir. */
export function mentionedIds(text) {
  return [...new Set([...String(text ?? "").matchAll(/<@([A-Za-z0-9:_-]{1,80})>/g)].map((m) => m[1]))];
}

/** Uma mensagem de sala de texto de grupo (evento "group-message"). */
export class GroupMessage {
  constructor(client, { message, author, mentioned }) {
    this.client = client;
    this.raw = message;
    this.id = message.id;
    this.groupId = message.groupId;
    this.channelId = message.channelId;
    this.text = message.text ?? "";
    this.kind = message.kind ?? "text";
    this.images = message.images ?? [];
    this.gifUrl = message.url ?? null;
    this.replyTo = message.replyTo ?? null;
    this.mentions = message.mentions ?? [];
    this.createdAt = new Date(message.ts);
    /** { id, name, username, avatarUrl, nameColor, flags, bot, guest } */
    this.author = author;
    /** Pessoas mencionadas, por id, com nome e avatar. */
    this.mentioned = mentioned ?? {};
  }

  /** Se a mensagem menciona este usuário (pelo token `<@id>`). */
  mentionsUser(userId) {
    return mentionedIds(this.text).includes(userId) || this.mentions.includes(userId);
  }

  /** Envia uma mensagem na mesma sala. */
  send(content) {
    return this.client.sendMessage(this.groupId, this.channelId, content);
  }

  /**
   * Responde citando esta mensagem. Por padrão o autor é notificado, como uma
   * menção; passe `{ notify: false }` para responder em silêncio.
   */
  reply(content, { notify = true } = {}) {
    const body = typeof content === "string" ? { text: content } : { ...content };
    body.replyTo = {
      id: this.id,
      name: this.author.name,
      text: this.text.slice(0, 200),
      kind: this.kind,
      ...(this.images.length > 0 ? { images: this.images } : {}),
      // É o userId que faz o autor ser notificado da resposta.
      ...(notify ? { userId: this.author.id } : {}),
    };
    return this.send(body);
  }

  react(emoji) {
    return this.client.react(this.groupId, this.channelId, this.id, emoji);
  }

  delete() {
    return this.client.deleteMessage(this.groupId, this.channelId, this.id);
  }
}

/** Uma mensagem direta (evento "dm"). */
export class DirectMessage {
  constructor(client, { message, fromUser }) {
    this.client = client;
    this.raw = message;
    this.id = message.id;
    this.text = message.text ?? "";
    this.kind = message.kind ?? "text";
    this.images = message.images ?? [];
    this.createdAt = new Date(message.ts);
    /** { id, username, displayName, avatarUrl, nameColor, flags, bot } */
    this.author = fromUser;
  }

  reply(content) {
    const body = typeof content === "string" ? { text: content } : { ...content };
    body.replyTo = { id: this.id, name: this.author.displayName, text: this.text.slice(0, 200), kind: this.kind };
    return this.client.sendDirectMessage(this.author.id, body);
  }
}
