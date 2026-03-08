import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../common/types/auth-user.type';
import type { Bankroll } from '@nouveau/types';
import { AuditService } from '../audit/audit.service';
import { resolveDateRange } from '../common/utils/date-range.util';
import { mapBankroll, mapBet } from '../common/mappers/prisma.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from '../stats/stats.service';
import { CreateBankrollDto } from './dto/create-bankroll.dto';
import { UpdateBankrollDto } from './dto/update-bankroll.dto';

@Injectable()
export class BankrollsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statsService: StatsService,
    private readonly auditService: AuditService,
  ) {}

  async list(currentUser: AuthUser): Promise<Bankroll[]> {
    const rows = await this.prisma.bankroll.findMany({
      where: { userId: currentUser.sub },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => mapBankroll(row));
  }

  async create(currentUser: AuthUser, dto: CreateBankrollDto): Promise<Bankroll> {
    if (dto.isPublic && dto.mode !== 'SECURE_LOCKED') {
      throw new BadRequestException('Public bankroll requires SECURE_LOCKED mode');
    }

    const bankroll = await this.prisma.bankroll.create({
      data: {
        userId: currentUser.sub,
        name: dto.name,
        mode: dto.mode,
        // Bankrolls are multi-sport in app UX; keep a technical default for compatibility.
        sport: 'FOOTBALL',
        isPublic: Boolean(dto.isPublic),
        currency: 'EUR',
        timezone: 'Europe/Paris',
      },
    });

    await this.auditService.log({
      userId: currentUser.sub,
      action: 'BANKROLL_CREATED',
      payload: { bankrollId: bankroll.id, mode: bankroll.mode },
    });

    return mapBankroll(bankroll);
  }

  async update(currentUser: AuthUser, bankrollId: string, dto: UpdateBankrollDto): Promise<Bankroll> {
    const bankroll = await this.prisma.bankroll.findUnique({ where: { id: bankrollId } });
    if (!bankroll) {
      throw new NotFoundException('Bankroll not found');
    }

    if (!this.canManage(currentUser, bankroll.userId)) {
      throw new ForbiddenException('Not allowed');
    }

    const nextMode = dto.mode ?? bankroll.mode;
    const nextIsPublic = dto.isPublic ?? bankroll.isPublic;

    if (nextIsPublic && nextMode !== 'SECURE_LOCKED') {
      throw new BadRequestException('Public bankroll requires SECURE_LOCKED mode');
    }

    const updated = await this.prisma.bankroll.update({
      where: { id: bankroll.id },
      data: {
        name: dto.name ?? bankroll.name,
        mode: nextMode,
        isPublic: nextIsPublic,
      },
    });

    await this.auditService.log({
      userId: currentUser.sub,
      action: 'BANKROLL_UPDATED',
      payload: { bankrollId: updated.id, mode: updated.mode, isPublic: updated.isPublic },
    });

    return mapBankroll(updated);
  }

  async getById(currentUser: AuthUser, bankrollId: string): Promise<Bankroll> {
    const bankroll = await this.prisma.bankroll.findUnique({ where: { id: bankrollId } });
    if (!bankroll) {
      throw new NotFoundException('Bankroll not found');
    }

    if (this.canManage(currentUser, bankroll.userId) || bankroll.isPublic) {
      return mapBankroll(bankroll);
    }

    throw new ForbiddenException('Not allowed to read this bankroll');
  }

  async stats(
    currentUser: AuthUser,
    bankrollId: string,
    params: { from?: string; to?: string; sport?: string },
  ) {
    await this.getById(currentUser, bankrollId);
    const range = resolveDateRange({ from: params.from, to: params.to, window: 'CUSTOM' });

    const rows = await this.prisma.bet.findMany({
      where: {
        bankrollId,
        createdAt: {
          gte: range.from,
          lte: range.to,
        },
      },
      include: {
        legs: true,
      },
    });

    const bets = rows.map((row) => mapBet(row));
    return this.statsService.buildBankrollStats(bankrollId, bets, range.from, range.to);
  }

  async remove(currentUser: AuthUser, bankrollId: string): Promise<{ success: true }> {
    const bankroll = await this.prisma.bankroll.findUnique({ where: { id: bankrollId } });
    if (!bankroll) {
      throw new NotFoundException('Bankroll not found');
    }

    if (!this.canManage(currentUser, bankroll.userId)) {
      throw new ForbiddenException('Not allowed');
    }

    await this.prisma.bankroll.delete({ where: { id: bankroll.id } });

    await this.auditService.log({
      userId: currentUser.sub,
      action: 'BANKROLL_DELETED',
      payload: { bankrollId: bankroll.id },
    });

    return { success: true };
  }
  private canManage(currentUser: AuthUser, ownerId: string): boolean {
    return currentUser.sub === ownerId;
  }
}

