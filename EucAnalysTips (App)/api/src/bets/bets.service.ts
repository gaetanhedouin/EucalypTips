import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Bet } from '@nouveau/types';
import { AuditService } from '../audit/audit.service';
import { computeProfit } from '../calculations/kpi';
import { mapBet } from '../common/mappers/prisma.mapper';
import type { AuthUser } from '../common/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateBetDto } from './dto/create-bet.dto';
import { ListBetsQueryDto } from './dto/list-bets-query.dto';
import { UpdateBetDto } from './dto/update-bet.dto';

@Injectable()
export class BetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
    private readonly auditService: AuditService,
  ) {}

  async create(currentUser: AuthUser, dto: CreateBetDto): Promise<Bet> {
    const bankroll = await this.prisma.bankroll.findUnique({ where: { id: dto.bankrollId } });
    if (!bankroll) {
      throw new NotFoundException('Bankroll not found');
    }

    if (!this.canManage(currentUser, bankroll.userId)) {
      throw new ForbiddenException('Cannot create bet on this bankroll');
    }

    const createdAt = new Date();
    const lockedAt = bankroll.mode === 'SECURE_LOCKED' && dto.isLive ? createdAt : null;

    const created = await this.prisma.bet.create({
      data: {
        bankrollId: bankroll.id,
        userId: bankroll.userId,
        sport: dto.sport,
        bookmaker: dto.bookmaker?.trim() ?? '',
        stakeUnits: dto.stakeUnits,
        oddsDecimal: dto.oddsDecimal,
        isLive: dto.isLive,
        eventStartAt: new Date(dto.eventStartAt),
        status: 'PENDING',
        profitUnits: 0,
        createdAt,
        updatedAt: createdAt,
        lockedAt,
        legs: {
          create: (dto.legs ?? []).map((leg) => ({
            sportEventId: leg.sportEventId,
            market: leg.market,
            selection: leg.selection,
            oddsDecimal: leg.oddsDecimal,
          })),
        },
      },
      include: {
        legs: true,
      },
    });

    const bet = mapBet(created);

    await this.auditService.log({
      userId: currentUser.sub,
      action: 'BET_CREATED',
      payload: { betId: bet.id, bankrollId: bet.bankrollId, isLive: bet.isLive },
    });

    const emittedAt = new Date().toISOString();
    this.realtimeService.emit({ type: 'bet.created', payload: bet, emittedAt });
    if (bet.lockedAt) {
      this.realtimeService.emit({ type: 'bet.locked', payload: { betId: bet.id }, emittedAt });
    }
    this.realtimeService.emit({ type: 'stats.updated', payload: { bankrollId: bet.bankrollId }, emittedAt });
    this.realtimeService.emit({ type: 'leaderboard.updated', payload: { sport: bet.sport }, emittedAt });

    return bet;
  }

  async update(currentUser: AuthUser, betId: string, dto: UpdateBetDto): Promise<Bet> {
    const row = await this.prisma.bet.findUnique({
      where: { id: betId },
      include: {
        legs: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Bet not found');
    }

    const bet = mapBet(row);

    const bankroll = await this.prisma.bankroll.findUnique({ where: { id: bet.bankrollId } });
    if (!bankroll) {
      throw new NotFoundException('Bankroll not found');
    }

    if (!this.canManage(currentUser, bankroll.userId)) {
      throw new ForbiddenException('Cannot update this bet');
    }

    const nextSport = dto.sport ?? bet.sport;
    const nextBookmaker = dto.bookmaker !== undefined ? dto.bookmaker.trim() : (bet.bookmaker ?? '');
    const nextIsLive = dto.isLive ?? bet.isLive;
    const nextStakeUnits = dto.stakeUnits ?? bet.stakeUnits;
    const nextOddsDecimal = dto.oddsDecimal ?? bet.oddsDecimal;
    const nextStatus = dto.status ?? bet.status;
    const nextProfitUnits = computeProfit(nextStakeUnits, nextOddsDecimal, nextStatus);
    const nextLegs = dto.legs;

    const updatedRow = await this.prisma.bet.update({
      where: { id: bet.id },
      data: {
        sport: nextSport,
        bookmaker: nextBookmaker,
        stakeUnits: nextStakeUnits,
        oddsDecimal: nextOddsDecimal,
        isLive: nextIsLive,
        eventStartAt: dto.eventStartAt ? new Date(dto.eventStartAt) : new Date(bet.eventStartAt),
        status: nextStatus,
        profitUnits: nextProfitUnits,
        legs: nextLegs
          ? {
              deleteMany: {},
              create: nextLegs.map((leg) => ({
                sportEventId: leg.sportEventId,
                market: leg.market,
                selection: leg.selection,
                oddsDecimal: leg.oddsDecimal,
              })),
            }
          : undefined,
        lockedAt:
          bankroll.mode === 'SECURE_LOCKED' && nextIsLive
            ? row.lockedAt ?? new Date()
            : row.lockedAt,
      },
      include: {
        legs: true,
      },
    });

    const updated = mapBet(updatedRow);

    await this.auditService.log({
      userId: currentUser.sub,
      action: dto.status !== undefined ? 'BET_STATUS_UPDATED' : 'BET_UPDATED',
      payload: { betId: updated.id, status: updated.status },
    });

    const emittedAt = new Date().toISOString();
    this.realtimeService.emit({ type: 'bet.updated', payload: updated, emittedAt });
    if (dto.status !== undefined && updated.status !== 'PENDING') {
      this.realtimeService.emit({ type: 'bet.settled', payload: updated, emittedAt });
    }
    if (updated.lockedAt && !bet.lockedAt) {
      this.realtimeService.emit({ type: 'bet.locked', payload: { betId: updated.id }, emittedAt });
    }
    this.realtimeService.emit({ type: 'stats.updated', payload: { bankrollId: updated.bankrollId }, emittedAt });
    this.realtimeService.emit({ type: 'leaderboard.updated', payload: { sport: updated.sport }, emittedAt });

    return updated;
  }

  async list(currentUser: AuthUser, query: ListBetsQueryDto): Promise<Bet[]> {
    const rows = await this.prisma.bet.findMany({
      where: {
        userId: currentUser.sub,
        ...(query.bankrollId ? { bankrollId: query.bankrollId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.sport ? { sport: query.sport } : {}),
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        legs: true,
      },
    });

    return rows.map((row) => mapBet(row));
  }

  private canManage(currentUser: AuthUser, ownerId: string): boolean {
    return currentUser.sub === ownerId;
  }
}
