import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessAdminPanel } from './authHelpers.js';

test('allows owner uid to access admin panel', () => {
  assert.equal(canAccessAdminPanel({ uid: 'owner-123' }, false, false, 'owner-123'), true);
});

test('allows dev admin access', () => {
  assert.equal(canAccessAdminPanel({ uid: 'someone-else' }, true, false, 'owner-123'), true);
});

test('allows admin session after successful login', () => {
  assert.equal(canAccessAdminPanel({ uid: 'someone-else' }, false, true, 'owner-123'), true);
});

test('blocks normal participant', () => {
  assert.equal(canAccessAdminPanel({ uid: 'someone-else' }, false, false, 'owner-123'), false);
});
