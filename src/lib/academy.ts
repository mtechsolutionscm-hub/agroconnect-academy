/**
 * Règles de l'Academy, indépendantes du framework : chaque fonction renvoie { status, body }.
 * Les routes Next.js (src/app/api/…) ne font qu'appeler ces fonctions.
 */
import { env } from './env';
import { loadCourse, findModule, publicCourse, grade, checkActivity, newCertCode, validId } from './content';
import { hashPassword, verifyPassword, validEmail } from './auth';
import type { Repo, User, CertRow } from './repo/types';

export type Result = { status: number; body: unknown };
const ok = (body: unknown): Result => ({ status: 200, body });
const fail = (status: number, code: string, message: string, data: Record<string, unknown> = {}): Result =>
  ({ status, body: { code, message, data: { status, ...data } } });

/** Accès à une formation. Toutes sont ouvertes dans ce lot ; le lot N2 (paiement) ajoutera les formations payantes. */
export async function canAccess(_repo: Repo, _user: User | null, _formation: string): Promise<boolean> {
  return true;
}

async function limited(repo: Repo, bucket: string, max: number): Promise<boolean> {
  return (await repo.hit(bucket, 3600)) > max;
}

export function certPublic(c: CertRow | null) {
  return c ? { code: c.code, name: c.holderName, date: new Date(c.issuedAt).toISOString(), status: c.status, score: c.score } : null;
}

export async function issueCert(repo: Repo, user: User, formation: string, module: string, score: string): Promise<CertRow | null> {
  const existing = await repo.getActiveCert(user.id, formation, module);
  if (existing) return existing;
  for (let i = 0; i < 5; i++) {
    const code = newCertCode(formation, module);
    const inserted = await repo.insertCert({ code, userId: user.id, formation, module, holderName: user.name.slice(0, 100), score: score.slice(0, 20), issuedAt: new Date(), status: 'active' });
    if (inserted) {
      await repo.log({ userId: user.id, action: 'certificate_issued', objectType: 'certificate', objectId: code, details: { formation, module, score } });
      return repo.getActiveCert(user.id, formation, module);
    }
    // Refus : code déjà pris (on retire) ou attestation active créée entre-temps par une requête simultanée.
    const now = await repo.getActiveCert(user.id, formation, module);
    if (now) return now;
  }
  return null;
}

export function session(user: User | null): Result {
  return ok({ loggedIn: !!user, userName: user ? user.name : '' });
}

export async function getCourse(repo: Repo, user: User | null, id: string): Promise<Result> {
  const course = validId(id) ? loadCourse(id) : null;
  if (!course) return fail(404, 'aca_unknown', 'Formation inconnue.');
  if (!(await canAccess(repo, user, id))) return fail(403, 'aca_locked', 'Formation réservée aux inscrits.');
  return ok(publicCourse(course));
}

export async function attempt(repo: Repo, user: User | null, who: string, body: any): Promise<Result> {
  const formation = String(body?.formation || ''), moduleId = String(body?.module || '');
  const course = validId(formation) ? loadCourse(formation) : null;
  if (!course) return fail(404, 'aca_unknown', 'Formation inconnue.');
  if (!(await canAccess(repo, user, formation))) return fail(403, 'aca_locked', 'Formation réservée aux inscrits.');
  const mod = findModule(course, moduleId);
  if (!mod) return fail(404, 'aca_unknown_module', 'Module inconnu.');
  if (await limited(repo, `attempt|${formation}|${moduleId}|${who}`, user ? env.rate.attemptsUser : env.rate.attemptsAnon)) {
    return fail(429, 'aca_too_many', 'Trop de tentatives pour ce module. Réessayez dans une heure.');
  }
  const g = grade(course, mod, body?.answers);
  if (!g) return fail(400, 'aca_bad_answers', 'Réponses incomplètes ou mal formées.');
  const out: Record<string, unknown> = { good: g.good, total: g.total, passed: g.passed, results: g.results, recorded: false, cert: null };
  if (!user) return ok(out);

  await repo.insertAttempt({ userId: user.id, formation, module: moduleId, good: g.good, total: g.total, passed: g.passed });
  const prev = await repo.getProgress(user.id, formation, moduleId);
  const wasPassed = !!(prev && prev.passed);
  const now = new Date();
  await repo.upsertProgress({
    userId: user.id, formation, module: moduleId,
    best: Math.max(g.good, prev ? prev.best : 0), total: g.total,
    passed: wasPassed || g.passed,
    passedAt: wasPassed ? prev!.passedAt : (g.passed ? now : null),
    updatedAt: now,
  });
  out.recorded = true;
  if (g.passed || wasPassed) out.cert = certPublic(await issueCert(repo, user, formation, moduleId, `${g.good}/${g.total}`));
  return ok(out);
}

export async function activity(repo: Repo, user: User | null, who: string, body: any): Promise<Result> {
  const formation = String(body?.formation || ''), moduleId = String(body?.module || '');
  const course = validId(formation) ? loadCourse(formation) : null;
  if (!course) return fail(404, 'aca_unknown', 'Formation inconnue.');
  if (!(await canAccess(repo, user, formation))) return fail(403, 'aca_locked', 'Formation réservée aux inscrits.');
  const mod = findModule(course, moduleId);
  if (!mod) return fail(404, 'aca_unknown_module', 'Module inconnu.');
  if (await limited(repo, `activity|${who}`, user ? env.rate.activityUser : env.rate.activityAnon)) {
    return fail(429, 'aca_too_many', 'Trop de vérifications. Réessayez dans une heure.');
  }
  const r = checkActivity(mod, { value: body?.value, item: body?.item, pick: body?.pick });
  return r ? ok(r) : fail(400, 'aca_bad_activity', 'Réponse mal formée.');
}

