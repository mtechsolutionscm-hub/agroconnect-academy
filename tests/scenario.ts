/**
 * Scénario de règles exécuté sur un stockage donné : mémoire (npm test) ou MySQL réel (npm run test:mysql).
 */
import assert from 'node:assert/strict';
import { register, login, attempt, progress, courseCertificate, verify, getCourse, activity, session } from '../src/lib/academy';
import { loadCourse } from '../src/lib/content';
import type { Repo } from '../src/lib/repo/types';

export async function runScenario(repo: Repo, log: (s: string) => void = () => {}) {
  const tag = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const email = `apprenant-${tag}@example.org`;
  const who = 'test-' + tag;

  const r1 = await register(repo, who, { email, name: 'Aminatou Bello', password: 'motdepasse-solide' });
  assert.equal(r1.status, 200); assert.ok(r1.user); log('Inscription acceptée');
  assert.equal((await register(repo, who + 'b', { email, name: 'Autre', password: 'motdepasse-solide' })).status, 409); log('Adresse déjà utilisée refusée');
  assert.equal((await register(repo, who + 'c', { email: 'x', name: 'A B', password: 'motdepasse' })).status, 400); log('Adresse invalide refusée');
  assert.equal((await login(repo, who, { email, password: 'mauvais-mot-de-passe' })).status, 401); log('Mauvais mot de passe refusé');
  const l = await login(repo, who, { email, password: 'motdepasse-solide' });
  assert.equal(l.status, 200); const user = l.user!; log('Connexion acceptée');
  assert.deepEqual(session(user).body, { loggedIn: true, userName: 'Aminatou Bello' });

  const c = await getCourse(repo, null, 'f14');
  assert.equal(c.status, 200);
  const pub = c.body as any;
  assert.ok(pub.modules.every((m: any) => m.quiz.every((q: any) => !('answer' in q) && !('explain' in q)))); log('Contenu envoyé sans corrigés');
  assert.equal((await getCourse(repo, null, '../etc')).status, 404); log('Identifiant de formation invalide refusé');

  const full = loadCourse('f14')!; const m1 = full.modules[0];
  const right = m1.quiz.map((q) => q.answer as number);
  const wrong = m1.quiz.map((q) => ((q.answer as number) + 1) % q.options.length);

  const anon = (await attempt(repo, null, who + 'anon', { formation: 'f14', module: m1.id, answers: right })).body as any;
  assert.equal(anon.passed, true); assert.equal(anon.cert, null); assert.equal(anon.recorded, false); log('Visiteur : corrigé, sans attestation');

  const bad = (await attempt(repo, user, who, { formation: 'f14', module: m1.id, answers: wrong })).body as any;
  assert.equal(bad.passed, false); assert.equal(bad.cert, null); log('Quiz échoué : pas d’attestation');
  assert.equal((await attempt(repo, user, who, { formation: 'f14', module: m1.id, answers: [0, 1] })).status, 400); log('Réponses incomplètes refusées');
  assert.equal((await attempt(repo, user, who, { formation: 'f14', module: m1.id, answers: right.map(() => 99) })).status, 400); log('Réponses hors limites refusées');

  const ok1 = (await attempt(repo, user, who, { formation: 'f14', module: m1.id, answers: right })).body as any;
  assert.equal(ok1.passed, true); assert.match(ok1.cert.code, /^ACA-F14-M1-[A-Z2-9]{6}$/); assert.equal(ok1.cert.name, 'Aminatou Bello'); log(`Quiz réussi : attestation ${ok1.cert.code}`);
  const ok2 = (await attempt(repo, user, who, { formation: 'f14', module: m1.id, answers: right })).body as any;
  assert.equal(ok2.cert.code, ok1.cert.code); log('Deuxième réussite : même code, pas de doublon');
  const fail2 = (await attempt(repo, user, who, { formation: 'f14', module: m1.id, answers: wrong })).body as any;
  assert.equal(fail2.cert.code, ok1.cert.code); log('Échec après réussite : le module reste validé');

  const p = (await progress(repo, user, 'f14')).body as any;
  assert.equal(p.progress.m1.pass, true); assert.equal(p.progress.m1.cert.code, ok1.cert.code); log('Progression relue depuis le stockage');
  assert.equal((await progress(repo, null, 'f14')).status, 401);

  assert.equal((await courseCertificate(repo, user, { formation: 'f14' })).status, 409); log('Certificat de parcours refusé tant que tout n’est pas validé');
  const f18 = loadCourse('f18')!;
  for (const m of f18.modules) await attempt(repo, user, who, { formation: 'f18', module: m.id, answers: m.quiz.map((q) => q.answer) });
  const cc = (await courseCertificate(repo, user, { formation: 'f18' })).body as any;
  assert.match(cc.cert.code, /^ACA-F18-PARCOURS-[A-Z2-9]{6}$/); log(`Certificat de parcours F18 : ${cc.cert.code}`);

  const v = await verify(repo, ok1.cert.code);
  assert.equal(v?.status, 'active'); assert.equal(v?.name, 'Aminatou Bello'); log('Vérification publique du code');
  assert.equal(await verify(repo, 'ACA-F14-M1-ZZZZZZ'), null);

  const ex = full.modules.find((m) => m.activity?.type === 'answer')!;
  const a1 = (await activity(repo, user, who, { formation: 'f14', module: ex.id, value: ex.activity!.answer })).body as any;
  const a2 = (await activity(repo, user, who, { formation: 'f14', module: ex.id, value: (ex.activity!.answer as number) + 5 })).body as any;
  assert.equal(a1.correct, true); assert.equal(a2.correct, false); log('Exercice corrigé par le serveur');
  return { user, code: ok1.cert.code };
}
