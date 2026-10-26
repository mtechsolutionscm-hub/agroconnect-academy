/**
 * Crée le premier compte administrateur à partir de ADMIN_EMAIL, ADMIN_PASSWORD et ADMIN_NAME (.env).
 * npm run admin:create
 */
import { mysqlRepo } from '../src/lib/repo/mysql';
import { hashPassword, validEmail } from '../src/lib/auth';

async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = (process.env.ADMIN_NAME || 'Administrateur').trim();
  if (!validEmail(email) || password.length < 12) throw new Error('ADMIN_EMAIL valide et ADMIN_PASSWORD de 12 caractères au moins sont requis dans .env');
  const repo = mysqlRepo();
  const u = await repo.createUser({ email, name, passwordHash: hashPassword(password), role: 'admin' });
  console.log(u ? `Administrateur créé : ${u.email} (id ${u.id}). Retirez ADMIN_PASSWORD du fichier .env.` : 'Un compte existe déjà avec cette adresse.');
  process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
