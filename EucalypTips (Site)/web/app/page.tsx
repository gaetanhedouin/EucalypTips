import Link from 'next/link';
import { StatCard } from '@nouveau/ui';
import { LiveLeaderboard } from '../components/live-leaderboard';
import { API_BASE_URL, fetchLeaderboard } from '../lib/api';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const rows = await fetchLeaderboard('WEEK');

  const avgRoi = rows.length ? rows.reduce((sum, row) => sum + row.roi, 0) / rows.length : 0;
  const totalBets = rows.reduce((sum, row) => sum + row.totalBets, 0);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl bg-gradient-to-b from-[#080d15] to-[#0a1120] px-4 pb-16 pt-6 text-[#f2fbfa]">
      <nav className="sticky top-0 z-20 mb-6 flex flex-wrap gap-2 rounded-[18px] border border-white/10 bg-[#080d15]/90 p-3 backdrop-blur-md">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl bg-[#7de8d3] px-4 py-2.5 font-bold text-[#0b2622] transition-opacity hover:opacity-90"
        >
          Home
        </Link>
        <Link
          href="/premium"
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[#c5d2d9] transition-colors hover:bg-white/10"
        >
          Premium
        </Link>
        <Link
          href="/auth"
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[#c5d2d9] transition-colors hover:bg-white/10"
        >
          Mon compte
        </Link>
      </nav>

      <section className="rounded-[18px] border border-white/10 bg-[#0e1624] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
        <span className="inline-flex items-center rounded-full border border-white/20 bg-[#0b1324] px-3 py-1 text-xs font-semibold text-[#f2fbfa]">
          Education + Transparency
        </span>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#f2fbfa] md:text-5xl">
          Follow verified public performance in real time.
        </h1>
        <p className="mt-3 max-w-3xl text-[#c5d2d9]">
          This homepage displays secure public performance only. Premium pages use a local site session but share the
          same backend account as the app.
        </p>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Rows" value={String(rows.length)} helper="Public source x sport combinations" />
        <StatCard label="Total Bets" value={String(totalBets)} helper="Resolved bets in selected window" />
        <StatCard label="Avg ROI" value={`${(avgRoi * 100).toFixed(2)}%`} helper="Weekly average" />
      </section>

      <section className="mt-5">
        <LiveLeaderboard initialRows={rows} apiBaseUrl={API_BASE_URL} />
      </section>

      <section className="mt-5 rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
        <h3 className="m-0 text-xl font-bold text-[#f2fbfa]">Responsible Betting & 18+</h3>
        <p className="mt-2 text-sm text-[#c5d2d9]">
          Educational content only. Sports betting includes risk of loss. Access is restricted to users declaring 18+.
        </p>
      </section>
    </main>
  );
}
