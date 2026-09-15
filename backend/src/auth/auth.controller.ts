import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// `Response` and `RequestWithUser` appear in decorated parameter signatures.
// With `isolatedModules` + `emitDecoratorMetadata`, TypeScript requires those
// to be type-only imports (TS1272). `LoginDto` must stay a value import: Nest
// reads the runtime class from the metadata to validate the request body.
import type { CookieOptions, Response } from 'express';
import { SESSION_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtCookieGuard } from './jwt-cookie.guard.js';
import type { RequestWithUser } from './jwt-cookie.guard.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  // Nest answers POST with 201 by default; logging in creates no resource.
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ id: string; email: string }> {
    const user = await this.auth.validateCredentials(dto.email, dto.password);
    const { token, maxAgeMs } = this.auth.signSession(user);

    response.cookie(SESSION_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: maxAgeMs,
    });

    // The token itself is never returned in the body — it exists only in the
    // httpOnly cookie, where page JavaScript cannot reach it.
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) response: Response): { success: true } {
    // Must be cleared with the same attributes it was set with, or the browser
    // keeps the original cookie.
    response.clearCookie(SESSION_COOKIE, this.cookieOptions());

    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtCookieGuard)
  me(@Req() request: RequestWithUser): { id: string; email: string } {
    return request.user;
  }

  private cookieOptions(): CookieOptions {
    return {
      // Not readable by document.cookie, so an XSS cannot steal the session.
      httpOnly: true,
      // The frontend (:3000) and API (:3001) are the same site during local
      // development, so 'lax' still allows the cookie while giving CSRF
      // protection. A cross-domain deployment would need 'none' + HTTPS.
      sameSite: 'lax',
      // Only send over HTTPS outside development.
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path: '/',
    };
  }
}
