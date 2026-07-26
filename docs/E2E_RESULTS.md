# E2E Results — gold-standard suites

Running log of `e2e/gold/**` execution against a **real** server and a real
Postgres (`npm run e2e:seed`, `E2E_TEST_HOOKS=1`). No `page.route` mocking: a
green case here means the product actually did the thing.

Plan: `docs/E2E_TEST_PLAN.md`. Command: `npx playwright test e2e/gold/<spec> --project=mobile`.

Last run: 2026-07-26.

---

## Status by suite

| Suite | Spec | Cases | Pass | Fail | Skip |
|---|---|---|---|---|---|
| B — Registration & OTP | `e2e/gold/registration.spec.ts` | 13 | 13 | 0 | 0 |
| C — Login & session | `e2e/gold/auth.spec.ts` | 11 | 9 | 2 | 0 |
| A — App shell | `e2e/gold/shell.spec.ts` | 8 | 7 | 0 | 1 |
| H — Parties (CRUD) | `e2e/gold/parties.spec.ts` | 5 | 5 | 0 | 0 |
| H — Parties (list, GSTIN, offline) | `e2e/gold/parties-list.spec.ts` | 6 | 6 | 0 | 0 |
| I — Products (create, GST fields, edit/delete) | `e2e/gold/products.spec.ts` | 5 | 5 | 0 | 0 |
| I — Products (stock, low stock, barcode, paging) | `e2e/gold/products-stock.spec.ts` | 5 | 5 | 0 | 0 |

TC-PTY-09 (party statement: opening + transactions − payments = closing) is
planned but not written. Remaining suites (products, invoices, GST, import,
payments, reports, settings) are not written yet.

---

## Open findings

Ranked by launch risk. Each one is reproduced by a spec unless marked manual.

### F1 — `VITE_AUTH_MODE` is unset, so a production build wires sign-in to a disabled route — **BLOCKER**

`src/config/app.config.ts` falls back to `AUTH_MODE = 'dev-login'` when
`VITE_AUTH_MODE` is absent, and it is absent from `.env`, `.env.production` and
`.env.example`. The login form then posts `/api/auth/dev-login`, which the
server refuses unless `ALLOW_DEV_LOGIN=true`. Nobody can sign in.

Fails closed, so it cannot leak — but it is a hard launch blocker. Fix is one
line in `.env.production` (`VITE_AUTH_MODE=otp`) plus a default flip so an
unset variable never means "dev".

The E2E web server forces `VITE_AUTH_MODE: 'otp'` (`playwright.config.ts`) —
otherwise the whole suite would exercise a route production disables.

### F2 — `/api/auth/login` enumerates accounts — **HIGH**, unfixed

TC-AUTH-02 (`e2e/gold/auth.spec.ts`) — failing, deliberately.

| Input | Response |
|---|---|
| Unknown phone + any password | "No account found with this phone or email." |
| Known phone + wrong password | "Invalid phone/email or password." |

Statuses match; the messages do not. An attacker walks a number range and
harvests a list of real customers before spending a single guess on a password.
For an app whose usernames *are* phone numbers, that list has direct resale
value.

Not fixed here: `server/src/services/auth.service.ts` is a high-risk path
(`~/.claude/rules/HIGH_RISK_PATHS.md`) and needs an approved design plan with
`architect` + `security` before edit. The fix itself is small — one message for
both branches, with the timing already equalised by the password hash compare.

### F3 — Logout did not end the server session — **FIXED** (`5b639b62`)

The Logout button returned the user to `/login` while `at`/`rt` stayed valid and
`/api/auth/me` kept returning 200. `POST /api/auth/logout` was 403ing on
CSRF_FAILED and `src/lib/auth.ts` swallowed it.

Root cause: `needsCsrf()` exempted the whole `/auth/` prefix while the server
exempts an explicit list of *unauthenticated* auth routes. `/auth/logout` and
`/auth/switch-business` are authenticated. Business switching was broken
outright for the same reason.

Fixed by deleting the client's list rather than correcting it: the client now
sends `X-CSRF-Token` on every mutation and lets the server decide which routes
skip the check. Covered by TC-AUTH-06 (real UI logout) and unit tests that keep
the list absent (`src/lib/__tests__/api-csrf-paths.test.ts`).

### F4 — A dead session stranded the user on a broken dashboard — **FIXED** (`b50ca0ce`)

With the session revoked server-side, the app kept the cached user, stayed on
`/dashboard` and rendered "Couldn't load dashboard — check your connection". No
data leaked (every scoped call 401s), but there was no route back to login.

Root cause: the boot catch in `AuthContext` treated a 401 the same as a network
error. It now clears auth on 401 only; offline and 5xx still keep the cached
session. Covered by TC-AUTH-06b plus unit tests for all three error shapes.

### F5 — An optional widget chunk could blank the entire app — **FIXED** (`0fc7419a`)

A failed dynamic import of the calculator overlay replaced the whole shell —
nav, page, toasts — with "Something went wrong". Reachable in production by a
stale tab after a deploy, not just offline. The floating widgets now sit behind
their own ErrorBoundary with a null fallback. Covered by TC-SHELL-06b.

