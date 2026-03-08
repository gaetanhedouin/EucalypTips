import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  AuthLoginResponse,
  AuthMe,
  AuthRefreshResponse,
  AuthRegisterResponse,
  AuthSessionTokens,
} from '@nouveau/types';
import { compareSync, hashSync } from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  REFRESH_TOKEN_TTL_SECONDS,
  ACCESS_TOKEN_TTL_SECONDS,
} from './auth.constants';
import { EmailService } from './email.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

interface SessionMeta {
  userAgent?: string | null;
  ip?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthRegisterResponse> {
    await this.ensureDatabaseAvailable();

    if (!dto.isAdultConfirmed) {
      throw new BadRequestException('18+ confirmation is required');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('Email already used');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hashSync(dto.password, 10),
        name: dto.name,
        isAdultConfirmed: dto.isAdultConfirmed,
      },
    });

    const token = await this.createEmailVerificationToken(user.id);
    const verifyUrl = this.buildFrontendUrl('/verify', token, dto.redirectBaseUrl);
    await this.emailService.sendVerificationEmail({
      to: user.email,
      name: user.name,
      verifyUrl,
    });

    await this.auditService.log({
      userId: user.id,
      action: 'USER_REGISTERED',
      payload: { email: user.email },
    });

    return {
      success: true,
      pendingVerification: true,
      verificationUrlPreview: this.emailService.isMockMode() ? verifyUrl : undefined,
    };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ success: true }> {
    await this.ensureDatabaseAvailable();

    const tokenHash = this.hashToken(dto.token);
    const tokenRecord = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.consumedAt || tokenRecord.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Verification token invalid or expired');
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: tokenRecord.userId },
        data: { emailVerifiedAt: tokenRecord.user.emailVerifiedAt ?? now },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: tokenRecord.id },
        data: { consumedAt: now },
      }),
    ]);

    await this.auditService.log({
      userId: tokenRecord.userId,
      action: 'EMAIL_VERIFIED',
      payload: {},
    });

    return { success: true };
  }

  async resendVerification(
    email: string,
    redirectBaseUrl?: string,
  ): Promise<{ success: true; verificationUrlPreview?: string }> {
    await this.ensureDatabaseAvailable();

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerifiedAt) {
      return { success: true };
    }

    const token = await this.createEmailVerificationToken(user.id);
    const verifyUrl = this.buildFrontendUrl('/verify', token, redirectBaseUrl);
    await this.emailService.sendVerificationEmail({
      to: user.email,
      name: user.name,
      verifyUrl,
    });

    await this.auditService.log({
      userId: user.id,
      action: 'EMAIL_VERIFICATION_RESENT',
      payload: {},
    });

    return {
      success: true,
      verificationUrlPreview: this.emailService.isMockMode() ? verifyUrl : undefined,
    };
  }

  async login(dto: LoginDto, meta: SessionMeta): Promise<AuthLoginResponse> {
    await this.ensureDatabaseAvailable();

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !compareSync(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Email not verified');
    }

    const tokens = await this.issueSessionTokens(user.id, user.email, meta);

    await this.auditService.log({
      userId: user.id,
      action: 'USER_LOGGED_IN',
      payload: {},
    });

    return {
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.toAuthMe(user),
    };
  }

  async refresh(refreshToken: string | null, meta: SessionMeta): Promise<AuthRefreshResponse> {
    await this.ensureDatabaseAvailable();

    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() < Date.now() ||
      !session.user.emailVerifiedAt
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const now = new Date();
    const nextRefreshToken = this.generateToken();
    const nextRefreshHash = this.hashToken(nextRefreshToken);

    await this.prisma.$transaction([
      this.prisma.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: now },
      }),
      this.prisma.refreshSession.create({
        data: {
          userId: session.userId,
          tokenHash: nextRefreshHash,
          userAgent: meta.userAgent ?? null,
          ip: meta.ip ?? null,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
        },
      }),
    ]);

    return {
      success: true,
      accessToken: this.signAccessToken(session.user.id, session.user.email),
      refreshToken: nextRefreshToken,
    };
  }

  async logout(refreshToken: string | null): Promise<{ success: true }> {
    await this.ensureDatabaseAvailable();

    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshSession.updateMany({
        where: {
          tokenHash,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    return { success: true };
  }

  async forgotPassword(email: string, redirectBaseUrl?: string): Promise<{ success: true; resetUrlPreview?: string }> {
    await this.ensureDatabaseAvailable();

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { success: true };
    }

    const now = new Date();
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        consumedAt: null,
      },
      data: {
        consumedAt: now,
      },
    });

    const token = this.generateToken();
    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash: this.hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });

    const resetUrl = this.buildFrontendUrl('/reset-password', token, redirectBaseUrl);
    await this.emailService.sendResetPasswordEmail({
      to: user.email,
      name: user.name,
      resetUrl,
    });

    await this.auditService.log({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
      payload: {},
    });

    return {
      success: true,
      resetUrlPreview: this.emailService.isMockMode() ? resetUrl : undefined,
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    await this.ensureDatabaseAvailable();

    const tokenHash = this.hashToken(dto.token);
    const tokenRecord = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.consumedAt || tokenRecord.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Reset token invalid or expired');
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: tokenRecord.userId },
        data: {
          passwordHash: hashSync(dto.newPassword, 10),
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { consumedAt: now },
      }),
      this.prisma.refreshSession.updateMany({
        where: {
          userId: tokenRecord.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      }),
    ]);

    await this.auditService.log({
      userId: tokenRecord.userId,
      action: 'PASSWORD_RESET_DONE',
      payload: {},
    });

    return { success: true };
  }

  async validateJwtPayload(payload: { sub: string; email: string }) {
    await this.ensureDatabaseAvailable();

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.emailVerifiedAt) {
      throw new UnauthorizedException();
    }

    return {
      sub: user.id,
      email: user.email,
    };
  }

  private async issueSessionTokens(userId: string, email: string, meta: SessionMeta): Promise<AuthSessionTokens> {
    const refreshToken = this.generateToken();
    const tokenHash = this.hashToken(refreshToken);

    await this.prisma.refreshSession.create({
      data: {
        userId,
        tokenHash,
        userAgent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
    });

    return {
      accessToken: this.signAccessToken(userId, email),
      refreshToken,
    };
  }

  private signAccessToken(userId: string, email: string): string {
    return this.jwtService.sign(
      { sub: userId, email },
      {
        expiresIn: `${ACCESS_TOKEN_TTL_SECONDS}s`,
      },
    );
  }

  private async createEmailVerificationToken(userId: string): Promise<string> {
    const now = new Date();
    await this.prisma.emailVerificationToken.updateMany({
      where: {
        userId,
        consumedAt: null,
      },
      data: {
        consumedAt: now,
      },
    });

    const token = this.generateToken();
    await this.prisma.emailVerificationToken.create({
      data: {
        tokenHash: this.hashToken(token),
        userId,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      },
    });

    return token;
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  private toAuthMe(user: {
    id: string;
    email: string;
    name: string;
    isAdultConfirmed: boolean;
    emailVerifiedAt: Date | null;
    createdAt: Date;
  }): AuthMe {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isAdultConfirmed: user.isAdultConfirmed,
      emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private buildFrontendUrl(path: string, token: string, redirectBaseUrl?: string): string {
    const selectedBase = this.resolveRedirectBaseUrl(redirectBaseUrl);
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${selectedBase}${normalizedPath}?token=${encodeURIComponent(token)}`;
  }

  private resolveRedirectBaseUrl(redirectBaseUrl?: string): string {
    const defaultAppBaseUrl = (process.env.APP_WEB_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '');
    const defaultSiteBaseUrl = (process.env.SITE_WEB_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

    const allowlistFromEnv = (process.env.AUTH_REDIRECT_ALLOWLIST ?? '')
      .split(',')
      .map((entry) => entry.trim().replace(/\/$/, ''))
      .filter(Boolean);

    const allowlist = Array.from(new Set([
      ...allowlistFromEnv,
      defaultAppBaseUrl,
      defaultSiteBaseUrl,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ]));

    const requested = (redirectBaseUrl ?? '').trim().replace(/\/$/, '');
    if (requested && allowlist.includes(requested)) {
      return requested;
    }

    return defaultAppBaseUrl;
  }

  private async ensureDatabaseAvailable(): Promise<void> {
    if (await this.prisma.ensureDatabaseAvailable()) {
      return;
    }

    throw new ServiceUnavailableException(
      'Database unavailable. Please ensure PostgreSQL is running.',
    );
  }
}
