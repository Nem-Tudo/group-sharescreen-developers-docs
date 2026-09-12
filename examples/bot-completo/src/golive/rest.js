// Cliente HTTP da API do GoLive.
//
// Toda requisição leva `Authorization: Bot <token>`. Respostas 429 (limite de
// requisições) são repetidas sozinhas depois do tempo que o servidor pede no
// cabeçalho `retry-after`, e erros de rede são repetidos com espera
// exponencial. Qualquer outra resposta de erro vira um GoLiveApiError.

export const DEFAULT_API_URL = "https://apigolive.nemtudo.me";

export class GoLiveApiError extends Error {
  constructor(method, path, status, body) {
    super(`${method} ${path} falhou (${status}): ${body?.error ?? body?.message ?? "sem detalhes"}`);
    this.name = "GoLiveApiError";
    this.method = method;
    this.path = path;
    this.status = status;
    this.body = body;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Aceita o token com ou sem o prefixo "Bot " — o site copia com o prefixo. */
export function toCredential(token) {
  const trimmed = String(token ?? "").trim();
  return trimmed.startsWith("Bot ") ? trimmed : `Bot ${trimmed}`;
}

export class Rest {
  constructor({ token, baseUrl = DEFAULT_API_URL, maxRetries = 3 }) {
    this.credential = toCredential(token);
    this.baseUrl = (baseUrl ?? DEFAULT_API_URL).replace(/\/+$/, "");
    this.maxRetries = maxRetries;
  }

  async request(method, path, body) {
    for (let attempt = 0; ; attempt += 1) {
      let response;
      try {
        response = await fetch(this.baseUrl + path, {
          method,
          headers: {
            Authorization: this.credential,
            // Só com corpo: a API recusa um Content-Type JSON sem corpo.
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (err) {
        if (attempt >= this.maxRetries) throw err;
        await sleep(1000 * 2 ** attempt);
        continue;
      }

      if (response.status === 429 && attempt < this.maxRetries) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
        continue;
      }

      const text = await response.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text };
        }
      }
      if (!response.ok) throw new GoLiveApiError(method, path, response.status, data);
      return data;
    }
  }

  get(path) {
    return this.request("GET", path);
  }

  post(path, body = {}) {
    return this.request("POST", path, body);
  }

  put(path, body = {}) {
    return this.request("PUT", path, body);
  }

  patch(path, body = {}) {
    return this.request("PATCH", path, body);
  }

  delete(path) {
    return this.request("DELETE", path);
  }
}
