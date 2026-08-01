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

export function canAccessAdminPanel(user, isDevAdmin = false, isAdminSession = false, ownerUid = '') {
  if (!user) return false;
  if (isDevAdmin) return true;
  if (isAdminSession) return true;
  return user.uid === ownerUid;
}

export function getAuthPersistenceForRole(role) {
  return role === AUTH_ROLES.admin ? 'inMemory' : 'browserLocal';
}
