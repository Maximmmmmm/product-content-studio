import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const DATABASE_URL = 'file:./test.db';
const TEST_DB_PATH = resolve(import.meta.dirname, '../prisma/test.db');

export const TEST_ADMIN_EMAIL = 'e2e-admin@example.com';
export const TEST_ADMIN_PASSWORD = 'e2e-password-123';

function removeTestDatabase(): void {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const path = `${TEST_DB_PATH}${suffix}`;
    if (existsSync(path)) {
      rmSync(path, { force: true });
    }
  }
}

function run(command: string): void {
  execSync(command, {
    cwd: resolve(import.meta.dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL,
      SEED_ADMIN_EMAIL: TEST_ADMIN_EMAIL,
      SEED_ADMIN_PASSWORD: TEST_ADMIN_PASSWORD,
    },
  });
}

export function setup(): void {
  removeTestDatabase();

  run('npx prisma migrate deploy');
  run('npx tsx prisma/seed.ts');
}

export function teardown(): void {
  removeTestDatabase();
}
