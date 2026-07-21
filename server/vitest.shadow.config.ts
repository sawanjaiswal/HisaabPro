/**
 * Shadow-harness test config (File #47).
 *
 * Separate from `vitest.config.ts` because the shadow suites need a REAL
 * Postgres: the Phase 0 spike counts `$on('query')` events, which only exist
 * when statements actually reach a database. The default unit config points
 * DATABASE_URL at a placeholder (`postgresql://test:test@localhost:5432/test`)
 * that unit tests never dial, so a real-DB test inherited from it fails with a
 * missing-column error that looks like schema drift and is not.
 *
 * `pool: 'forks'` + no parallelism: the harness reads its mode once at module
 * load, so tests must not mutate env mid-process (SS-3).
 */
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
    include: [
      'src/lib/__tests__/prisma-shadow.*.test.ts',
      'src/__tests__/scoped-shadow.*.test.ts',
      'src/__tests__/adoption/**/*.test.ts',
      'src/middleware/__tests__/auth-scope-frame.test.ts',
      // Repo-level, not server-level: the raw-client lint is a root `scripts/`
      // tool. It runs here rather than under the root vitest config because that
      // one is the frontend suite — jsdom, with a testing-library setup file —
      // and a CLI test has no business loading it. This config is already node,
      // already serial, and already the epic's runner.
      '../scripts/scoped/__tests__/*.test.ts',
    ],
    testTimeout: 30_000,
    fileParallelism: false,
    sequence: { concurrent: false },
    pool: 'forks',
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long',
      DATABASE_URL: 'postgresql://sawanjaiswal@localhost:5432/hisaabpro_test',
      CORS_ORIGIN: 'http://localhost:5173',
      // §12.1 — the mode is read ONCE at module load and `clients` is memoised onto
      // globalThis, so a test that sets this in beforeAll gets whatever the first
      // importer in the worker already cached. Declaring it here (with forks +
      // isolation) is what makes A1/A2/A3a assert the real wiring instead of
      // passing for the wrong reason.
      SCOPED_PRISMA_ENFORCE: 'shadow',
      SCOPED_PRISMA_SHADOW_SAMPLE: '1',
    },
  },
})
