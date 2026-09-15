import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthenticatedUser, JwtPayload } from './auth.constants.js';

/**
 * A single generic message is returned whether the email is unknown or the
 * password is wrong. Distinguishing the two would let anyone confirm which
 * email addresses have an account.
 */
const INVALID_CREDENTIALS = 'Invalid email or password.';

@Injectable()
export class AuthService {
  /**
   * A real bcrypt hash of a throwaway value, compared against when no user is
   * found. Without it, an unknown email would return almost instantly while a
   * known email would take the ~200ms bcrypt needs, and that timing difference
   * alone reveals which accounts exist. This is not a secret; its only job is
   * to consume equivalent CPU time.
   */
  private readonly dummyHash = bcrypt.hashSync('timing-attack-mitigation', 12);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Verifies credentials and returns the admin, or throws a generic 401.
   */
  async validateCredentials(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always run a bcrypt comparison, even when the user does not exist, so
    // both paths cost the same amount of time.
    const passwordMatches = await bcrypt.compare(
      password,
      user?.passwordHash ?? this.dummyHash,
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    return { id: user.id, email: user.email };
  }

  /**
   * Signs a session token for an already-authenticated admin.
   *
   * Returns the token together with the cookie lifetime derived from the
   * token's own `exp` claim, so the cookie and the token can never expire at
   * different times.
   */
  signSession(user: AuthenticatedUser): { token: string; maxAgeMs: number } {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    const token = this.jwt.sign(payload, {
      secret: this.getSecret(),
      expiresIn: this.getSessionTtlSeconds(),
    });

    const decoded = this.jwt.decode<{ exp: number }>(token);
    const maxAgeMs = Math.max(0, decoded.exp * 1000 - Date.now());

    return { token, maxAgeMs };
  }

  /** Verifies a session token, throwing a generic 401 if it is not valid. */
  verifySession(token: string): AuthenticatedUser {
    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.getSecret(),
      });
      return { id: payload.sub, email: payload.email };
    } catch {
      // Covers expired, tampered and malformed tokens alike — the client is
      // told only that it is not authenticated.
      throw new UnauthorizedException('Not authenticated.');
    }
  }

  /**
   * The signing secret must be configured explicitly. Falling back to a
   * default would mean a misconfigured deployment silently signs tokens with a
   * value an attacker could guess.
   */
  /**
   * Session lifetime in seconds.
   *
   * Expressed as a number rather than a string like '1h' for two reasons:
   * `@nestjs/jwt` types the string form as the `ms` package's template-literal
   * type, which a value read from the environment cannot satisfy without a
   * cast; and environment variables are always strings, so the conversion has
   * to be explicit and validated rather than assumed.
   */
  private getSessionTtlSeconds(): number {
    const raw = this.config.get<string>('JWT_EXPIRES_IN_SECONDS') ?? '3600';
    const seconds = Number(raw);

    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error(
        `JWT_EXPIRES_IN_SECONDS must be a positive number of seconds, received: ${raw}`,
      );
    }

    return seconds;
  }

  private getSecret(): string {
    const secret = this.config.get<string>('JWT_SECRET');

    if (!secret) {
      throw new Error(
        'JWT_SECRET is not set. Copy .env.example to .env and set it before starting the API.',
      );
    }

    return secret;
  }
}
