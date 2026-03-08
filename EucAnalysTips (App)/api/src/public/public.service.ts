import { Injectable, NotFoundException } from '@nestjs/common';
import type { LeaderboardRow, Sport, WidgetPayload, Window } from '@nouveau/types';
import { calculateKpis } from '../calculations/kpi';
import { mapBet } from '../common/mappers/prisma.mapper';
import { resolveDateRange } from '../common/utils/date-range.util';
import { PrismaService } from '../prisma/prisma.service';

interface LeaderboardQuery {
  window: Window;
  sport?: Sport;
  from?: string;
  to?: string;
}

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async leaderboard(query: LeaderboardQuery): Promise<LeaderboardRow[]> {
    const range = resolveDateRange(query);
    const publicBankrolls = await this.prisma.bankroll.findMany({
      where: {
        mode: 'SECURE_LOCKED',
        isPublic: true,
        ...(query.sport ? { sport: query.sport } : {}),
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const rows: LeaderboardRow[] = [];

    for (const bankroll of publicBankrolls) {
      const bets = await this.prisma.bet.findMany({
        where: {
          bankrollId: bankroll.id,
          createdAt: {
            gte: range.from,
            lte: range.to,
          },
        },
        include: {
          legs: true,
        },
      });

      const kpis = calculateKpis(bets.map((row) => mapBet(row)));
      if (kpis.totalBets === 0) {
        continue;
      }

      rows.push({
        sourceSlug: bankroll.id,
        sourceName: bankroll.name,
        sport: bankroll.sport as Sport,
        window: query.window,
        totalBets: kpis.totalBets,
        winRate: kpis.winRate,
        roi: kpis.roi,
        yield: kpis.yield,
        profitUnits: kpis.profitUnits,
        updatedAt: new Date().toISOString(),
      });
    }

    return rows.sort((a, b) => b.roi - a.roi);
  }

  async trainers() {
    const rows = await this.prisma.bankroll.findMany({
      where: {
        mode: 'SECURE_LOCKED',
        isPublic: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return rows.map((row) => ({
      slug: row.id,
      displayName: row.name,
      approvedAt: row.updatedAt.toISOString(),
    }));
  }

  async trainerPerformance(slug: string, query: LeaderboardQuery) {
    const bankroll = await this.prisma.bankroll.findUnique({ where: { id: slug } });
    if (!bankroll || !bankroll.isPublic || bankroll.mode !== 'SECURE_LOCKED') {
      throw new NotFoundException('Source not found');
    }

    const rows = await this.leaderboard(query);
    return rows.filter((row) => row.sourceSlug === slug);
  }

  async widgetData(widgetKey: string, query: LeaderboardQuery): Promise<WidgetPayload> {
    const widget = await this.prisma.widgetKey.findUnique({ where: { widgetKey } });
    if (!widget || !widget.active) {
      throw new NotFoundException('Widget key not found');
    }

    const rows = await this.leaderboard({
      window: query.window,
      sport: query.sport ?? (widget.sport as Sport | null) ?? undefined,
      from: query.from,
      to: query.to,
    });

    return {
      widgetKey,
      rows,
      generatedAt: new Date().toISOString(),
    };
  }

  async widgetEmbedHtml(widgetKey: string, query: LeaderboardQuery): Promise<string> {
    const payload = await this.widgetData(widgetKey, query);
    const rows = payload.rows
      .slice(0, 20)
      .map(
        (row) => `
          <tr>
            <td>${this.escapeHtml(row.sourceName)}</td>
            <td>${row.sport}</td>
            <td>${row.totalBets}</td>
            <td>${(row.winRate * 100).toFixed(1)}%</td>
            <td>${(row.roi * 100).toFixed(1)}%</td>
          </tr>
        `,
      )
      .join('');

    return `<!doctype html>
<html lang=\"fr\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>EucAnalypTips Widget</title>
    <style>
      body { margin:0; font-family: ui-sans-serif, -apple-system, Segoe UI, sans-serif; background:#f7fbf8; color:#13251a; }
      .wrap { padding: 12px; border:1px solid #d5e4d8; border-radius: 12px; background:#fff; }
      .head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
      h3 { margin:0; font-size:16px; }
      .note { color:#4f6658; font-size:12px; }
      table { width:100%; border-collapse:collapse; font-size:12px; }
      th, td { text-align:left; padding:6px; border-bottom:1px solid #e7f1ea; }
    </style>
  </head>
  <body>
    <div class=\"wrap\">
      <div class=\"head\">
        <h3>Public Performance</h3>
        <span class=\"note\">Updated ${new Date(payload.generatedAt).toLocaleString('fr-FR')}</span>
      </div>
      <table>
        <thead>
          <tr><th>Source</th><th>Sport</th><th>Bets</th><th>Win</th><th>ROI</th></tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan=\"5\">No public data yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  </body>
</html>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
