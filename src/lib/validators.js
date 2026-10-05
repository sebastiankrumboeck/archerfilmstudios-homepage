export function canJoin(count, max, memberIds, userId) {
  if (memberIds.includes(userId)) return { ok: false, reason: 'already' };
  if (max != null && count >= max) return { ok: false, reason: 'full' };
  return { ok: true, reason: null };
}

export function isLastAdmin(admins, userId) {
  return admins.length === 1 && admins[0].id === userId;
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '');
}
