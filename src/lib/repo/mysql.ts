/**
 * Implémentation MySQL du stockage (pilote mysql2, requêtes préparées uniquement).
 * NON EXÉCUTÉE pendant le développement (pas de MySQL disponible) : à valider avec npm run test:mysql.
 */
import mysql from 'mysql2/promise';
import { env } from '../env';
import type { Repo, User, ProgressRow, CertRow, Role } from './types';

let pool: mysql.Pool | null = null;
function db(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password, database: env.db.name,
      connectionLimit: env.db.connectionLimit, charset: 'utf8mb4', timezone: 'Z', dateStrings: false,
      ssl: env.db.ssl ? { rejectUnauthorized: true } : undefined,
    });
  }
  return pool;
}

type Row = Record<string, any>;
async function rows(sql: string, params: unknown[] = []): Promise<Row[]> {
  const [r] = await db().execute(sql, params as any[]);
  return r as Row[];
}
async function run(sql: string, params: unknown[] = []): Promise<mysql.ResultSetHeader> {
  const [r] = await db().execute(sql, params as any[]);
  return r as mysql.ResultSetHeader;
}

const toUser = (r: Row): User => ({ id: Number(r.id), email: r.email, name: r.name, passwordHash: r.password_hash, role: r.role as Role, createdAt: r.created_at });
const toProgress = (r: Row): ProgressRow => ({ userId: Number(r.user_id), formation: r.formation, module: r.module, best: Number(r.best), total: Number(r.total), passed: !!r.passed, passedAt: r.passed_at, updatedAt: r.updated_at });
const toCert = (r: Row): CertRow => ({ id: Number(r.id), code: r.code, userId: Number(r.user_id), formation: r.formation, module: r.module, holderName: r.holder_name, score: r.score, issuedAt: r.issued_at, status: r.status });

export function mysqlRepo(): Repo {
  return {
    async findUserByEmail(email) { const r = await rows('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]); return r[0] ? toUser(r[0]) : null; },
    async findUserById(id) { const r = await rows('SELECT * FROM users WHERE id = ?', [id]); return r[0] ? toUser(r[0]) : null; },
    async createUser(u) {
      try {
        const res = await run('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)', [u.email.toLowerCase(), u.name, u.passwordHash, u.role]);
        return this.findUserById(res.insertId);
      } catch (e: any) {
        if (e && e.code === 'ER_DUP_ENTRY') return null;
        throw e;
      }
    },
    async insertAttempt(a) {
      await run('INSERT INTO aca_attempts (user_id, formation, module, good, total, passed) VALUES (?, ?, ?, ?, ?, ?)', [a.userId, a.formation, a.module, a.good, a.total, a.passed ? 1 : 0]);
    },
    async getProgress(u, f, m) { const r = await rows('SELECT * FROM aca_progress WHERE user_id = ? AND formation = ? AND module = ?', [u, f, m]); return r[0] ? toProgress(r[0]) : null; },
    async upsertProgress(p) {
      await run(
        'INSERT INTO aca_progress (user_id, formation, module, best, total, passed, passed_at) VALUES (?, ?, ?, ?, ?, ?, ?) ' +
        'ON DUPLICATE KEY UPDATE best = VALUES(best), total = VALUES(total), passed = VALUES(passed), passed_at = VALUES(passed_at)',
        [p.userId, p.formation, p.module, p.best, p.total, p.passed ? 1 : 0, p.passedAt]
      );
    },
    async listProgress(u, f) { return (await rows('SELECT * FROM aca_progress WHERE user_id = ? AND formation = ?', [u, f])).map(toProgress); },
    async getActiveCert(u, f, m) { const r = await rows("SELECT * FROM aca_certificates WHERE user_id = ? AND formation = ? AND module = ? AND status = 'active' ORDER BY id LIMIT 1", [u, f, m]); return r[0] ? toCert(r[0]) : null; },
    async insertCert(c) {
      try {
        await run('INSERT INTO aca_certificates (code, user_id, formation, module, holder_name, score, issued_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [c.code, c.userId, c.formation, c.module, c.holderName, c.score, c.issuedAt, c.status]);
        return true;
      } catch (e: any) {
        if (e && e.code === 'ER_DUP_ENTRY') return false;
        throw e;
      }
    },
    async findCertByCode(code) { const r = await rows('SELECT * FROM aca_certificates WHERE code = ?', [code]); return r[0] ? toCert(r[0]) : null; },
    async hit(bucket, win) {
      const start = Math.floor(Date.now() / 1000 / win) * win;
      await run('INSERT INTO aca_rate_limits (bucket, window_start, hits) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE hits = hits + 1', [bucket.slice(0, 190), start]);
      const r = await rows('SELECT hits FROM aca_rate_limits WHERE bucket = ? AND window_start = ?', [bucket.slice(0, 190), start]);
      return r[0] ? Number(r[0].hits) : 1;
    },
    async log(e) {
      await run('INSERT INTO aca_audit_log (user_id, action, object_type, object_id, details) VALUES (?, ?, ?, ?, ?)',
        [e.userId, e.action.slice(0, 40), e.objectType.slice(0, 20), e.objectId.slice(0, 64), e.details === undefined ? null : JSON.stringify(e.details)]);
    },
  };
}
