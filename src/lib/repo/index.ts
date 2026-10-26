import type { Repo } from './types';

let repo: Repo | null = null;

/** Stockage utilisé par l'application : MySQL, ou mémoire si ACADEMY_REPO=memory (tests). */
export async function getRepo(): Promise<Repo> {
  if (repo) return repo;
  if (process.env.ACADEMY_REPO === 'memory') {
    const { memoryRepo } = await import('./memory');
    repo = memoryRepo();
  } else {
    const { mysqlRepo } = await import('./mysql');
    repo = mysqlRepo();
  }
  return repo;
}

export function setRepoForTests(r: Repo): void {
  repo = r;
}
