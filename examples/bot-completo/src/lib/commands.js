// Um sistema de comandos com prefixo ("!ping", "!dado 20"...).
//
// Cada comando é um arquivo em src/commands que exporta um objeto:
//
//   export default {
//     name: "ping",
//     aliases: ["p"],
//     description: "Responde pong",
//     usage: "!ping",
//     cooldown: 3,                  // segundos entre usos, por pessoa
//     permission: "kickMembers",    // opcional: permissão exigida de quem usa
//     async run({ client, message, args, rest, handler }) { ... },
//   };

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export class CommandHandler {
  commands = new Map();
  #aliases = new Map();
  #cooldowns = new Map();

  constructor(client, { prefix = "!" } = {}) {
    this.client = client;
    this.prefix = prefix;
  }

  register(command) {
    if (!command?.name || typeof command.run !== "function") {
      throw new Error("Um comando precisa de `name` e de uma função `run`.");
    }
    this.commands.set(command.name.toLowerCase(), command);
    for (const alias of command.aliases ?? []) this.#aliases.set(alias.toLowerCase(), command.name.toLowerCase());
  }

  /** Importa todos os arquivos .js de uma pasta como comandos. */
  async loadFolder(folderUrl) {
    const dir = fileURLToPath(folderUrl);
    for (const file of (await readdir(dir)).filter((f) => f.endsWith(".js")).sort()) {
      const module = await import(pathToFileURL(join(dir, file)).href);
      this.register(module.default);
    }
  }

  find(name) {
    const key = name.toLowerCase();
    return this.commands.get(key) ?? this.commands.get(this.#aliases.get(key));
  }

  /** "!dado  20 " → { name: "dado", args: ["20"], rest: "20" }; null se não for comando. */
  parse(text) {
    if (!text.startsWith(this.prefix)) return null;
    const body = text.slice(this.prefix.length).trim();
    if (!body) return null;
    const [name, ...args] = body.split(/\s+/);
    return { name: name.toLowerCase(), args, rest: body.slice(name.length).trim() };
  }

  async handle(message) {
    // Nunca responda a bots — nem a si mesmo. É o que evita dois bots
    // conversando entre si para sempre.
    if (message.author.bot) return;
    const parsed = this.parse(message.text);
    if (!parsed) return;
    const command = this.find(parsed.name);
    if (!command) return;

    const key = `${command.name}:${message.author.id}`;
    const now = Date.now();
    const until = this.#cooldowns.get(key) ?? 0;
    if (now < until) {
      const seconds = Math.ceil((until - now) / 1000);
      await message.reply(`⏳ Calma! Espere ${seconds}s para usar ${this.prefix}${command.name} de novo.`);
      return;
    }

    if (command.permission) {
      const allowed = await this.client.hasPermission(message.groupId, message.author.id, command.permission);
      if (!allowed) {
        await message.reply("🚫 Você não tem permissão para usar este comando.");
        return;
      }
    }

    if (command.cooldown) this.#setCooldown(key, now + command.cooldown * 1000);

    try {
      await command.run({ client: this.client, message, args: parsed.args, rest: parsed.rest, handler: this });
    } catch (err) {
      console.error(`[comando ${command.name}]`, err);
      await message.reply("❌ Algo deu errado ao executar esse comando.").catch(() => {});
    }
  }

  #setCooldown(key, until) {
    this.#cooldowns.set(key, until);
    // Limpa os vencidos de vez em quando, para o mapa não crescer para sempre.
    if (this.#cooldowns.size > 1000) {
      const now = Date.now();
      for (const [k, t] of this.#cooldowns) if (t <= now) this.#cooldowns.delete(k);
    }
  }
}
