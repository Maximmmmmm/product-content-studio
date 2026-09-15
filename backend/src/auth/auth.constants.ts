/**
 * Name of the cookie holding the admin session JWT.
 *
 * The token is only ever stored in an httpOnly cookie, never in localStorage,
 * so page JavaScript (including any injected by an XSS) cannot read it.
 */
export const SESSION_COOKIE = 'session';

/** Shape of the signed JWT payload. */
export interface JwtPayload {
  /** User id (the standard JWT "subject" claim). */
  sub: string;
  email: string;
}

/** The authenticated admin, attached to the request by JwtCookieGuard. */
export interface AuthenticatedUser {
  id: string;
  email: string;
}
