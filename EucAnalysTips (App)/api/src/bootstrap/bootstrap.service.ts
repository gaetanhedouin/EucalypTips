import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { hashSync } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { computeProfit } from '../calculations/kpi';

@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const shouldSeed =
      process.env.SEED_DEMO_DATA === 'true' ||
      (process.env.SEED_DEMO_DATA !== 'false' && process.env.NODE_ENV !== 'production');

    if (!shouldSeed) {
      return;
    }

    if (!process.env.DATABASE_URL) {
      this.logger.warn('Seed skipped: DATABASE_URL missing.');
      return;
    }

    if (!(await this.prisma.ensureDatabaseAvailable())) {
      this.logger.warn('Seed skipped: database unavailable.');
      return;
    }

    try {
      const demoUser = await this.prisma.user.upsert({
        where: { email: 'demo@eucanalyptips.local' },
        update: {
          name: 'Demo User',
          passwordHash: hashSync('Demo123!', 10),
          isAdultConfirmed: true,
          emailVerifiedAt: new Date(),
        },
        create: {
          email: 'demo@eucanalyptips.local',
          name: 'Demo User',
          passwordHash: hashSync('Demo123!', 10),
          isAdultConfirmed: true,
          emailVerifiedAt: new Date(),
        },
      });

      await this.prisma.widgetKey.upsert({
        where: { widgetKey: 'demo-public' },
        update: { active: true, name: 'Public Bankroll Widget' },
        create: {
          widgetKey: 'demo-public',
          name: 'Public Bankroll Widget',
          active: true,
        },
      });

      await this.seedDemoBankrollPerformance(demoUser.id);

      this.logger.log(`Seed complete. demo=${demoUser.email}`);
    } catch (error) {
      const message = this.toSingleLineError(error);
      this.logger.warn(`Seed skipped: database not ready (${message})`);
    }
  }

  private async seedDemoBankrollPerformance(userId: string): Promise<void> {
    const existing = await this.prisma.bankroll.findFirst({
      where: { userId, name: 'Demo Secure Football' },
    });

    const bankroll =
      existing ??
      (await this.prisma.bankroll.create({
        data: {
          userId,
          name: 'Demo Secure Football',
          mode: 'SECURE_LOCKED',
          isPublic: true,
          sport: 'FOOTBALL',
          currency: 'EUR',
          timezone: 'Europe/Paris',
        },
      }));

    const currentCount = await this.prisma.bet.count({ where: { bankrollId: bankroll.id } });
    if (currentCount > 0) {
      return;
    }

    const now = Date.now();
    const baseDate = (hoursAgo: number) => new Date(now - hoursAgo * 60 * 60 * 1000);

    const demoRows = [
      { stake: 1, odds: 1.9, status: 'WIN' as const, date: baseDate(72) },
      { stake: 1, odds: 2.1, status: 'LOSS' as const, date: baseDate(48) },
      { stake: 2, odds: 1.8, status: 'WIN' as const, date: baseDate(24) },
    ];

    for (const row of demoRows) {
      await this.prisma.bet.create({
        data: {
          bankrollId: bankroll.id,
          userId,
          sport: 'FOOTBALL',
          stakeUnits: row.stake,
          oddsDecimal: row.odds,
          isLive: false,
          eventStartAt: row.date,
          status: row.status,
          profitUnits: computeProfit(row.stake, row.odds, row.status),
          lockedAt: row.date,
          createdAt: row.date,
          updatedAt: row.date,
        },
      });
    }
  }

  private toSingleLineError(error: unknown): string {
    if (error instanceof Error) {
      return error.message.split('\n')[0]?.trim() ?? 'Unknown error';
    }
    return String(error);
  }
}
