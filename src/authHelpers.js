export const AUTH_ROLES = Object.freeze({
  guest: 'guest',
  participant: 'participant',
  admin: 'admin',
});

export function getAuthRole(user, ownerUid, isDevAdmin = false) {
  if (!user) return AUTH_ROLES.guest;
  if (user.uid === ownerUid || isDevAdmin) return AUTH_ROLES.admin;
  return AUTH_ROLES.participant;
}

export function getAuthPersistenceForRole(role) {
  return role === AUTH_ROLES.admin ? 'inMemory' : 'browserLocal';
}
