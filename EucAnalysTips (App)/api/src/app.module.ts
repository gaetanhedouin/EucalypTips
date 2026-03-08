import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuditService } from './audit/audit.service';
import { BootstrapService } from './bootstrap/bootstrap.service';
import { AuthController } from './auth/auth.controller';
import { EmailService } from './auth/email.service';
import { AuthService } from './auth/auth.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { BankrollsController } from './bankrolls/bankrolls.controller';
import { BankrollsService } from './bankrolls/bankrolls.service';
import { BetsController } from './bets/bets.controller';
import { BetsService } from './bets/bets.service';
import { HealthController } from './health/health.controller';
import { PrismaService } from './prisma/prisma.service';
import { PublicController } from './public/public.controller';
import { PublicService } from './public/public.service';
import { RealtimeController } from './realtime/realtime.controller';
import { RealtimeGateway } from './realtime/realtime.gateway';
import { RealtimeService } from './realtime/realtime.service';
import { SettlementService } from './settlement/settlement.service';
import { SportsResultsService } from './sports/sports-results.service';
import { StatsService } from './stats/stats.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'super-secret-change-me',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '1d') as never },
    }),
  ],
  controllers: [
    AuthController,
    HealthController,
    UsersController,
    BankrollsController,
    BetsController,
    PublicController,
    RealtimeController,
  ],
  providers: [
    PrismaService,
    BootstrapService,
    AuditService,
    EmailService,
    AuthService,
    JwtStrategy,
    UsersService,
    BankrollsService,
    BetsService,
    StatsService,
    PublicService,
    RealtimeService,
    RealtimeGateway,
    SportsResultsService,
    SettlementService,
  ],
})
export class AppModule {}
