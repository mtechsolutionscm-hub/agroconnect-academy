import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'AgroConnect Academy', description: 'Plateforme de formation agricole AgroConnect Academy' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="fr"><body>{children}</body></html>; }
