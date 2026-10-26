/**
 * Lecture et contrôle de la configuration (.env). Aucune valeur de configuration n'est écrite dans le code.
 */
function str(name: string, fallback = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}
function int(name: string, fallback: number): number {
  const n = parseInt(str(name, String(fallback)), 10);
  return Number.isFinite(n) ? n : fallback;
}
function bool(name: string, fallback: boolean): boolean {
  const v = str(name, fallback ? 'true' : 'false').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

export const env = {
  get production() { return process.env.NODE_ENV === 'production'; },
  get appUrl() { return str('APP_URL', 'http://localhost:3000').replace(/\/$/, ''); },
  get appName() { return str('APP_NAME', 'AgroConnect Academy'); },
  get sessionSecret() {
    const s = str('SESSION_SECRET');
    if (s.length < 32 || s.startsWith('remplacer')) {
      if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET manquant ou trop court (32 caractères au moins) dans le fichier .env');
      return 'secret-de-developpement-uniquement-ne-pas-utiliser-en-production';
    }
    return s;
  },
  get sessionDays() { return int('SESSION_DAYS', 30); },
  get allowRegistration() { return bool('ALLOW_REGISTRATION', true); },
  db: {
    get host() { return str('DB_HOST', '127.0.0.1'); },
    get port() { return int('DB_PORT', 3306); },
    get user() { return str('DB_USER', 'academy'); },
    get password() { return str('DB_PASSWORD'); },
    get name() { return str('DB_NAME', 'agroconnect_academy'); },
    get connectionLimit() { return int('DB_CONNECTION_LIMIT', 10); },
    get ssl() { return bool('DB_SSL', false); },
  },
  get contentDir() { return str('CONTENT_DIR', 'content'); },
  rate: {
    get attemptsUser() { return int('RATE_ATTEMPTS_USER', 20); },
    get attemptsAnon() { return int('RATE_ATTEMPTS_ANON', 120); },
    get activityUser() { return int('RATE_ACTIVITY_USER', 300); },
    get activityAnon() { return int('RATE_ACTIVITY_ANON', 900); },
    get login() { return int('RATE_LOGIN', 10); },
  },
};
