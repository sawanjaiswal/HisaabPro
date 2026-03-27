import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.ts'],
    testTimeout: 10_000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      CORS_ORIGIN: 'http://localhost:5173',
    },
  },
})
