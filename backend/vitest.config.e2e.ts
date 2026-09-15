import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // The suite shares one SQLite file, so specs must not run concurrently.
    fileParallelism: false,
    env: {
      // Point the app at the throwaway test database, never prisma/dev.db.
      DATABASE_URL: 'file:./test.db',
      // A fixed secret keeps runs reproducible. It is only ever used by the
      // test database and is not the secret any real deployment would use.
      JWT_SECRET: 'e2e-test-secret-not-used-outside-tests',
      JWT_EXPIRES_IN_SECONDS: '3600',
      NODE_ENV: 'test',
    },
  },
});
