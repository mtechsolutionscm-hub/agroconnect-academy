import type { Metadata, Viewport } from 'next';
import '../academy/academy.css';
import './globals.css';
import AccountLinks from '../components/AccountLinks';

export const metadata: Metadata = {
  title: process.env.APP_NAME || 'AgroConnect Academy',
  description: 'Formations pratiques pour les producteurs, coopératives et entrepreneurs agricoles.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <header className="site-header">
          <a href="/" className="site-brand">AgroConnect Academy</a>
          <nav>
            <a href="/">Formations</a>
            <a href="/verification">Vérifier une attestation</a>
            <AccountLinks />
          </nav>
        </header>
        <main className="site-main">{children}</main>
      </body>
    </html>
  );
}
