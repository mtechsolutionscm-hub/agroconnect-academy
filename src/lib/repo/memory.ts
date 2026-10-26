/**
 * Implémentation en mémoire du stockage, utilisée par les tests automatiques (mêmes règles que MySQL,
 * y compris l'unicité du code et d'une seule attestation active par compte, formation et module).
 */
import type { Repo, User, ProgressRow, CertRow } from './types';

export function memoryRepo(): Repo & { _dump(): unknown } {
  const users: User[] = [];
  const attempts: unknown[] = [];
  const progress = new Map<string, ProgressRow>();
  const certs: CertRow[] = [];
  const hits = new Map<string, { start: number; n: number }>();
  const audit: unknown[] = [];
  const pk = (u: number, f: string, m: string) => `${u}|${f}|${m}`;
  return {
    async findUserByEmail(email) { return users.find((u) => u.email === email.toLowerCase()) || null; },
    async findUserById(id) { return users.find((u) => u.id === id) || null; },
    async createUser(u) {
      if (users.some((x) => x.email === u.email.toLowerCase())) return null;
      const user: User = { id: users.length + 1, email: u.email.toLowerCase(), name: u.name, passwordHash: u.passwordHash, role: u.role, createdAt: new Date() };
      users.push(user);
      return user;
    },
    async insertAttempt(a) { attempts.push({ ...a, at: new Date() }); },
    async getProgress(u, f, m) { return progress.get(pk(u, f, m)) || null; },
    async upsertProgress(p) { progress.set(pk(p.userId, p.formation, p.module), { ...p }); },
    async listProgress(u, f) { return [...progress.values()].filter((p) => p.userId === u && p.formation === f); },
    async getActiveCert(u, f, m) { return certs.find((c) => c.userId === u && c.formation === f && c.module === m && c.status === 'active') || null; },
    async insertCert(c) {
      if (certs.some((x) => x.code === c.code)) return false;
      if (c.status === 'active' && certs.some((x) => x.userId === c.userId && x.formation === c.formation && x.module === c.module && x.status === 'active')) return false;
      certs.push({ ...c, id: certs.length + 1 });
      return true;
    },
    async findCertByCode(code) { return certs.find((c) => c.code === code) || null; },
    async hit(bucket, win) {
      const now = Date.now(), h = hits.get(bucket);
      if (!h || now - h.start >= win * 1000) { hits.set(bucket, { start: now, n: 1 }); return 1; }
      h.n++;
      return h.n;
    },
    async log(e) { audit.push({ ...e, at: new Date() }); },
    _dump() { return { users, attempts, progress: [...progress.values()], certs, audit }; },
  };
}
