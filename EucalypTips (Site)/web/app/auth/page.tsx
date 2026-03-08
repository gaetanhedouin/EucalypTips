'use client';

import type { AuthMe } from '@nouveau/types';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from '../../lib/api';
import {
  clearSiteTokens,
  fetchSiteMe,
  logoutSiteSession,
  parseApiError,
  setSiteTokens,
} from '../../lib/auth';

type AuthMode = 'login' | 'register' | 'forgot';

export default function SiteAuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [me, setMe] = useState<AuthMe | null>(null);
  const [nextPath, setNextPath] = useState('/premium');

  useEffect(() => {
    const run = async () => {
      const current = await fetchSiteMe();
      setMe(current);
    };

    void run();

    const params = new URLSearchParams(window.location.search);
    const target = params.get('next');
    if (target?.startsWith('/')) {
      setNextPath(target);
    }
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setPreviewUrl(null);

    try {
      if (mode === 'register') {
        const response = await fetch(`${API_BASE_URL}/v1/auth/register`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            name,
            isAdultConfirmed: true,
            redirectBaseUrl: window.location.origin,
          }),
        });

        if (!response.ok) {
          throw new Error(await parseApiError(response, 'Inscription impossible'));
        }

        const payload = (await response.json()) as { verificationUrlPreview?: string };
        setMode('login');
        setMessage('Compte cree. Verifie ton email puis connecte-toi.');
        setPreviewUrl(payload.verificationUrlPreview ?? null);
        return;
      }

      if (mode === 'forgot') {
        const response = await fetch(`${API_BASE_URL}/v1/auth/forgot-password`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, redirectBaseUrl: window.location.origin }),
        });

        if (!response.ok) {
          throw new Error(await parseApiError(response, 'Reset impossible'));
        }

        const payload = (await response.json()) as { resetUrlPreview?: string };
        setMessage('Si cet email existe, un lien de reinitialisation a ete envoye.');
        setPreviewUrl(payload.resetUrlPreview ?? null);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Connexion impossible'));
      }

      const payload = (await response.json()) as {
        accessToken?: string;
        refreshToken?: string;
        user?: AuthMe;
      };

      if (!payload.accessToken || !payload.refreshToken) {
        throw new Error('Tokens manquants dans la reponse de connexion.');
      }

      setSiteTokens(payload.accessToken, payload.refreshToken);
      const user = payload.user ?? (await fetchSiteMe());
      setMe(user);
      setMessage('Connexion reussie.');
      router.push(nextPath);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  async function onResendVerification() {
    if (!email) {
      setMessage('Renseigne ton email pour renvoyer la verification.');
      return;
    }

    setLoading(true);
    setMessage('');
    setPreviewUrl(null);

    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/resend-verification`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectBaseUrl: window.location.origin }),
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, 'Renvoyer verification impossible'));
      }

      const payload = (await response.json()) as { verificationUrlPreview?: string };
      setMessage('Si le compte existe et n est pas verifie, un nouvel email a ete envoye.');
      setPreviewUrl(payload.verificationUrlPreview ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  async function onLogout() {
    setLoading(true);
    setMessage('');

    try {
      await logoutSiteSession();
      clearSiteTokens();
      setMe(null);
      setMessage('Deconnexion reussie.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl bg-gradient-to-b from-[#080d15] to-[#0a1120] px-4 pb-16 pt-6 text-[#f2fbfa]">
      <nav className="sticky top-0 z-20 mb-6 flex flex-wrap gap-2 rounded-[18px] border border-white/10 bg-[#080d15]/90 p-3 backdrop-blur-md">
        <Link href="/" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[#c5d2d9] transition-colors hover:bg-white/10">
          Home
        </Link>
        <Link href="/premium" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[#c5d2d9] transition-colors hover:bg-white/10">
          Premium
        </Link>
      </nav>

      <section className="rounded-[18px] border border-white/10 bg-[#0e1624] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
        <h1 className="m-0 text-3xl font-bold tracking-tight text-[#f2fbfa]">Compte EucalypTips</h1>
        <p className="mt-2 text-sm text-[#c5d2d9]">Connexion autonome du site avec le meme compte backend que l app.</p>

        {me ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-[#0b1324] p-4">
            <p className="m-0 text-sm text-[#c5d2d9]">Connecte en tant que</p>
            <p className="m-0 mt-1 text-lg font-semibold text-[#f2fbfa]">{me.name} ({me.email})</p>
            <button
              type="button"
              className="mt-3 inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-semibold text-[#c5d2d9] transition-colors hover:bg-white/10"
              onClick={() => void onLogout()}
              disabled={loading}
            >
              Se deconnecter
            </button>
          </div>
        ) : (
          <form className="mt-4" onSubmit={onSubmit}>
            <div className="mb-2 flex flex-wrap gap-2">
              <button type="button" className={`rounded-full border px-3 py-1 text-sm font-semibold ${mode === 'login' ? 'border-white/20 bg-[#0b1324] text-[#f2fbfa]' : 'border-white/10 bg-white/5 text-[#c5d2d9]'}`} onClick={() => setMode('login')}>Connexion</button>
              <button type="button" className={`rounded-full border px-3 py-1 text-sm font-semibold ${mode === 'register' ? 'border-white/20 bg-[#0b1324] text-[#f2fbfa]' : 'border-white/10 bg-white/5 text-[#c5d2d9]'}`} onClick={() => setMode('register')}>Inscription</button>
              <button type="button" className={`rounded-full border px-3 py-1 text-sm font-semibold ${mode === 'forgot' ? 'border-white/20 bg-[#0b1324] text-[#f2fbfa]' : 'border-white/10 bg-white/5 text-[#c5d2d9]'}`} onClick={() => setMode('forgot')}>Mot de passe oublie</button>
            </div>

            <label className="mb-1 mt-2 block text-sm text-[#c5d2d9]" htmlFor="auth-email">Email</label>
            <input id="auth-email" type="email" className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" value={email} onChange={(event) => setEmail(event.target.value)} required />

            {mode === 'register' ? (
              <>
                <label className="mb-1 mt-2 block text-sm text-[#c5d2d9]" htmlFor="auth-name">Nom</label>
                <input id="auth-name" type="text" className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" value={name} onChange={(event) => setName(event.target.value)} required />
              </>
            ) : null}

            {mode !== 'forgot' ? (
              <>
                <label className="mb-1 mt-2 block text-sm text-[#c5d2d9]" htmlFor="auth-password">Mot de passe</label>
                <input id="auth-password" type="password" className="w-full rounded-xl border border-white/10 bg-[#0b1326] px-3 py-2 text-[#f2fbfa] outline-none focus:border-[#7de8d3] focus:ring-2 focus:ring-[#7de8d3]/50" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-xl bg-[#7de8d3] px-4 py-2.5 font-bold text-[#0b2622] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Chargement...' : mode === 'register' ? 'Creer un compte' : mode === 'forgot' ? 'Envoyer le lien' : 'Se connecter'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void onResendVerification()}
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[#c5d2d9] transition-colors hover:bg-white/10"
              >
                Renvoyer verification e-mail
              </button>
            </div>
          </form>
        )}

        {message ? <p className="mt-3 text-sm text-[#c5d2d9]">{message}</p> : null}

        {previewUrl ? (
          <p className="mt-2 text-sm text-[#ffd166]">
            Lien dev/mock: <a className="underline" href={previewUrl}>{previewUrl}</a>
          </p>
        ) : null}
      </section>
    </main>
  );
}
