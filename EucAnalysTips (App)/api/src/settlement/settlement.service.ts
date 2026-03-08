import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { computeProfit } from '../calculations/kpi';
import { mapBet } from '../common/mappers/prisma.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { SportsResultsService } from '../sports/sports-results.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);
  private workerPausedLogged = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sportsResultsService: SportsResultsService,
    private readonly realtimeService: RealtimeService,
    private readonly auditService: AuditService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async settlePendingBets(): Promise<void> {
    if (!process.env.DATABASE_URL || !(await this.prisma.ensureDatabaseAvailable())) {
      if (!this.workerPausedLogged) {
        this.logger.warn('Settlement worker paused: database unavailable.');
        this.workerPausedLogged = true;
      }
      return;
    }

    try {
      this.workerPausedLogged = false;
      const rows = await this.prisma.bet.findMany({
        where: {
          status: 'PENDING',
          eventStartAt: {
            lte: new Date(),
          },
        },
        include: {
          legs: true,
        },
        take: 200,
      });

      for (const row of rows) {
        const bet = mapBet(row);
        const outcome = await this.sportsResultsService.resolveBetOutcome(bet);
        if (outcome === 'PENDING') {
          continue;
        }

        const profit = computeProfit(bet.stakeUnits, bet.oddsDecimal, outcome);
        const updatedRow = await this.prisma.bet.update({
          where: { id: bet.id },
          data: {
            status: outcome,
            profitUnits: profit,
            lockedAt: row.lockedAt ?? new Date(),
          },
          include: {
            legs: true,
          },
        });

        await this.prisma.settlement.upsert({
          where: { betId: bet.id },
          update: {
            result: outcome,
            settledAt: new Date(),
            providerEventId: bet.legs[0]?.sportEventId ?? bet.id,
          },
          create: {
            betId: bet.id,
            result: outcome,
            settledAt: new Date(),
            providerEventId: bet.legs[0]?.sportEventId ?? bet.id,
          },
        });

        const updated = mapBet(updatedRow);

        await this.auditService.log({
          userId: updated.userId,
          action: 'BET_SETTLED',
          payload: { betId: updated.id, status: updated.status, profitUnits: updated.profitUnits },
        });

        const emittedAt = new Date().toISOString();
        this.realtimeService.emit({ type: 'bet.settled', payload: updated, emittedAt });
        this.realtimeService.emit({ type: 'stats.updated', payload: { bankrollId: updated.bankrollId }, emittedAt });
        this.realtimeService.emit({ type: 'leaderboard.updated', payload: { sport: updated.sport }, emittedAt });
      }
    } catch (error) {
      const message = this.toSingleLineError(error);
      this.logger.warn(`Settlement cycle skipped: ${message}`);
    }
  }

  private toSingleLineError(error: unknown): string {
    if (error instanceof Error) {
      return error.message.split('\n')[0]?.trim() ?? 'Unknown error';
    }
    return String(error);
  }
}
