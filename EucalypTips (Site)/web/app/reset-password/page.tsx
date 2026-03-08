'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../../lib/api';
import { parseApiError } from '../../lib/auth';

export const dynamic = 'force-dynamic';

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const passwordsMatch = useMemo(() => password.length >= 8 && password === confirm, [password, confirm]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token'));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setMessage('Token de reinitialisation manquant.');
      return;
    }
    if (!passwordsMatch) {
      setMessage('Le mot de passe doit faire 8 caracteres minimum et correspondre a la confirmation.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Reinitialisation impossible.'));
      }

      setMessage('Mot de passe mis a jour. Tu peux te connecter.');
      setPassword('');
      setConfirm('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erreur de reinitialisation');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-[#080d15] to-[#0a1120] p-6 text-[#f2fbfa]">
      <section className="w-full max-w-[560px] rounded-[18px] border border-white/10 bg-[#0e1624] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
        <h1 className="m-0 text-3xl font-bold tracking-tight text-[#f2fbfa]">Reinitialiser le mot de passe</h1>
        <form onSubmit={onSubmit}>
          <label className="mb-1 mt-4 block text-sm text-[#c5d2d9]" htmlFor="password">Nouveau mot de passe</label>
          <input id="password" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" />

          <label className="mb-1 mt-3 block text-sm text-[#c5d2d9]" htmlFor="confirm">Confirmer le mot de passe</label>
          <input id="confirm" type="password" minLength={8} required value={confirm} onChange={(event) => setConfirm(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none transition-all placeholder:text-[#9fb1ba] focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" />

          <button type="submit" disabled={loading} className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#7de8d3] px-4 py-2.5 font-bold text-[#0b2622] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? 'Chargement...' : 'Mettre a jour'}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm text-[#c5d2d9]">{message}</p> : null}
        {token === undefined ? <p className="mt-4 text-sm text-[#c5d2d9]">Chargement...</p> : null}

        <Link href="/auth" className="mt-4 inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[#c5d2d9] transition-colors hover:bg-white/10">
          Aller a la connexion
        </Link>
      </section>
    </main>
  );
}
