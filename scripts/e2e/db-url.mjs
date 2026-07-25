/**
 * SSOT for the E2E database URL.
 *
 * Consumed by playwright.config.ts (to point the API process at it) and by
 * scripts/e2e/run.mjs (to point reset/seed at it). Without a single source the
 * two drift and you get the worst outcome: specs truncate one database while
 * the API writes to another, so failures look like app bugs.
 *
 * NEVER falls back to server/.env's DATABASE_URL — that is the dev database,
 * and e2e:reset truncates every table it is pointed at. The reset script's own
 * `_test`/`_e2e` name guard is the second line of defence, not the first.
 */

export function e2eDatabaseUrl() {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL
  const user = process.env.PGUSER ?? process.env.USER ?? 'postgres'
  return `postgresql://${user}@localhost:5432/hisaabpro_test`
}
