// Resolve, do lado do bot, se alguém tem uma permissão de gerenciamento no
// grupo — a mesma conta que a API faz:
//
//   1. o dono pode tudo;
//   2. "administrator" (no @everyone ou em qualquer cargo da pessoa) libera tudo;
//   3. senão, a permissão precisa estar ligada no @everyone ou em algum cargo.
//
// Serve para as chaves de `manage` (kickMembers, banMembers, manageMessages...),
// que nunca mudam por sala. Para as de texto/voz a sala pode sobrescrever, e
// quem decide de verdade é sempre a API — isto aqui é só para o bot recusar um
// comando cedo, com uma mensagem amigável.

const SECTIONS = ["manage", "general", "text", "voice"];

function permissionIn(permissions, key) {
  for (const section of SECTIONS) {
    const values = permissions?.[section];
    if (values && key in values) return values[key] === true;
  }
  return false;
}

/**
 * @param {{ group: object, memberRoles: Record<string, string[]> }} groupData
 *   a resposta de GET /groups/:id
 */
export function hasPermission(groupData, userId, key) {
  const { group, memberRoles } = groupData;
  if (group.ownerId === userId) return true;
  const held = new Set(memberRoles?.[userId] ?? []);
  const sets = [group.permissions, ...group.roles.filter((r) => held.has(r.id)).map((r) => r.permissions)];
  if (sets.some((p) => p?.manage?.administrator)) return true;
  return sets.some((p) => permissionIn(p, key));
}

/**
 * A posição mais alta entre os cargos da pessoa (0 sem cargo, Infinity para o
 * dono). Só dá para expulsar/banir quem está abaixo de você.
 */
export function rankOf(groupData, userId) {
  const { group, memberRoles } = groupData;
  if (group.ownerId === userId) return Number.POSITIVE_INFINITY;
  const held = new Set(memberRoles?.[userId] ?? []);
  return group.roles.filter((r) => held.has(r.id)).reduce((max, r) => Math.max(max, r.position), 0);
}
