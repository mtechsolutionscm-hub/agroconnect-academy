/**
 * Outils communs aux routes : réponse JSON, utilisateur courant, protection contre les requêtes intersites.
 */
import { createHash } from 'node:crypto';
import { env } from './env';
import { SESSION_COOKIE, cookieValue, readSessionToken } from './auth';
import { getRepo } from './repo';
import type { Repo, User } from './repo/types';
import type { Result } from './academy';

export function json(r: Result | { status: number; body: unknown }, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
}

export async function currentUser(req: Request, repo?: Repo): Promise<User | null> {
  const uid = readSessionToken(cookieValue(req.headers.get('cookie'), SESSION_COOKIE));
  if (!uid) return null;
  return (repo || (await getRepo())).findUserById(uid);
}

/** Identifiant de limite de fréquence : compte, sinon empreinte de l'adresse IP. */
export function who(req: Request, user: User | null): string {
  if (user) return 'u' + user.id;
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'inconnue';
  return 'ip' + createHash('sha256').update(ip + env.sessionSecret).digest('hex').slice(0, 32);
}

/**
 * Requête POST acceptée seulement en JSON et depuis notre propre site (protection contre les formulaires intersites).
 */
export function postGuard(req: Request): Response | null {
  if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
    return json({ status: 415, body: { code: 'aca_json_required', message: 'Requête JSON attendue.' } });
  }
  const origin = req.headers.get('origin');
  if (origin && origin !== env.appUrl) {
    return json({ status: 403, body: { code: 'aca_bad_origin', message: 'Origine non autorisée.' } });
  }
  return null;
}

export async function readJson(req: Request): Promise<any> {
  try { return await req.json(); } catch { return null; }
}
