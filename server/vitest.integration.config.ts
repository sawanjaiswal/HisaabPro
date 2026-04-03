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
      DATABASE_URL: 'postgresql://sawanjaiswal@localhost:5432/hisaabpro_test',
      CORS_ORIGIN: 'http://localhost:5173',
    },
  },
})
