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
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts'],
    // The shadow-harness suites that need a REAL Postgres and shadow mode belong to
    // vitest.shadow.config.ts (File #47). Run here they fail against the placeholder
    // DATABASE_URL below with a missing-column error that reads like schema drift —
    // 9 red tests that are actually a wrong-config invocation. The pure-unit shadow
    // files (diff/classify/redact/throttle/harness) stay in this pass.
    exclude: [
      'src/__tests__/integration/**',
      'src/lib/__tests__/prisma-shadow.spike.test.ts',
      'src/__tests__/scoped-shadow.*.test.ts',
      'src/__tests__/adoption/**',
      'src/middleware/__tests__/auth-scope-frame.test.ts',
    ],
    testTimeout: 10_000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      CORS_ORIGIN: 'http://localhost:5173',
      FEATURE_STAFF_HR: 'true',
      FEATURE_STAFF_HR_COHORT_PCT: '100',
      FEATURE_DATA_IMPORT: 'true',
      FEATURE_DATA_IMPORT_COHORT_PCT: '100',
    },
  },
})
