// Mostra o link para adicionar o bot a um grupo, e em quais grupos ele já está.
//
//   npm run link
//
// Bot não entra em grupo sozinho — nem com convite. Quem gerencia o grupo
// (tem a permissão "Gerenciar grupo") abre este link, escolhe o grupo e o bot
// entra. O mesmo link fica na aba "Instalação" do portal do desenvolvedor.

import { Rest } from "../src/golive/rest.js";

const SITE_URL = (process.env.GOLIVE_SITE_URL || "https://golive.nemtudo.me").replace(/\/+$/, "");
const rest = new Rest({ token: process.env.GOLIVE_TOKEN, baseUrl: process.env.GOLIVE_API_URL });

const { account } = await rest.get("/auth/me");
const { groups } = await rest.get("/groups");

console.log(`🤖 ${account.displayName} (@${account.username})`);
console.log(`➕ Link para adicionar a um grupo: ${SITE_URL}/bots/${account.id}/add`);
console.log(
  groups.length
    ? `📚 Já estou em: ${groups.map((g) => g.name).join(", ")}`
    : "📚 Ainda não estou em nenhum grupo."
);
