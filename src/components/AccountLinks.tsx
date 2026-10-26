'use client';
import { useEffect, useState } from 'react';

export default function AccountLinks() {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/academy/v1/session', { cache: 'no-store' }).then((r) => r.json()).then((s) => setName(s.loggedIn ? s.userName : '')).catch(() => setName(''));
  }, []);
  if (name === null) return null;
  if (!name) return <a href="/connexion">Se connecter</a>;
  return (
    <span>
      {name} ·{' '}
      <button type="button" className="aca-link" onClick={() => fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(() => window.location.assign('/'))}>
        Se déconnecter
      </button>
    </span>
  );
}
