import Link from 'next/link';
import { PremiumAccessGate } from '../../../components/premium-access-gate';

const notionMap: Record<string, string> = {
  football: process.env.NEXT_PUBLIC_NOTION_FOOTBALL_URL ?? 'https://www.notion.so',
  basketball: process.env.NEXT_PUBLIC_NOTION_BASKETBALL_URL ?? 'https://www.notion.so',
  tennis: process.env.NEXT_PUBLIC_NOTION_TENNIS_URL ?? 'https://www.notion.so',
};

export default async function PremiumSportPage({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  const notionUrl = notionMap[sport] ?? 'https://www.notion.so';

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
          href="/premium"
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[#c5d2d9] transition-colors hover:bg-white/10"
        >
          Premium Hub
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
          Premium {sport.toUpperCase()}
        </span>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#f2fbfa] md:text-5xl">Reserved training area</h1>
        <p className="mt-3 text-[#c5d2d9]">
          Access to this section must be controlled by subscription entitlements (`{sport}_monthly` or `all_sports`).
          In this v1 scaffold, the content source is embedded from Notion.
        </p>
      </section>

      <PremiumAccessGate>
        <section className="mt-4 overflow-hidden rounded-[18px] border border-white/10 bg-[#0e1624] shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
          <iframe
            src={notionUrl}
            title={`Notion premium ${sport}`}
            className="min-h-[70vh] w-full border-0"
            loading="lazy"
          />
        </section>
      </PremiumAccessGate>
    </main>
  );
}
