import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formationIds, loadCourse, publicCourse, grade, checkActivity, newCertCode } from '../src/lib/content';

test('18 formations, 150 modules, 900 questions', () => {
  const ids = formationIds();
  assert.equal(ids.length, 18);
  let m = 0, q = 0;
  for (const id of ids) { const c = loadCourse(id)!; m += c.modules.length; q += c.modules.reduce((s, x) => s + x.quiz.length, 0); }
  assert.equal(m, 150); assert.equal(q, 900);
});

test('aucun corrigé dans le contenu public (quiz et exercices)', () => {
  for (const id of formationIds()) {
    const p = publicCourse(loadCourse(id)!);
    for (const mod of p.modules) {
      for (const qq of mod.quiz) { assert.ok(!('answer' in qq) && !('explain' in qq), `${id}/${mod.id}`); }
      const a = mod.activity as any;
      if (a?.type === 'answer') assert.ok(!('answer' in a) && !('solution' in a), `${id}/${mod.id}`);
      if (a?.type === 'classify') assert.ok(a.items.every((it: unknown[]) => it.length === 1), `${id}/${mod.id}`);
    }
  }
});

test('correction juste et fausse des 150 quiz, refus des réponses mal formées', () => {
  for (const id of formationIds()) {
    const c = loadCourse(id)!;
    for (const mod of c.modules) {
      const right = mod.quiz.map((x) => x.answer as number);
      const wrong = mod.quiz.map((x) => ((x.answer as number) + 1) % x.options.length);
      assert.equal(grade(c, mod, right)!.passed, true);
      assert.equal(grade(c, mod, wrong)!.passed, false);
      assert.equal(grade(c, mod, right.slice(1)), null);
      assert.equal(grade(c, mod, right.map(() => -1)), null);
      assert.equal(grade(c, mod, 'abc'), null);
    }
  }
});

test('correction des 135 exercices', () => {
  let n = 0;
  for (const id of formationIds()) {
    for (const mod of loadCourse(id)!.modules) {
      const a = mod.activity as any;
      if (a?.type === 'answer') { n++; assert.equal(checkActivity(mod, { value: a.answer })!.correct, true); assert.equal(checkActivity(mod, { value: a.answer + 5 })!.correct, false); }
      if (a?.type === 'classify') {
        n++;
        a.items.forEach((it: [string, number], i: number) => {
          assert.equal(checkActivity(mod, { item: i, pick: it[1] })!.correct, true);
          assert.equal(checkActivity(mod, { item: i, pick: (it[1] + 1) % a.choices.length })!.correct, false);
        });
        assert.equal(checkActivity(mod, { item: 999, pick: 0 }), null);
      }
    }
  }
  assert.equal(n, 135);
});

test('codes d’attestation : format et tirage', () => {
  const codes = new Set<string>();
  for (let i = 0; i < 2000; i++) { const c = newCertCode('f14', 'm1'); assert.match(c, /^ACA-F14-M1-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/); codes.add(c); }
  assert.ok(codes.size > 1990);
  assert.match(newCertCode('f18', 'course'), /^ACA-F18-PARCOURS-/);
});
