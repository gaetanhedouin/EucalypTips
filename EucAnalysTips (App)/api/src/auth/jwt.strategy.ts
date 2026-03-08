import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { ACCESS_COOKIE_NAME } from './auth.constants';
import { AuthService } from './auth.service';
import { readCookie } from './cookies';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => readCookie(request, ACCESS_COOKIE_NAME),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'super-secret-change-me',
    });
  }

  validate(payload: { sub: string; email: string }) {
    return this.authService.validateJwtPayload(payload);
  }
}
