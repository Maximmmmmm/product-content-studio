import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Prepares an isolated SQLite database for the e2e suite.
 *
 * The tests must never run against prisma/dev.db: they create and delete rows,
 * and a developer's local data should survive a test run. This builds a
 * throwaway prisma/test.db, applies the same migrations the real database
 * uses, seeds it, and deletes it afterwards — so the suite is reproducible and
 * needs no external service.
 */

const DATABASE_URL = 'file:./test.db';
const TEST_DB_PATH = resolve(import.meta.dirname, '../prisma/test.db');

/** Credentials the e2e specs log in with. */
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

/**
 * Runs a fixed setup command. The command strings are literals defined in this
 * file — no caller input reaches the shell.
 */
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
  // Start from a clean file so a previous crashed run cannot affect this one.
  removeTestDatabase();

  run('npx prisma migrate deploy');
  run('npx tsx prisma/seed.ts');
}

export function teardown(): void {
  removeTestDatabase();
}
