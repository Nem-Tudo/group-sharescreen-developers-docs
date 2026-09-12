# Perfil do bot

O bot tem um perfil público como qualquer conta, em `golive.nemtudo.me/user/<usuario>`. A etiqueta **BOT** aparece sozinha ao lado do nome, em todo lugar.

## Editando o perfil

<span class="http patch">PATCH</span> `/account/profile` — com o token do bot, edita o perfil do próprio bot. Mande só os campos que quer mudar.

| Campo | Regras |
|---|---|
| `displayName` | 1 a 24 caracteres. |
| `bio` | Até 500 caracteres. `null` apaga. |
| `avatar` | Um dos avatares padrão (veja abaixo). `null` volta ao padrão. |

```js
const API = "https://apigolive.nemtudo.me";
const TOKEN = process.env.GOLIVE_TOKEN;

const res = await fetch(`${API}/account/profile`, {
  method: "PATCH",
  headers: { Authorization: TOKEN, "Content-Type": "application/json" },
  body: JSON.stringify({
    displayName: "DJ do Grupo",
    bio: "Eu toco as músicas e organizo as enquetes. Digite !ajuda 🎵",
  }),
});
console.log(res.status, await res.json());
```

## Avatar

Os avatares que uma conta pode usar dependem do plano dela, e um bot começa como uma conta gratuita. Para saber quais estão liberados:

<span class="http get">GET</span> `/account/avatars`

```js
const avatars = await fetch(`${API}/account/avatars`, { headers: { Authorization: TOKEN } })
  .then((r) => r.json());
// {
//   defaults: ["/assets/default_avatars/01.png", "/assets/default_avatars/02.png"],
//   gallery: [...],          // avatares da galeria
//   canUseGallery: false,    // galeria é do plano Pro
//   canUpload: false         // imagem própria é do plano Pro Max
// }

await fetch(`${API}/account/profile`, {
  method: "PATCH",
  headers: { Authorization: TOKEN, "Content-Type": "application/json" },
  body: JSON.stringify({ avatar: avatars.defaults[1] }),
});
```

Quando a conta pode enviar imagem própria (`canUpload: true`), o `avatar` aceita também uma *data URL* (`data:image/png;base64,...`).

## Lendo perfis

<span class="http get">GET</span> `/users/:usuarioOuId` — público, sem autenticação. Aceita o @usuário (sem o @) ou o id.

```js
const { account, live } = await fetch(`${API}/users/maria`).then((r) => r.json());

console.log(account.displayName, account.bio, account.bot);
if (live) console.log(`Ao vivo em /watch/${live.room} com ${live.peopleCount} pessoas`);
```

`live` é a sala ao vivo pública em que a pessoa está agora, ou `null`.