### F6 — One shared rate-limit bucket logged active users out — **FIXED** (`77062683`)

Every IP-keyed limiter derived the key `rl:<ip>`, so the global (600/min), auth
(20/min) and OTP (3/10min) limiters incremented and read one counter while each
compared it to its own max. 25 ordinary GETs were enough to 429 the next
`/api/auth/refresh`. Each limiter now owns a namespaced bucket.

### F12 — Tokens issued in the same second are identical, so concurrent logins 409 — **HIGH**, unfixed

TC-AUTH-11 (`e2e/gold/auth.spec.ts`) — failing, deliberately.

`generateTokens` (`server/src/lib/jwt.ts:31`) signs `{userId, phone, businessId,
type}` with nothing unique in the payload. JWT `iat`/`exp` are second-granular,
so two tokens minted for the same user in the same second are **byte-identical**
— and `RefreshToken.token` is `@unique`.

Reproduced with four concurrent logins:

```
p1:409  p2:409  p3:200  p4:409
{"success":false,"error":{"code":"DUPLICATE_ENTRY","message":"token already exists"}}
```

Three consequences, in rising order of severity:

1. **Sign-in fails outright** when two sessions start together — the counter
   phone and the back-office browser, or a double-tap on a slow connection. The
   user sees a raw "token already exists".
2. **Forced logout.** If the colliding token matches a row that was already
   rotated, `refreshAccessToken` reads `revokedAt && replacedBy` and calls it
   reuse-detection, which revokes the **entire family** and fires a Sentry
   security warning. This is what made TC-AUTH-05 (silent refresh) fail
   intermittently — roughly 1 run in 3 — and it is not a test flake.
3. **Cross-device logout.** Access tokens collide the same way, and
   `blacklistToken` is keyed by the token string, so logging out on one device
   can blacklist another device's still-valid access token.

Fix is small — a `jti: randomUUID()` in both payloads — but `server/src/lib/jwt.ts`
is a declared high-risk path (`~/.claude/rules/HIGH_RISK_PATHS.md`), so it needs
the `architect` + `security` design plan before the edit. Deliberately not
touched here.

### F13 — The parties list stopped at 20 with no way to reach the rest — **FIXED** (`618dcc11`)

TC-PTY-07. `useParties` kept a page number in local state and replaced the data
on change, so the 20-per-page default *was* the list. Priya (2-5 staff) and Amit
(5-20 staff) both cross 20 parties in their first week; every party past the
20th was reachable only by knowing its name and searching for it. Ported to
`useInfiniteQuery` with a Load more control, and taught `party-cache` both cache
shapes so optimistic create/delete still reconcile.

### F14 — A party with a valid GSTIN could not be saved at all — **FIXED** (`618dcc11`)

TC-PTY-10. `handleSubmit` spread the whole form into `createParty`, and the form
carries the display-only verification state (`gstinVerified`, `gstinLegalName`,
`gstinStatus`) that the `.strict()` server schema rejects:

```
POST /api/parties → 400
"Unrecognized key(s) in object: 'gstinVerified', 'gstinLegalName', 'gstinStatus'"
```

Save appeared to do nothing. Every B2B customer — the only ones with a GSTIN,
and the only ones whose invoices carry input tax credit — was unaddable through
the UI. The same class had already been fixed inline on the *edit* branch of the
same function; there was no shared mapper, so create kept the bug. Now one
`party.payload.ts` owns the field set per direction.

**Follow-up, not fixed:** nothing on the server ever writes `Party.gstinVerified`,
so the "Verified" badge on a saved party can never render. Persisting
verification is a server feature, logged separately.

### F15 — Offline replays were dead-lettered on arrival — **FIXED** (`618dcc11`)

TC-PTY-11. `processQueue` built its own header set (Content-Type + idempotency
key), omitting the CSRF token (403) and the replay nonce/timestamp (400). Both
are 4xx, which the processor treats as non-retryable, so every queued mutation
went straight to `dead` the moment the network returned. Replays now go through
`buildRequestHeaders` — the same builder the live client uses.

### F16 — The offline queue never drained after a save-and-navigate — **FIXED** (`618dcc11`)

TC-PTY-11, found immediately behind F15. The only caller of `processQueue` was
an offline→online *edge* observed by `useSyncQueue`, which lives in
`<SyncStatusIcon>` in the header. Saving offline navigates, the header unmounts,
the reconnect fires with nobody listening, and the remounted hook seeds its
"previous" value with the already-online state — so the edge is never seen
again. Instrumented run: the item sat `pending`, unattempted, for the full
window.

