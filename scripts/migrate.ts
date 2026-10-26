/**
 * Crée les tables dans la base MySQL indiquée dans .env (npm run db:migrate). Peut être relancé sans risque.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import mysql from 'mysql2/promise';
import { env } from '../src/lib/env';

async function main() {
  const conn = await mysql.createConnection({
    host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password, database: env.db.name,
    multipleStatements: true, charset: 'utf8mb4', ssl: env.db.ssl ? { rejectUnauthorized: true } : undefined,
  });
  const sql = readFileSync(join(process.cwd(), 'db', 'schema.sql'), 'utf8');
  await conn.query(sql);
  const [rows] = await conn.query("SHOW TABLES");
  console.log('Tables présentes :', (rows as Record<string, string>[]).map((r) => Object.values(r)[0]).join(', '));
  await conn.end();
}
main().catch((e) => { console.error('Échec de la migration :', e.message); process.exit(1); });
