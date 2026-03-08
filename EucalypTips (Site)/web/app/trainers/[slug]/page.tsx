import Link from 'next/link';
import { fetchTrainerPerformance } from '../../../lib/api';

export const dynamic = 'force-dynamic';

export default async function TrainerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rows = await fetchTrainerPerformance(slug, 'MONTH');

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl bg-gradient-to-b from-[#080d15] to-[#0a1120] px-4 pb-16 pt-6 text-[#f2fbfa]">
      <div className="sticky top-0 z-20 mb-6 flex flex-wrap gap-2 rounded-[18px] border border-white/10 bg-[#080d15]/90 p-3 backdrop-blur-md">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[#c5d2d9] transition-colors hover:bg-white/10"
        >
          Back home
        </Link>
      </div>
      <section className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
        <h1 className="m-0 text-3xl font-bold tracking-tight text-[#f2fbfa]">Source: {slug}</h1>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm text-[#f2fbfa]">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-[0.08em] text-[#c5d2d9]">
                <th className="px-3 py-2">Sport</th>
                <th className="px-3 py-2">Total Bets</th>
                <th className="px-3 py-2">Win Rate</th>
                <th className="px-3 py-2">ROI</th>
                <th className="px-3 py-2">Profit (u)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.sourceSlug}-${row.sport}`} className="border-b border-white/10">
                  <td className="px-3 py-2">{row.sport}</td>
                  <td className="px-3 py-2">{row.totalBets}</td>
                  <td className="px-3 py-2">{(row.winRate * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2">{(row.roi * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2">{row.profitUnits.toFixed(2)}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-[#c5d2d9]" colSpan={5}>
                    No public stats found for this source.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