Combined with F15 this meant **offline mode did not work at all**: the app's
headline promise for 2G shops. The drain is now level-triggered ("online AND
work pending") and owned by `src/lib/offline.autosync.ts`, started once at boot.
That also covers an item enqueued while the heartbeat still reads online, which
had no edge coming at all.

### F17 — A deleted product stayed in the products list forever — **FIXED**

TC-PRD-04. `deleteProduct` is a soft delete (`status: 'INACTIVE'`), but
`listProducts` applied a status filter only when the caller sent one, and the
client sends none. So Delete looked like a no-op: the row came back on the next
list, and the same response's `summary` — which counts ACTIVE only — disagreed
with the rows beside it, `pagination.total` agreeing with neither.

Root cause: the list had no default scope, so the caller's silence meant "show
everything, including rows the user deleted". Fixed at the schema
(`listProductsSchema.status` now defaults to `ACTIVE`) with an explicit `ALL`
value added to `shared/enums.ts` for the filter drawer's "All" option — one rule,
applied to every caller of the endpoint (list page, POS picker, invoice line
lookup, import dedup), not just the products page.
Trace: `.claude/fix-trace-deleted-product-still-listed.md`.

### F18 — The server test suites truncated the E2E database — **FIXED** (infra)

Not a product bug, but it produced a convincing fake one: after running
`npm run test:integration`, every gold spec failed at login with "No account
found with this phone or email." Both `vitest.integration.config.ts` and
`vitest.shadow.config.ts` pointed at `hisaabpro_test` — the same database
`scripts/e2e/db-url.mjs` declares as the Playwright database — and the
integration `setup.ts` TRUNCATEs every table between files, deleting the seeded
owner. The server suites now own `hisaabpro_integ_test`
(`INTEGRATION_DATABASE_URL` overrides), so the two suites can no longer delete
each other's fixtures.

### F19 — Products past page 20 were unreachable — **FIXED**

`useProducts` was a single-page `useQuery` keyed on `filters.page`, and no UI
ever called `setPage` — so a catalogue with 21 products showed 20, forever, with
no control to reach the rest. For a shop, invisible inventory is a stock count
that stops matching reality.

Root cause: `src/features/products/useProducts.ts:47`. Fixed by moving the list
to `useInfiniteQuery` (the same idiom the parties list already used) and
extracting the pager the parties list had built for itself into a shared
`<ListLoadMore>` — `PartyListLoadMore` was deleted rather than duplicated, so
there is one pager component, not two that drift.
Trace: `.claude/fix-trace-products-list-capped.md`. Test: TC-PRD-10.

### F20 — `GET /api/marketing/opt-outs` did not exist — **FIXED**

Every parties-list render fired a 404, and the marketing opt-out page could
never list anyone: the client shipped a reader for an endpoint that was only
ever built write-side (`POST /opt-out` flips the flag; nothing read it back).

Root cause: `server/src/routes/marketing/segments.ts` — no GET route. Fixed by
adding `listOptOutParties()` to the existing marketing-optout service (the SSOT
for that flag) and exposing it cursor-paginated, ordered
`[marketingOptOutAt desc, id desc]` so rows opted out before the timestamp was
recorded still page stably. The response field is `optOuts`, which removes the
`data.data` shape the client had assumed.
Trace: `.claude/fix-trace-marketing-optouts-404.md`. Caught by TC-PTY-01.

### F7 — No language switch before login — **MEDIUM**, unfixed

`setLanguage` is reachable only from `/settings`, which is behind the auth wall.
A Hindi-first shop owner meets an English-only registration and login flow —
the exact moment the app most needs to be readable. TC-SHELL-05 tests the toggle
where it actually lives and records this gap rather than asserting a screen that
does not exist.

### F8 — The intended path is lost across login — **MEDIUM**, unfixed

`ProtectedRoute` redirects with `<Navigate replace />` and no location state, so
a deep link (a WhatsApp invoice link, a bookmark) always lands on the dashboard
after sign-in and the user has to navigate manually. TC-SHELL-02b pins the
behaviour that exists instead of asserting a false green.

### F9 — Hardcoded English in `OfflineBanner` — **LOW**, unfixed

`src/components/feedback/OfflineBanner.tsx:32` renders "You're offline" /
"Changes saved locally" as literals, against rule A of
`.claude/rules/PAGE_AUDIT_CHECKLIST.md`. The banner is precisely what a 2G user
sees most.

### F10 — OTP digit inputs have no accessible name — **LOW**, unfixed

The six boxes carry only a class (`.auth-otp__digit`) — no `id`, `name`, `label`
or `aria-label`. Specs select them by class for that reason. Violates rule L of
the page-audit checklist.

### F11 — `validate(logoutSchema)` rejects an absent body — **LOW**, unfixed

Every field on the schema is optional, but `POST /api/auth/logout` with no body
returns 400 `": Required"`. Harmless from the app (it sends a body) and noisy for
any other client.

---

## Environment gaps (not product defects)

- **TC-SHELL-06 (offline cold boot)** skips under `vite dev`: `src/lib/sw-register.ts`
  deliberately unregisters the service worker in dev, so there is nothing to
  serve an offline boot. It runs unchanged against a `vite preview` build.
- **TC-SHELL-03** (3G paint budget), **TC-SHELL-04** (Capacitor status-bar
  overlap), **TC-AUTH-07/08/09** (session revoke across devices, PIN gate,
  WebAuthn) stay manual — they need a throttled Lighthouse run, a signed build
  on a device, or a platform authenticator.
- `documents.test.ts > POST / creates document with 201 (owner)` fails on the
  server unit suite. Verified pre-existing on HEAD via `git stash` — unrelated
  to this work.
