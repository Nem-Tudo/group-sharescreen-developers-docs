// Faz o bot entrar num grupo usando um convite.
//
//   npm run entrar -- https://golive.nemtudo.me/invite/AbC12345
//   npm run entrar -- AbC12345

import { Rest } from "../src/golive/rest.js";

const input = process.argv[2];
if (!input) {
  console.error("Uso: npm run entrar -- <link ou código do convite>");
  process.exit(1);
}
const code = input.trim().split("/").filter(Boolean).pop();
const rest = new Rest({ token: process.env.GOLIVE_TOKEN, baseUrl: process.env.GOLIVE_API_URL });

const preview = await rest.get(`/invites/${code}`);
console.log(`Convite para "${preview.group.name}" (${preview.group.memberCount} membros)`);
if (preview.member) {
  console.log("O bot já está neste grupo.");
  process.exit(0);
}

const { groupId } = await rest.post(`/invites/${code}/accept`);
console.log(`✅ Entrei! groupId = ${groupId}`);
