import type { Bankroll, Bet } from '@nouveau/types';
import type {
  Bankroll as PrismaBankroll,
  Bet as PrismaBet,
  BetLeg as PrismaBetLeg,
} from '@prisma/client';

export function mapBankroll(row: PrismaBankroll): Bankroll {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    mode: row.mode,
    isPublic: row.isPublic,
    sport: row.sport,
    currency: row.currency as 'EUR',
    timezone: row.timezone as 'Europe/Paris',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapBet(row: PrismaBet & { legs?: PrismaBetLeg[] }): Bet {
  return {
    id: row.id,
    bankrollId: row.bankrollId,
    userId: row.userId,
    sport: row.sport,
    bookmaker: row.bookmaker,
    stakeUnits: row.stakeUnits,
    oddsDecimal: row.oddsDecimal,
    isLive: row.isLive,
    eventStartAt: row.eventStartAt.toISOString(),
    status: row.status,
    profitUnits: row.profitUnits,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lockedAt: row.lockedAt ? row.lockedAt.toISOString() : null,
    legs: (row.legs ?? []).map((leg) => ({
      id: leg.id,
      betId: leg.betId,
      sportEventId: leg.sportEventId,
      market: leg.market,
      selection: leg.selection,
      oddsDecimal: leg.oddsDecimal,
    })),
  };
}
