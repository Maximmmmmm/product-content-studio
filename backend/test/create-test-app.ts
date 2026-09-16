import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'node:http';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app-setup.js';

export async function createTestApp(): Promise<INestApplication<Server>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<Server>>();
  configureApp(app);
  await app.init();

  return app;
}

export function cookiesFrom(response: { headers: Record<string, unknown> }) {
  const raw = response.headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? (raw as string[]) : [raw as string];
}

// supertest types `.body` as `any`, which silently disables type checking in
// every assertion that touches it.
export function bodyOf<T>(response: { body: unknown }): T {
  return response.body as T;
}

export interface AdminBody {
  id: string;
  email: string;
}

export interface ErrorBody {
  message: string | string[];
  statusCode: number;
}
