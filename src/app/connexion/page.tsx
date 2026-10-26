'use client';
import { useState } from 'react';

export default function Connexion() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMsg('');
    const f = new FormData(e.currentTarget);
    const body = { email: f.get('email'), password: f.get('password'), name: f.get('name') };
    const r = await fetch('/api/auth/' + mode, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r || !r.ok) { setMsg(j.message || 'Connexion impossible. Vérifiez votre réseau.'); return; }
    const retour = new URLSearchParams(window.location.search).get('retour') || '/';
    window.location.assign(retour.startsWith('/') && !retour.startsWith('//') ? retour : '/');
  }

  return (
    <>
      <h1>{mode === 'login' ? 'Se connecter' : 'Créer un compte'}</h1>
      <form className="form" onSubmit={submit}>
        {mode === 'register' && (
          <label>Nom et prénom (inscrit sur vos attestations)<input name="name" required minLength={2} maxLength={100} autoComplete="name" /></label>
        )}
        <label>Adresse électronique<input name="email" type="email" required autoComplete="email" /></label>
        <label>Mot de passe (8 caractères au moins)<input name="password" type="password" required minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
        <button type="submit" disabled={busy}>{busy ? 'Patientez…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</button>
        {msg && <p role="alert">{msg}</p>}
      </form>
      <p>
        <button type="button" className="aca-link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMsg(''); }}>
          {mode === 'login' ? 'Pas encore de compte ? En créer un' : 'Déjà un compte ? Se connecter'}
        </button>
      </p>
    </>
  );
}
