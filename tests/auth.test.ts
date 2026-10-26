import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, createSessionToken, readSessionToken, cookieValue, sessionCookie } from '../src/lib/auth';

test('mots de passe : hachage scrypt et vérification', () => {
  const h = hashPassword('motdepasse-solide');
  assert.match(h, /^scrypt\$16384\$/);
  assert.notEqual(h, hashPassword('motdepasse-solide'));
  assert.equal(verifyPassword('motdepasse-solide', h), true);
  assert.equal(verifyPassword('autre', h), false);
  assert.equal(verifyPassword('x', 'corrompu'), false);
});

test('session : jeton signé, falsification et expiration refusées', () => {
  const t = createSessionToken(42);
  assert.equal(readSessionToken(t), 42);
  const [payload, sig] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ uid: 1, exp: Date.now() + 1e9 })).toString('base64url') + '.' + sig;
  assert.equal(readSessionToken(forged), null);
  assert.equal(readSessionToken(payload + '.abc'), null);
  assert.equal(readSessionToken(createSessionToken(42, Date.now() - 400 * 86400000)), null);
  assert.equal(readSessionToken(''), null);
});

test('cookie : lecture et attributs de sécurité', () => {
  assert.equal(cookieValue('a=1; aca_session=xyz; b=2', 'aca_session'), 'xyz');
  const c = sessionCookie('tok');
  assert.ok(c.includes('HttpOnly') && c.includes('SameSite=Lax') && c.includes('Path=/'));
});
