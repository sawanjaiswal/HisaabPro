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
| C — Login & session | `e2e/gold/auth.spec.ts` | 10 | 9 | 1 | 0 |
| A — App shell | `e2e/gold/shell.spec.ts` | 8 | 7 | 0 | 1 |

Remaining suites (parties, products, invoices, GST, import, payments,
reports, settings) are not written yet.

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

Covered by TC-AUTH-06 (real UI logout) and a unit test that pins the client's
list to the server's.

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
- **TC-AUTH-05 flake:** the silent-refresh case failed once and passed on every
  rerun, including in isolation. Watch it; if it recurs, suspect refresh-token
  rotation racing two concurrent boot requests.
- `documents.test.ts > POST / creates document with 201 (owner)` fails on the
  server unit suite. Verified pre-existing on HEAD via `git stash` — unrelated
  to this work.
