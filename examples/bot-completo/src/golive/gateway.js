// Conexão em tempo real (WebSocket) com o GoLive.
//
// É por aqui que o bot fica sabendo de tudo que acontece: mensagens novas,
// reações, DMs, mudanças nos grupos. O ciclo é:
//
//   1. abrir wss://apigolive.nemtudo.me/ws
//   2. o servidor manda { type: "welcome" }
//   3. o bot manda { type: "register", token: "Bot <token>" }
//   4. o servidor responde { type: "registered", ... } — a partir daqui os
//      eventos chegam
//
// O servidor manda um ping de WebSocket a cada 25 segundos; a biblioteca `ws`
// responde sozinha. Se a conexão cair, reconectamos com espera exponencial.

import WebSocket from "ws";
import { EventEmitter } from "node:events";
import { toCredential } from "./rest.js";

export const DEFAULT_GATEWAY_URL = "wss://apigolive.nemtudo.me/ws";

// Código de fechamento de uma conexão banida: não adianta reconectar.
const BANNED_CLOSE_CODE = 4003;
// O servidor pinga a cada 25s. Sem ouvir nada por 60s, a conexão morreu.
const SILENCE_TIMEOUT_MS = 60_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

export class Gateway extends EventEmitter {
  #ws = null;
  #attempt = 0;
  #silenceTimer = null;
  #reconnectTimer = null;
  #stopped = false;

  constructor({ token, url = DEFAULT_GATEWAY_URL }) {
    super();
    this.credential = toCredential(token);
    this.url = url ?? DEFAULT_GATEWAY_URL;
  }

  connect() {
    this.#stopped = false;
    clearTimeout(this.#reconnectTimer);
    const ws = new WebSocket(this.url);
    this.#ws = ws;

    ws.on("open", () => {
      this.#touch();
      this.#register();
    });
    // A `ws` já responde o ping com um pong; só anotamos que o servidor está vivo.
    ws.on("ping", () => this.#touch());
    ws.on("message", (data) => {
      this.#touch();
      let payload;
      try {
        payload = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (payload && typeof payload.type === "string") this.#handle(payload);
    });
    ws.on("close", (code, reason) => {
      if (this.#ws !== ws) return;
      clearTimeout(this.#silenceTimer);
      this.#ws = null;
      this.emit("disconnect", { code, reason: reason.toString() });
      if (this.#stopped) return;
      if (code === BANNED_CLOSE_CODE) {
        this.emit("error", new Error("A conexão foi recusada: esta conta ou IP está banido."));
        return;
      }
      this.#scheduleReconnect();
    });
    // Erros de conexão também disparam "close" logo em seguida, que reconecta.
    ws.on("error", (err) => this.emit("debug", `erro no WebSocket: ${err.message}`));
  }

  /** Envia um objeto pelo WebSocket (ignorado se a conexão não estiver aberta). */
  send(payload) {
    if (this.#ws?.readyState === WebSocket.OPEN) this.#ws.send(JSON.stringify(payload));
  }

  /** Fecha de vez, sem reconectar. */
  close() {
    this.#stopped = true;
    clearTimeout(this.#reconnectTimer);
    clearTimeout(this.#silenceTimer);
    this.#ws?.close(1000);
  }

  #register() {
    this.send({ type: "register", token: this.credential });
  }

  #handle(payload) {
    if (payload.type === "registered") {
      this.#attempt = 0;
    } else if (payload.type === "register-error") {
      if (payload.retryable) {
        // O servidor está subindo: tenta de novo em instantes.
        setTimeout(() => this.#register(), 3000);
      } else {
        // Token inválido ou revogado — reconectar não resolve.
        this.emit(
          "error",
          new Error(`O GoLive recusou o registro: ${payload.message}. Confira o token do bot.`)
        );
        this.close();
      }
    } else if (payload.type === "banned") {
      this.#stopped = true;
    }
    this.emit("dispatch", payload);
  }

  #touch() {
    clearTimeout(this.#silenceTimer);
    this.#silenceTimer = setTimeout(() => {
      this.emit("debug", "sem sinal do servidor há 60s, reconectando");
      this.#ws?.terminate();
    }, SILENCE_TIMEOUT_MS);
  }

  #scheduleReconnect() {
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * 2 ** this.#attempt) + Math.random() * 1000;
    this.#attempt += 1;
    this.emit("reconnecting", { attempt: this.#attempt, delay: Math.round(delay) });
    this.#reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
