'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchSiteMe } from '../lib/auth';

export function PremiumAccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const me = await fetchSiteMe();
      if (!mounted) {
        return;
      }
      setAllowed(Boolean(me));
      setChecking(false);
    };

    void run();

    return () => {
      mounted = false;
    };
  }, []);

  if (checking) {
    return (
      <section className="mt-4 rounded-[18px] border border-white/10 bg-[#0e1624] p-6 text-[#c5d2d9] shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
        Verification de session en cours...
      </section>
    );
  }

  if (!allowed) {
    return (
      <section className="mt-4 rounded-[18px] border border-white/10 bg-[#0e1624] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
        <h2 className="m-0 text-2xl font-bold text-[#f2fbfa]">Espace premium verrouille</h2>
        <p className="mt-2 text-[#c5d2d9]">
          Connecte-toi avec ton compte EucalypTips pour acceder au contenu premium.
        </p>
        <Link
          href={`/auth?next=${encodeURIComponent(pathname || '/premium')}`}
          className="mt-3 inline-flex items-center justify-center rounded-xl bg-[#7de8d3] px-4 py-2.5 font-bold text-[#0b2622] transition-opacity hover:opacity-90"
        >
          Se connecter
        </Link>
      </section>
    );
  }

  return <>{children}</>;
}
