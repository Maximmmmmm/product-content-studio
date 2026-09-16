import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser, SESSION_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

@Injectable()
export class JwtCookieGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = (request.cookies as Record<string, string> | undefined)?.[
      SESSION_COOKIE
    ];

    if (!token) {
      throw new UnauthorizedException('Not authenticated.');
    }

    request.user = this.auth.verifySession(token);

    return true;
  }
}
