'use client';

import type { LeaderboardRow } from '@nouveau/types';
import { useEffect, useMemo, useState } from 'react';

interface LiveLeaderboardProps {
  initialRows: LeaderboardRow[];
  apiBaseUrl: string;
}

export function LiveLeaderboard({ initialRows, apiBaseUrl }: LiveLeaderboardProps) {
  const [rows, setRows] = useState<LeaderboardRow[]>(initialRows);
  const [lastTick, setLastTick] = useState<string | null>(null);

  useEffect(() => {
    setLastTick(new Date().toISOString());

    const source = new EventSource(`${apiBaseUrl}/v1/public/stream/leaderboard`);
    source.addEventListener('leaderboard.updated', async () => {
      const response = await fetch(`${apiBaseUrl}/v1/public/leaderboard?window=WEEK`);
      if (response.ok) {
        const payload = (await response.json()) as LeaderboardRow[];
        setRows(payload);
        setLastTick(new Date().toISOString());
      }
    });

    return () => {
      source.close();
    };
  }, [apiBaseUrl]);

  const topRows = useMemo(() => rows.slice(0, 12), [rows]);
  const tickLabel = lastTick ? new Date(lastTick).toLocaleTimeString('fr-FR') : '--:--:--';

  return (
    <div className="rounded-[18px] border border-white/10 bg-[#0e1624] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.4)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="m-0 text-xl font-bold text-[#f2fbfa]">Live Leaderboard</h2>
        <span className="text-sm text-[#c5d2d9]">Live tick: {tickLabel}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm text-[#f2fbfa]">
          <thead>
            <tr className="border-b border-white/10 text-xs uppercase tracking-[0.08em] text-[#c5d2d9]">
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Sport</th>
              <th className="px-3 py-2">Total Bets</th>
              <th className="px-3 py-2">Win Rate</th>
              <th className="px-3 py-2">ROI</th>
              <th className="px-3 py-2">Profit (u)</th>
            </tr>
          </thead>
          <tbody>
            {topRows.map((row) => (
              <tr key={`${row.sourceSlug}-${row.sport}`} className="border-b border-white/10">
                <td className="px-3 py-2">{row.sourceName}</td>
                <td className="px-3 py-2">{row.sport}</td>
                <td className="px-3 py-2">{row.totalBets}</td>
                <td className="px-3 py-2">{(row.winRate * 100).toFixed(1)}%</td>
                <td className="px-3 py-2">{(row.roi * 100).toFixed(1)}%</td>
                <td className="px-3 py-2">{row.profitUnits.toFixed(2)}</td>
              </tr>
            ))}
            {topRows.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-[#c5d2d9]" colSpan={6}>
                  No data yet. Publish secure public bankrolls to populate this board.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
