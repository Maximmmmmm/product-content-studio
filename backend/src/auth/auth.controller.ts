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

    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) response: Response): { success: true } {
    // Must match the attributes it was set with, or the browser keeps it.
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
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path: '/',
    };
  }
}
