import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser, SESSION_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';

/** An Express request once the guard has attached the authenticated admin. */
export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}

/**
 * Rejects any request that does not carry a valid session cookie.
 *
 * This is the only thing that actually protects admin data and operations.
 * The frontend hiding a page is a convenience for the user, never a control —
 * every admin route is guarded here on the server.
 */
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
