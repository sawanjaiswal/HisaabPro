# E2E — real backend only

Plan: `docs/E2E_TEST_PLAN.md` · Coverage matrix: `docs/E2E_COVERAGE_MATRIX.md`
Gate: `npm run e2e:coverage` (exit 1 if any of the 401 modules is unclaimed)

## Layout

| Dir | What | Runs? |
|---|---|---|
| `gold/` | Gold-standard specs — real Express + real Postgres, no request stubbing | yes |
| `legacy-mocked/` | The pre-existing 26 specs | **no** (`testIgnore`) |
| `coverage-map.json` | Module → suite claim file, read by the gate | n/a |

## Why `legacy-mocked/` is quarantined

Those specs called `loginAsAdmin()`, which did:

```ts
await page.route('**/api/auth/me', (route) => route.fulfill({ …MOCK… }))
await page.evaluate(() => sessionStorage.setItem('cachedUser', …))
```

The server was never contacted. A green run there says the React tree renders
against fixtures — it says nothing about auth, tenancy, GST maths, or
persistence. They are kept for their selector knowledge, not counted as proof.
Port them into `gold/` one at a time as each suite is executed.

## Running

```bash
npm run e2e:reset          # drop all rows in the E2E database
npm run e2e:seed           # FIX-ONBOARDED tenant
npm run e2e:seed -- --seeded   # + parties, products, invoices (FIX-SEEDED)
npm run test:e2e           # Playwright boots API (5001) + web (5002) itself
```

`playwright.config.ts` starts `dev:api` with `E2E_TEST_HOOKS=1`, which is what
unlocks `GET /api/__test__/last-otp`. Without that variable the endpoint is not
mounted at all.

## Test-only endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/__test__/health` | Confirms hooks are live before a run starts |
| `GET /api/__test__/last-otp?phone=…` | Returns the plaintext OTP just issued |

OTPs are bcrypt-hashed at rest (`server/src/lib/otp.ts`), so there is no read
path from the database — the hook keeps an in-memory, 50-entry, 5-minute
buffer that is only ever populated when `E2E_TEST_HOOKS=1` **and**
`NODE_ENV !== 'production'`. Both conditions are re-checked on every request;
production hard-refuses to mount the router even if the variable is set.
