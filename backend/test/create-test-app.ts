import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app-setup.js';

/**
 * Builds the application exactly as `main.ts` does.
 *
 * Going through `configureApp` is the point: it means the e2e suite exercises
 * the real cookie parsing and the real validation pipe, rather than a bare
 * TestingModule app that would let invalid payloads through and make the
 * validation tests meaningless.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  configureApp(app);
  await app.init();

  return app;
}

/** Pulls the Set-Cookie values off a supertest response. */
export function cookiesFrom(response: { headers: Record<string, unknown> }) {
  const raw = response.headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? (raw as string[]) : [raw as string];
}

/**
 * Reads a supertest response body at a declared type.
 *
 * supertest types `.body` as `any`, which silently disables type checking in
 * every assertion that touches it. Naming the expected shape here keeps the
 * assertions type-checked instead.
 */
export function bodyOf<T>(response: { body: unknown }): T {
  return response.body as T;
}

/** The admin object returned by /auth/login and /auth/me. */
export interface AdminBody {
  id: string;
  email: string;
}

/** Nest's standard error response shape. */
export interface ErrorBody {
  message: string | string[];
  statusCode: number;
}
