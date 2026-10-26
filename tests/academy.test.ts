import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryRepo } from '../src/lib/repo/memory';
import { runScenario } from './scenario';
import { attempt, issueCert } from '../src/lib/academy';
import { loadCourse } from '../src/lib/content';
import { postGuard } from '../src/lib/http';

test('règles de l’Academy (stockage en mémoire)', async () => {
  const repo = memoryRepo();
  const { user } = await runScenario(repo, (s) => console.log('  ✓ ' + s));
  const dump = repo._dump() as any;
  assert.equal(dump.certs.filter((c: any) => c.userId === user.id && c.formation === 'f14' && c.module === 'm1').length, 1);
  assert.ok(dump.audit.some((a: any) => a.action === 'certificate_issued'));
});

test('attestations simultanées : une seule délivrée', async () => {
  const repo = memoryRepo();
  const u = (await repo.createUser({ email: 'x@example.org', name: 'X Y', passwordHash: 'h', role: 'learner' }))!;
  const all = await Promise.all(Array.from({ length: 10 }, () => issueCert(repo, u, 'f14', 'm2', '6/6')));
  assert.equal(new Set(all.map((c) => c!.code)).size, 1);
});

test('limite de fréquence des tentatives', async () => {
  process.env.RATE_ATTEMPTS_USER = '3';
  const repo = memoryRepo();
  const u = (await repo.createUser({ email: 'r@example.org', name: 'R S', passwordHash: 'h', role: 'learner' }))!;
  const m = loadCourse('f14')!.modules[0];
  const body = { formation: 'f14', module: m.id, answers: m.quiz.map(() => 0) };
  const st = [];
  for (let i = 0; i < 5; i++) st.push((await attempt(repo, u, 'u' + u.id, body)).status);
  assert.deepEqual(st, [200, 200, 200, 429, 429]);
  delete process.env.RATE_ATTEMPTS_USER;
});

test('protection des requêtes POST', () => {
  process.env.APP_URL = 'https://academy.example.org';
  assert.equal(postGuard(new Request('https://academy.example.org/api', { method: 'POST', headers: { 'content-type': 'text/plain' } }))!.status, 415);
  assert.equal(postGuard(new Request('https://academy.example.org/api', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://pirate.example' } }))!.status, 403);
  assert.equal(postGuard(new Request('https://academy.example.org/api', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://academy.example.org' } })), null);
});
