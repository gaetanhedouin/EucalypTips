import { Injectable } from '@nestjs/common';
import type { BankrollStats, Bet } from '@nouveau/types';
import { calculateKpis } from '../calculations/kpi';

@Injectable()
export class StatsService {
  buildBankrollStats(bankrollId: string, bets: Bet[], from: Date, to: Date): BankrollStats {
    const filtered = bets.filter((bet) => {
      const date = new Date(bet.createdAt);
      return date >= from && date <= to;
    });

    const kpis = calculateKpis(filtered);

    return {
      bankrollId,
      from: from.toISOString(),
      to: to.toISOString(),
      totalBets: kpis.totalBets,
      wins: kpis.wins,
      losses: kpis.losses,
      winRate: kpis.winRate,
      stakedUnits: kpis.stakedUnits,
      profitUnits: kpis.profitUnits,
      roi: kpis.roi,
      yield: kpis.yield,
      drawdown: kpis.drawdown,
    };
  }
}
