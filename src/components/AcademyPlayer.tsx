'use client';
/**
 * Lecteur AgroConnect Academy pour Next.js (composant client).
 * Le moteur (src/academy/academy.js) est chargé seulement dans le navigateur, puis monté dans une <div>.
 * Correction des quiz et des exercices, attestations : par l'API de cette application (/api/academy/v1/).
 */
import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    AgroConnectAcademy?: { mount(el: HTMLElement, opts: Record<string, unknown>): { destroy(): void } };
  }
}

export default function AcademyPlayer({ formation, loginUrl = '/connexion' }: { formation: string; loginUrl?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let player: { destroy(): void } | null = null;
    let cancelled = false;
    import('../academy/academy.js').then(() => {
      if (cancelled || !ref.current || !window.AgroConnectAcademy) return;
      const retour = loginUrl + '?retour=' + encodeURIComponent(window.location.pathname);
      player = window.AgroConnectAcademy.mount(ref.current, {
        formation,
        config: { server: true, restUrl: '/api/academy/v1/', sessionUrl: '/api/academy/v1/session', loginUrl: retour, credentials: 'same-origin' },
      });
    });
    return () => { cancelled = true; if (player) player.destroy(); };
  }, [formation, loginUrl]);
  return <div ref={ref}><p>Chargement de la formation…</p></div>;
}
