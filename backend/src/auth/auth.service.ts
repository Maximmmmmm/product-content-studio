import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthenticatedUser, JwtPayload } from './auth.constants.js';

const INVALID_CREDENTIALS = 'Invalid email or password.';

@Injectable()
export class AuthService {
  // Compared against when no user exists, so a wrong email and a wrong
  // password take the same time and cannot be told apart.
  private readonly dummyHash = bcrypt.hashSync('timing-attack-mitigation', 12);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    const passwordMatches = await bcrypt.compare(
      password,
      user?.passwordHash ?? this.dummyHash,
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    return { id: user.id, email: user.email };
  }

  signSession(user: AuthenticatedUser): { token: string; maxAgeMs: number } {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    const token = this.jwt.sign(payload, {
      secret: this.getSecret(),
      expiresIn: this.getSessionTtlSeconds(),
    });

    // Derived from the token so the cookie and the token cannot outlive each other.
    const decoded = this.jwt.decode<{ exp: number }>(token);
    const maxAgeMs = Math.max(0, decoded.exp * 1000 - Date.now());

    return { token, maxAgeMs };
  }

  verifySession(token: string): AuthenticatedUser {
    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.getSecret(),
      });
      return { id: payload.sub, email: payload.email };
    } catch {
      throw new UnauthorizedException('Not authenticated.');
    }
  }

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
