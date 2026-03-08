import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Bet, BetLeg, BetStatus } from '@nouveau/types';

interface EventScore {
  finished: boolean;
  homeScore: number;
  awayScore: number;
}

@Injectable()
export class SportsResultsService {
  private readonly mode = (process.env.SPORTS_RESULTS_MODE ?? 'mock').toLowerCase();
  private readonly sportsDbApiKey = process.env.SPORTSDB_API_KEY ?? '3';

  async resolveBetOutcome(bet: Bet): Promise<BetStatus> {
    if (!bet.legs.length) {
      return this.fallbackOutcome(bet);
    }

    const outcomes: BetStatus[] = [];
    for (const leg of bet.legs) {
      const legResult = await this.resolveLegOutcome(leg);
      if (legResult === 'PENDING') {
        return 'PENDING';
      }
      outcomes.push(legResult);
    }

    return outcomes.every((status) => status === 'WIN') ? 'WIN' : 'LOSS';
  }

  private async resolveLegOutcome(leg: BetLeg): Promise<BetStatus> {
    const event = await this.fetchEventScore(leg.sportEventId);
    if (!event) {
      return this.fallbackLegOutcome(leg);
    }

    if (!event.finished) {
      return 'PENDING';
    }

    return this.evaluateLeg(leg, event);
  }

  private evaluateLeg(leg: BetLeg, event: EventScore): BetStatus {
    const market = leg.market.trim().toUpperCase();
    const selection = leg.selection.trim().toUpperCase();

    if (market === 'MATCH_WINNER' || market === '1X2') {
      if (selection === 'HOME' || selection === '1') {
        return event.homeScore > event.awayScore ? 'WIN' : 'LOSS';
      }

      if (selection === 'AWAY' || selection === '2') {
        return event.awayScore > event.homeScore ? 'WIN' : 'LOSS';
      }

      if (selection === 'DRAW' || selection === 'X') {
        return event.homeScore === event.awayScore ? 'WIN' : 'LOSS';
      }
    }

    return this.fallbackLegOutcome(leg, `${event.homeScore}:${event.awayScore}`);
  }

  private async fetchEventScore(eventId: string): Promise<EventScore | null> {
    if (this.mode !== 'api') {
      return null;
    }

    try {
      const url = `https://www.thesportsdb.com/api/v1/json/${this.sportsDbApiKey}/lookupevent.php?id=${eventId}`;
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as {
        events?: Array<{
          intHomeScore?: string | null;
          intAwayScore?: string | null;
          strStatus?: string | null;
        }>;
      };

      const event = payload.events?.[0];
      if (!event) {
        return null;
      }

      const hasScores = event.intHomeScore != null && event.intAwayScore != null;
      const status = (event.strStatus ?? '').toUpperCase();
      const finished = hasScores || status.includes('FT') || status.includes('AET') || status.includes('FINISHED');

      return {
        finished,
        homeScore: Number(event.intHomeScore ?? 0),
        awayScore: Number(event.intAwayScore ?? 0),
      };
    } catch {
      return null;
    }
  }

  private fallbackOutcome(bet: Bet): BetStatus {
    const seed = `${bet.id}:${bet.eventStartAt}:${bet.oddsDecimal}`;
    const hash = createHash('sha256').update(seed).digest('hex');
    const firstByte = parseInt(hash.slice(0, 2), 16);
    return firstByte % 2 === 0 ? 'WIN' : 'LOSS';
  }

  private fallbackLegOutcome(leg: BetLeg, extraSeed = ''): BetStatus {
    const seed = `${leg.sportEventId}:${leg.market}:${leg.selection}:${extraSeed}`;
    const hash = createHash('sha256').update(seed).digest('hex');
    const firstByte = parseInt(hash.slice(0, 2), 16);
    return firstByte % 2 === 0 ? 'WIN' : 'LOSS';
  }
}