export async function progress(repo: Repo, user: User | null, formation: string): Promise<Result> {
  if (!user) return fail(401, 'aca_login_required', 'Connexion requise.');
  if (!validId(formation) || !loadCourse(formation)) return fail(404, 'aca_unknown', 'Formation inconnue.');
  const out: Record<string, unknown> = {};
  for (const p of await repo.listProgress(user.id, formation)) {
    out[p.module] = { best: p.best, pass: p.passed, at: p.passedAt ? new Date(p.passedAt).toISOString() : '', cert: p.passed ? certPublic(await repo.getActiveCert(user.id, formation, p.module)) : null };
  }
  const cc = await repo.getActiveCert(user.id, formation, 'course');
  if (cc) out.course = { pass: true, best: 0, cert: certPublic(cc) };
  return ok({ progress: out, verified: true });
}

export async function courseCertificate(repo: Repo, user: User | null, body: any): Promise<Result> {
  if (!user) return fail(401, 'aca_login_required', 'Connexion requise.');
  const formation = String(body?.formation || '');
  const course = validId(formation) ? loadCourse(formation) : null;
  if (!course) return fail(404, 'aca_unknown', 'Formation inconnue.');
  if (course.totalModules && course.totalModules > course.modules.length) return fail(409, 'aca_incomplete_course', 'Tous les modules de cette formation ne sont pas encore publiés.');
  const rows = await repo.listProgress(user.id, formation);
  const passed = new Set(rows.filter((r) => r.passed).map((r) => r.module));
  const missing = course.modules.map((m) => m.id).filter((id) => !passed.has(id));
  if (missing.length) return fail(409, 'aca_not_completed', 'Des modules ne sont pas encore validés.', { missing });
  const good = rows.reduce((s, r) => s + r.best, 0);
  const total = course.modules.reduce((s, m) => s + m.quiz.length, 0);
  return ok({ cert: certPublic(await issueCert(repo, user, formation, 'course', `${good}/${total}`)) });
}

export async function verify(repo: Repo, code: string) {
  const c = /^[A-Z0-9-]{6,40}$/.test(code) ? await repo.findCertByCode(code) : null;
  if (!c) return null;
  const course = loadCourse(c.formation);
  const mod = course && c.module !== 'course' ? findModule(course, c.module) : null;
  return {
    status: c.status, name: c.holderName, issuedAt: new Date(c.issuedAt).toISOString(),
    formation: course ? course.title : c.formation,
    module: c.module === 'course' ? 'Parcours complet' : mod ? `Module ${mod.number} : ${mod.title}` : c.module,
  };
}

/* ---------- comptes ---------- */

export async function register(repo: Repo, who: string, body: any): Promise<Result & { user?: User }> {
  if (!env.allowRegistration) return fail(403, 'aca_registration_closed', 'La création de compte est fermée.');
  if (await limited(repo, `register|${who}`, env.rate.login)) return fail(429, 'aca_too_many', 'Trop de tentatives. Réessayez dans une heure.');
  const email = String(body?.email || '').trim().toLowerCase();
  const name = String(body?.name || '').trim().replace(/\s+/g, ' ').slice(0, 100);
  const password = String(body?.password || '');
  if (!validEmail(email)) return fail(400, 'aca_bad_email', 'Adresse électronique invalide.');
  if (name.length < 2) return fail(400, 'aca_bad_name', 'Indiquez votre nom et prénom.');
  if (password.length < 8 || password.length > 200) return fail(400, 'aca_bad_password', 'Le mot de passe doit contenir au moins 8 caractères.');
  const user = await repo.createUser({ email, name, passwordHash: hashPassword(password), role: 'learner' });
  if (!user) return fail(409, 'aca_email_taken', 'Un compte existe déjà avec cette adresse.');
  await repo.log({ userId: user.id, action: 'user_registered', objectType: 'user', objectId: String(user.id) });
  return { ...ok({ user: { name: user.name } }), user };
}

export async function login(repo: Repo, who: string, body: any): Promise<Result & { user?: User }> {
  const email = String(body?.email || '').trim().toLowerCase();
  if (await limited(repo, `login|${who}`, env.rate.login) || await limited(repo, `login|${email}`, env.rate.login)) {
    return fail(429, 'aca_too_many', 'Trop de tentatives de connexion. Réessayez dans une heure.');
  }
  const user = validEmail(email) ? await repo.findUserByEmail(email) : null;
  // Même message dans tous les cas : on ne révèle pas si l'adresse existe.
  if (!user || !verifyPassword(String(body?.password || ''), user.passwordHash)) return fail(401, 'aca_bad_login', 'Adresse ou mot de passe incorrect.');
  await repo.log({ userId: user.id, action: 'user_login', objectType: 'user', objectId: String(user.id) });
  return { ...ok({ user: { name: user.name } }), user };
}
