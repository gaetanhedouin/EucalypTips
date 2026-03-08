import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ACCESS_COOKIE_NAME,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.constants';
import { AuthService } from './auth.service';
import { readCookie } from './cookies';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email, dto.redirectBaseUrl);
  }

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto, this.extractSessionMeta(request));
    this.setAuthCookies(response, result.accessToken, result.refreshToken);
    return result;
  }

  @Post('refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = dto.refreshToken ?? readCookie(request, REFRESH_COOKIE_NAME);
    const result = await this.authService.refresh(refreshToken, this.extractSessionMeta(request));
    this.setAuthCookies(response, result.accessToken, result.refreshToken);
    return result;
  }

  @Post('logout')
  async logout(@Body() dto: LogoutDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = dto.refreshToken ?? readCookie(request, REFRESH_COOKIE_NAME);
    await this.authService.logout(refreshToken);
    this.clearAuthCookies(response);
    return { success: true };
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email, dto.redirectBaseUrl);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  private setAuthCookies(response: Response, accessToken: string, refreshToken: string): void {
    const secure = process.env.NODE_ENV === 'production';

    response.cookie(ACCESS_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
      path: '/',
    });

    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
      path: '/',
    });
  }

  private clearAuthCookies(response: Response): void {
    const secure = process.env.NODE_ENV === 'production';

    response.clearCookie(ACCESS_COOKIE_NAME, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
    });

    response.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/',
    });
  }

  private extractSessionMeta(request: Request): { userAgent?: string | null; ip?: string | null } {
    return {
      userAgent: request.headers['user-agent'] ?? null,
      ip: request.ip ?? null,
    };
  }
}
