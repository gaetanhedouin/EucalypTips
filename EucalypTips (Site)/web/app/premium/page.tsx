import Link from 'next/link';
import { PremiumAccessGate } from '../../components/premium-access-gate';

export default function PremiumHubPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl bg-gradient-to-b from-[#080d15] to-[#0a1120] px-4 pb-16 pt-6 text-[#f2fbfa]">
      <div className="sticky top-0 z-20 mb-6 flex flex-wrap gap-2 rounded-[18px] border border-white/10 bg-[#080d15]/90 p-3 backdrop-blur-md">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[#c5d2d9] transition-colors hover:bg-white/10"
        >
          Home
        </Link>
        <Link
          href="/auth"
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[#c5d2d9] transition-colors hover:bg-white/10"
        >
          Mon compte
        </Link>
      </div>
      <section className="rounded-[18px] border border-white/10 bg-[#0e1624] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
        <span className="inline-flex items-center rounded-full border border-white/20 bg-[#0b1324] px-3 py-1 text-xs font-semibold text-[#f2fbfa]">
          Premium Plans
        </span>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#f2fbfa] md:text-5xl">Choose your sport access</h1>
        <p className="mt-3 text-[#c5d2d9]">Plan mapping: one-sport plan unlocks only that sport. Global plan unlocks all premium sports.</p>
      </section>

      <PremiumAccessGate>
        <section className="mt-4 grid gap-4 md:grid-cols-3">
          <Link
            className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)] transition-colors hover:border-white/20"
            href="/premium/football"
          >
            <h2 className="text-xl font-bold text-[#f2fbfa]">Football Monthly</h2>
            <p className="mt-2 text-sm text-[#c5d2d9]">Premium football content only.</p>
          </Link>
          <Link
            className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)] transition-colors hover:border-white/20"
            href="/premium/basketball"
          >
            <h2 className="text-xl font-bold text-[#f2fbfa]">Basketball Monthly</h2>
            <p className="mt-2 text-sm text-[#c5d2d9]">Premium basketball content only.</p>
          </Link>
          <Link
            className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)] transition-colors hover:border-white/20"
            href="/premium/tennis"
          >
            <h2 className="text-xl font-bold text-[#f2fbfa]">Tennis Monthly</h2>
            <p className="mt-2 text-sm text-[#c5d2d9]">Premium tennis content only.</p>
          </Link>
        </section>
      </PremiumAccessGate>
    </main>
  );
}
