# Perfil do bot

O bot tem um perfil público como qualquer conta, em `golive.nemtudo.me/user/<usuario>`. A etiqueta **BOT** aparece sozinha ao lado do nome, em todo lugar, e o perfil tem um botão **Adicionar a um grupo** (veja [Colocando o bot num grupo](./entrando-em-grupos)).

Bots têm **todos os extras de perfil sem precisar de plano**: avatar da galeria, imagem própria (inclusive GIF animado), banner, fundo em degradê e música. O que um bot **não** ganha é o resto do Pro: nada de selo PRO, qualidade de transmissão maior ou temas aplicados em salas.

O jeito mais fácil de editar é pela aba **Informações gerais** do [portal do desenvolvedor](https://golive.nemtudo.me/developers), com prévia ao vivo. O próprio bot também pode se editar pela API.

## Editando o perfil

<span class="http patch">PATCH</span> `/account/profile` — com o token do bot, edita o perfil do próprio bot. Mande só os campos que quer mudar.

| Campo | Regras |
|---|---|
| `displayName` | 1 a 24 caracteres. |
| `bio` | Até 500 caracteres. `null` apaga. |
| `avatar` | Um avatar padrão ou da galeria (veja abaixo), ou uma imagem própria como *data URL*. `null` volta ao padrão. |
| `banner` | Uma imagem como *data URL*. `null` remove. |
| `profileTheme` | `{ from: "#4f46e5", to: "#9333ea", angle: 135 }` — o degradê do cartão. `angle` é 0, 45, 90, ..., 315. `null` remove. |
| `song` | Link de um vídeo do YouTube que toca no perfil. `null` ou `""` remove. |
| `songVolume` | 0 a 100. |

Imagens: PNG, JPEG, WebP, GIF ou AVIF, até **5 MB**, no formato `data:image/png;base64,...`.

```js
import { readFile } from "node:fs/promises";

const API = "https://apigolive.nemtudo.me";
const TOKEN = process.env.GOLIVE_TOKEN;

const avatar = `data:image/png;base64,${(await readFile("avatar.png")).toString("base64")}`;

const res = await fetch(`${API}/account/profile`, {
  method: "PATCH",
  headers: { Authorization: TOKEN, "Content-Type": "application/json" },
  body: JSON.stringify({
    displayName: "DJ do Grupo",
    bio: "Eu toco as músicas e organizo as enquetes. Digite !ajuda 🎵",
    avatar,
    profileTheme: { from: "#4f46e5", to: "#9333ea", angle: 135 },
  }),
});
console.log(res.status, await res.json());
```

O dono do bot pode fazer a mesma coisa com a sessão dele, por <span class="http patch">PATCH</span> `/account/bots/:id` (veja [Criando seu bot](./criando-um-bot#pela-api-avancado)).

## Avatares prontos

<span class="http get">GET</span> `/account/avatars` lista os avatares padrão e os da galeria. Para um bot, `canUseGallery` e `canUpload` vêm sempre `true`.

```js
const avatars = await fetch(`${API}/account/avatars`, { headers: { Authorization: TOKEN } })
  .then((r) => r.json());
// {
//   defaults: ["/assets/default_avatars/01.png", "/assets/default_avatars/02.png"],
//   gallery: ["/assets/avatars/01.png", ...],
//   canUseGallery: true,
//   canUpload: true     // false só se o servidor não tiver envio de imagens configurado
// }

await fetch(`${API}/account/profile`, {
  method: "PATCH",
  headers: { Authorization: TOKEN, "Content-Type": "application/json" },
  body: JSON.stringify({ avatar: avatars.gallery[3] }),
});
```

## Lendo perfis

<span class="http get">GET</span> `/users/:usuarioOuId` — público, sem autenticação. Aceita o @usuário (sem o @) ou o id.

```js
const { account, live } = await fetch(`${API}/users/maria`).then((r) => r.json());

console.log(account.displayName, account.bio, account.bot);
if (live) console.log(`Ao vivo em /watch/${live.room} com ${live.peopleCount} pessoas`);
```

`live` é a sala ao vivo pública em que a pessoa está agora, ou `null`.
