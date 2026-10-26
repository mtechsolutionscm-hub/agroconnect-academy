/**
 * Comptes et sessions, sans dépendance : mots de passe hachés avec scrypt, cookie de session signé (HMAC-SHA256).
 */
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { env } from './env';

export const SESSION_COOKIE = 'aca_session';
const N = 16384, R = 8, P = 1, LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, LEN, { N, r: R, p: P });
  return `scrypt$${N}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = String(stored).split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[2], 'base64url');
  const expected = Buffer.from(parts[3], 'base64url');
  const got = scryptSync(password, salt, expected.length, { N: Number(parts[1]), r: R, p: P });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

function sign(data: string): string {
  return createHmac('sha256', env.sessionSecret).update(data).digest('base64url');
}

/** Jeton de session : base64url({ uid, exp }) + '.' + signature. */
export function createSessionToken(userId: number, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: now + env.sessionDays * 86400000 })).toString('base64url');
  return payload + '.' + sign(payload);
}

export function readSessionToken(token: string | undefined | null, now = Date.now()): number | null {
  if (!token || token.indexOf('.') < 0) return null;
  const [payload, sig] = token.split('.');
  const expected = sign(payload);
  const a = Buffer.from(sig || ''), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.uid !== 'number' || typeof data.exp !== 'number' || data.exp < now) return null;
    return data.uid;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string): string {
  const parts = [`${SESSION_COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${env.sessionDays * 86400}`];
  if (env.production) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${env.production ? '; Secure' : ''}`;
}

export function cookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function validEmail(e: unknown): e is string {
  return typeof e === 'string' && e.length <= 190 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
