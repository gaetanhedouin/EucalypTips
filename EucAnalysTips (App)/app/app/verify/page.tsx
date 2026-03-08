'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';
export const dynamic = 'force-dynamic';

export default function VerifyEmailPage() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Verification en cours...');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token'));
  }, []);

  useEffect(() => {
    if (token === undefined) {
      return;
    }

    const run = async () => {
      if (!token) {
        setMessage('Token de verification manquant.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/v1/auth/verify-email`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message ?? 'Impossible de verifier cet email.');
        }

        setMessage('Email verifie. Tu peux maintenant te connecter.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Erreur de verification');
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [token]);

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-[#080d15] to-[#0a1120] p-6 text-[#f2fbfa]">
      <section className="w-full max-w-[560px] rounded-[18px] border border-white/10 bg-[#0e1624] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
        <h1 className="m-0 text-3xl font-bold tracking-tight text-[#f2fbfa]">Verification Email</h1>
        <p className="mt-2 mb-5 text-sm text-[#c5d2d9]">{message}</p>
        {!loading ? (
          <Link
            className="inline-flex items-center justify-center rounded-xl bg-[#7de8d3] px-4 py-2.5 font-bold text-[#0b2622] transition-opacity hover:opacity-90"
            href="/"
          >
            Retour a la connexion
          </Link>
        ) : null}
      </section>
    </main>
  );
}
