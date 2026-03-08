import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nouveau Site - Sports Betting Transparency',
  description: 'Public bankroll performance with live stats and premium education content.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="font-sans">
      <body>{children}</body>
    </html>
  );
}
