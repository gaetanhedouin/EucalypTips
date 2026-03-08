import type { Bet, BetStatus } from '@nouveau/types';

export interface KpiResult {
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  stakedUnits: number;
  profitUnits: number;
  roi: number;
  yield: number;
  drawdown: number;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function computeProfit(stakeUnits: number, oddsDecimal: number, status: BetStatus): number {
  if (status === 'WIN') {
    return round(stakeUnits * (oddsDecimal - 1));
  }

  if (status === 'LOSS') {
    return round(-stakeUnits);
  }

  return 0;
}

export function calculateKpis(bets: Bet[]): KpiResult {
  const resolvedBets = bets
    .filter((bet) => bet.status !== 'PENDING')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const totalBets = resolvedBets.length;
  const wins = resolvedBets.filter((bet) => bet.status === 'WIN').length;
  const losses = resolvedBets.filter((bet) => bet.status === 'LOSS').length;
  const stakedUnits = round(resolvedBets.reduce((acc, bet) => acc + bet.stakeUnits, 0));
  const profitUnits = round(resolvedBets.reduce((acc, bet) => acc + bet.profitUnits, 0));
  const winRate = totalBets > 0 ? round(wins / totalBets) : 0;
  const roi = stakedUnits > 0 ? round(profitUnits / stakedUnits) : 0;
  const yieldValue = roi;

  let runningProfit = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const bet of resolvedBets) {
    runningProfit += bet.profitUnits;
    if (runningProfit > peak) {
      peak = runningProfit;
    }

    const drawdown = peak - runningProfit;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return {
    totalBets,
    wins,
    losses,
    winRate,
    stakedUnits,
    profitUnits,
    roi,
    yield: yieldValue,
    drawdown: round(maxDrawdown),
  };
}
