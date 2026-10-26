/**
 * Contenus des formations : lecture, version publique sans corrigés, correction des quiz et des exercices.
 * Fonctions pures (sauf la lecture des fichiers), testées sur les 18 formations.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { randomInt } from 'node:crypto';
import { env } from './env';

export type Quiz = { q: string; options: string[]; answer?: number; explain?: string };
export type Activity = { type?: string; answer?: number; solution?: string; items?: unknown[]; choices?: string[]; [k: string]: unknown };
export type Module = { id: string; number: number; title: string; quiz: Quiz[]; activity?: Activity; [k: string]: unknown };
export type Course = { id: string; title: string; lead?: string; passMark?: number; totalModules?: number; modules: Module[]; [k: string]: unknown };

const ID = /^[a-z0-9_-]{1,40}$/;
const cache = new Map<string, Course>();

export function validId(id: unknown): id is string {
  return typeof id === 'string' && ID.test(id);
}

function dir(): string {
  const d = env.contentDir;
  return isAbsolute(d) ? d : join(process.cwd(), d);
}

export function formationIds(): string[] {
  const d = dir();
  if (!existsSync(d)) return [];
  return readdirSync(d)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .filter(validId)
    .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
}

export function loadCourse(id: string): Course | null {
  if (!validId(id)) return null;
  if (cache.has(id)) return cache.get(id)!;
  const file = join(dir(), id + '.json');
  if (!existsSync(file)) return null;
  const data = JSON.parse(readFileSync(file, 'utf8')) as Course;
  if (!data || !Array.isArray(data.modules) || data.modules.length === 0) return null;
  cache.set(id, data);
  return data;
}

export function findModule(course: Course, moduleId: string): Module | null {
  return course.modules.find((m) => m.id === moduleId) || null;
}

/**
 * Version envoyée au navigateur : aucun corrigé (quiz : answer, explain ; calcul : answer, solution ;
 * classement : case attendue de chaque élément).
 */
export function publicCourse(course: Course): Course {
  const c = JSON.parse(JSON.stringify(course)) as Course;
  for (const m of c.modules) {
    for (const q of m.quiz || []) { delete q.answer; delete q.explain; }
    const a = m.activity;
    if (a && a.type === 'answer') { delete a.answer; delete a.solution; }
    if (a && a.type === 'classify' && Array.isArray(a.items)) {
      a.items = a.items.map((it) => [Array.isArray(it) ? String(it[0]) : String(it)]);
    }
  }
  (c as Record<string, unknown>).serverGraded = true;
  return c;
}

export type Grade = { good: number; total: number; passed: boolean; results: { correct: boolean; answer: number; explain: string }[] };

/** Correction d'un quiz. null si la réponse est mal formée. */
export function grade(course: Course, mod: Module, answers: unknown): Grade | null {
  const quiz = mod.quiz || [];
  if (!Array.isArray(answers) || quiz.length === 0 || answers.length !== quiz.length) return null;
  let good = 0;
  const results = [];
  for (let i = 0; i < quiz.length; i++) {
    const pick = answers[i];
    const q = quiz[i];
    if (typeof pick !== 'number' || !Number.isInteger(pick) || pick < 0 || pick >= q.options.length) return null;
    const ok = pick === q.answer;
    if (ok) good++;
    results.push({ correct: ok, answer: Number(q.answer), explain: q.explain || '' });
  }
  const mark = typeof course.passMark === 'number' ? course.passMark : 0.8;
  return { good, total: quiz.length, passed: good / quiz.length >= mark, results };
}

/** Correction d'un exercice d'entraînement. null si la demande est mal formée. */
export function checkActivity(mod: Module, p: { value?: unknown; item?: unknown; pick?: unknown }):
  { correct: boolean; solution?: string; answer?: number } | null {
  const a = mod.activity;
  if (!a || !a.type) return null;
  if (a.type === 'answer') {
    const v = typeof p.value === 'number' ? p.value : NaN;
    if (!Number.isFinite(v) || typeof a.answer !== 'number') return null;
    return { correct: Math.abs(v - a.answer) < 1, solution: String(a.solution || '') };
  }
  if (a.type === 'classify') {
    const i = typeof p.item === 'number' ? p.item : -1;
    const k = typeof p.pick === 'number' ? p.pick : -1;
    const items = (a.items || []) as unknown[];
    const it = items[i];
    if (!Number.isInteger(i) || !Array.isArray(it) || !Number.isInteger(k) || k < 0 || k >= (a.choices || []).length) return null;
    const right = Number(it[1]);
    return { correct: k === right, answer: right };
  }
  return null;
}

/** Code d'attestation : ACA-F14-M1-XXXXXX (alphabet sans caractères ambigus, tirage cryptographique). */
export function newCertCode(formation: string, module: string): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += abc[randomInt(abc.length)];
  return `ACA-${formation.toUpperCase()}-${module === 'course' ? 'PARCOURS' : module.toUpperCase()}-${out}`;
}
