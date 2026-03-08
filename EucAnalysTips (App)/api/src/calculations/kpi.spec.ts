import { calculateKpis } from './kpi';
import type { Bet } from '@nouveau/types';

describe('calculateKpis', () => {
  it('computes win/loss KPIs and drawdown', () => {
    const base: Omit<Bet, 'id' | 'stakeUnits' | 'status' | 'profitUnits' | 'createdAt'> = {
      bankrollId: 'bk1',
      userId: 'u1',
      sport: 'FOOTBALL',
      oddsDecimal: 2,
      isLive: false,
      eventStartAt: '2026-01-10T12:00:00.000Z',
      legs: [],
      updatedAt: '2026-01-10T12:00:00.000Z',
      lockedAt: null,
    };

    const bets: Bet[] = [
      {
        ...base,
        id: '1',
        stakeUnits: 1,
        status: 'WIN',
        profitUnits: 1,
        createdAt: '2026-01-01T10:00:00.000Z',
      },
      {
        ...base,
        id: '2',
        stakeUnits: 1,
        status: 'LOSS',
        profitUnits: -1,
        createdAt: '2026-01-02T10:00:00.000Z',
      },
      {
        ...base,
        id: '3',
        stakeUnits: 2,
        status: 'WIN',
        profitUnits: 2,
        createdAt: '2026-01-03T10:00:00.000Z',
      },
    ];

    const result = calculateKpis(bets);

    expect(result.totalBets).toBe(3);
    expect(result.wins).toBe(2);
    expect(result.losses).toBe(1);
    expect(result.stakedUnits).toBe(4);
    expect(result.profitUnits).toBe(2);
    expect(result.winRate).toBeCloseTo(2 / 3, 4);
    expect(result.roi).toBe(0.5);
    expect(result.yield).toBe(0.5);
    expect(result.drawdown).toBe(1);
  });
});
