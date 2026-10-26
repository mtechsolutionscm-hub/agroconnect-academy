/**
 * Accès aux données. Deux implémentations : MySQL (production) et mémoire (tests automatiques).
 */
export type Role = 'learner' | 'trainer' | 'sales' | 'admin';
export type User = { id: number; email: string; name: string; passwordHash: string; role: Role; createdAt: Date };
export type ProgressRow = { userId: number; formation: string; module: string; best: number; total: number; passed: boolean; passedAt: Date | null; updatedAt: Date };
export type CertRow = { id: number; code: string; userId: number; formation: string; module: string; holderName: string; score: string; issuedAt: Date; status: 'active' | 'revoked' };

export interface Repo {
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: number): Promise<User | null>;
  createUser(u: { email: string; name: string; passwordHash: string; role: Role }): Promise<User | null>; // null si l'adresse existe déjà

  insertAttempt(a: { userId: number; formation: string; module: string; good: number; total: number; passed: boolean }): Promise<void>;
  getProgress(userId: number, formation: string, module: string): Promise<ProgressRow | null>;
  upsertProgress(p: ProgressRow): Promise<void>;
  listProgress(userId: number, formation: string): Promise<ProgressRow[]>;

  getActiveCert(userId: number, formation: string, module: string): Promise<CertRow | null>;
  /** Insère une attestation ; false si le code existe déjà ou si une attestation active existe déjà (contrainte d'unicité). */
  insertCert(c: Omit<CertRow, 'id'>): Promise<boolean>;
  findCertByCode(code: string): Promise<CertRow | null>;

  /** Incrémente un compteur de fréquence et renvoie sa valeur dans la fenêtre courante. */
  hit(bucket: string, windowSeconds: number): Promise<number>;
  log(e: { userId: number | null; action: string; objectType: string; objectId: string; details?: unknown }): Promise<void>;
}
