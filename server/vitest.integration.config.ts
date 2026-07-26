import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '../../shared/enums.js': resolve(__dirname, '../shared/enums.ts'),
      '../../../shared/enums.js': resolve(__dirname, '../shared/enums.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/integration/**/*.test.ts'],
    setupFiles: ['./src/__tests__/integration/setup.ts'],
    testTimeout: 30_000,
    fileParallelism: false,
    sequence: { concurrent: false },
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long',
      // Its own database, never hisaabpro_test: this suite TRUNCATEs every
      // table between files, and hisaabpro_test is the E2E database (see
      // scripts/e2e/db-url.mjs). Sharing one meant running the integration
      // suite silently deleted the Playwright seed, and the next E2E run
      // failed at login with "No account found" — an app bug that wasn't one.
      DATABASE_URL:
        process.env.INTEGRATION_DATABASE_URL ??
        `postgresql://${process.env.PGUSER ?? process.env.USER ?? 'postgres'}@localhost:5432/hisaabpro_integ_test`,
      CORS_ORIGIN: 'http://localhost:5173',
    },
  },
})
