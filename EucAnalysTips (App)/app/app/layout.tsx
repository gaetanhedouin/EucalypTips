import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EucAnalypTips',
  description: 'Application de pilotage et analyse de paris sportifs.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="font-sans">
      <body>{children}</body>
    </html>
  );
}
