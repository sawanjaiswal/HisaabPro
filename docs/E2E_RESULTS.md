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
| J — Invoices (create, discounts, totals, validation) | `e2e/gold/invoices.spec.ts` | 5 | 5 | 0 | 0 |
| J — Invoices (draft, edit, delete, payment, stock) | `e2e/gold/invoices-lifecycle.spec.ts` | 5 | 5 | 0 | 0 |
| K — GST invoicing (split, rates, inclusive, RCM, UI, composition) | `e2e/gold/gst-invoicing.spec.ts` | 11 | 11 | 0 | 0 |
| K — GST returns & tax reports (return side) | `e2e/gold/gst-returns.spec.ts` | 12 | 12 | 0 | 0 |
| L — Payments, allocation & outstanding | `e2e/gold/payments.spec.ts` | 10 | 10 | 0 | 0 |
| K — GST backfill | `e2e/gold/gst-backfill.spec.ts` | 5 | 5 | 0 | 0 |
| F — Data import (upload → preview → commit) | `e2e/gold/import.spec.ts` | 6 | 6 | 0 | 0 |
| D — Onboarding wizard | `e2e/gold/onboarding.spec.ts` | 8 | 8 | 0 | 0 |

TC-PTY-09 (party statement: opening + transactions − payments = closing) is
planned but not written. Suite K's invoice half covers TC-GST-01..08 (08 is the
browser case: a GST-registered seller sees the tax on New Invoice and the grand
total includes it) plus TC-GST-17..19, the composition scheme — a composition
dealer is refused a tax category and an inter-state sale, and its Bill of Supply
saves with zero on every head. Suite K's return half (`TC-GSTR-01..12`) covers
tax-summary windowing, drafts and deleted documents excluded, credit notes
reducing liability, HSN summary, GSTR-1 B2B, the stored return, GSTR-3B outward
tax and ITC for both intra- and inter-state supply, and filing readiness. Suite L
covers receipts, part payments, advances, every payment mode, delete reversal,
and the three refusals an allocation must produce. GST backfill (`TC-GSTBF-01..05`) covers the read-only preview, the
three refusals, one real run asserting the stored parts still sum to the stored
grand total, key replay, and the hourly limit. Note for the record: the backfill
tags untagged **products** but deliberately leaves existing document line items
alone, so a bill already given to a customer keeps the total it was issued with.
Remaining suites (import, reports, settings,
offline, responsive/a11y, security) are not written yet.

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

### F21 — Search-dropdown results were not tappable — **HIGH**, FIXED

Every direct child of `.stagger-enter` runs a transform entrance animation, which
makes each section its own stacking context; the dropdown's z-index only ordered
it against its own siblings, so the section it overhung painted on top and taps
on a result hit the accordion below. Fixed by raising the hosting section (only
while a dropdown is open) via `:has()` in the two search stylesheets — the only
layer that can order against the following sections.
Trace: `.claude/fix-trace-stagger-stacking-context.md`. Caught by TC-INV-02.

### F22 — Every invoice save from a non-GST business returned 400 — **BLOCKER**, FIXED

The line schema typed `taxCategoryId` / `hsnCode` / `sacCode` as optional
strings, but "untagged" is a real state: the columns are nullable, the form holds
`null`, and the builder persists `?? null`. `POST /api/documents` answered
`taxCategoryId: Expected string, received null` — no invoice could be created on
a business with GST off (the default for the seeded business). Fields made
nullable, service types widened.
Trace: `.claude/fix-trace-null-tax-category-400.md`. Caught by TC-INV-01.

### F23 — A 10% discount saved as 0.1% — **BLOCKER**, FIXED

The form holds percent (10 = 10%); the columns hold basis points, the same units
POS checkout and coupons write. Nothing converted at the crossing, so the stored
invoice total exceeded the total the seller approved on screen.
`src/features/invoices/invoice-discount-units.ts` now owns the crossing in both
directions (derived from `PAISE_BASIS_POINTS`), applied on save and on edit
hydration.
Trace: `.claude/fix-trace-discount-percent-units.md`. Caught by TC-INV-02.

### F24 — The line discount was subtracted twice on screen — **BLOCKER**, FIXED

`calculateSubtotal` already nets per-line discounts off (matching the server's
`subtotal` contract), but its result was fed to `calculateGrandTotal`, which
subtracts the discount again. A ₹675 line with a ₹75 discount showed ₹600 while
the server stored ₹675 — every discounted invoice under-collected at the point of
sale. The gross figure now goes to the grand-total helper, and the totals bar
shows the gross on the subtotal row so the breakdown reconciles. Two stale unit
expectations had encoded the bug; corrected, plus an invariant case.
Trace: `.claude/fix-trace-discount-subtracted-twice.md`. Caught by TC-INV-02.

### F25 — Preview opened on an invalid invoice — **LOW**, FIXED

"Preview Invoice" bypassed validation, so an empty invoice rendered a ₹0.00
preview with a live "Save & Send" button that only led to a rejected save the
seller had to decode. Preview now runs the same checks as save.
Caught by TC-INV-15.

### F26 — A deleted invoice kept billing the customer — **BLOCKER**, FIXED

Delete wrote `status: 'DELETED'` but never `isDeleted: true`, while `Document`
is registered in `SOFT_DELETE_MODELS` — so every reader without its own status
predicate (party ledger, public invoice view, share links, quota counts) still
returned the row. A cancelled sale stayed on the customer's statement and kept
demanding money. `isDeleted` is now the fact that delete writes and restore
clears, and the five recycle-bin queries carry the extension's documented
explicit-`isDeleted` bypass.
Trace: `.claude/fix-trace-deleted-invoice-still-in-ledger.md`. Caught by TC-INV-07.

### F27 — Every GST invoice stored zero tax — **BLOCKER**, FIXED

The invoice form posts `taxCategoryId` and nothing else, but the server read the
rate from an optional `gstRate` field in the request body that no client sends.
The UI rendered its GST summary from the category's own rate, so the bill on
screen and the bill in the database disagreed by the whole tax. The rate is now
resolved from the category inside `buildCalcItems` — a server-owned fact, since a
client that could state the rate could bill 0% on taxable goods. The update path
had a drifted copy of that mapping (no INCLUSIVE back-calculation) and now calls
the same builder.
Trace: `.claude/fix-trace-gst-rate-never-applied.md`. Caught by TC-GST-02.

### F28 — A reverse-charge invoice could not be saved at all — **BLOCKER**, FIXED

RCM zeroed the tax heads after the totals were computed, leaving `grandTotal`,
`roundOff` and profit carrying tax the supplier never collects; the GL entry came
out unbalanced (debit 118000 ≠ credit 100000) and the save was rejected. The rule
now runs inside `calculateDocumentTotals` before `preRound`, through the
`isReverseCharge` option the type already declared and nothing read. Line-level
tax amounts stay populated — GSTR-1 reports an RCM supply with its rate and
taxable value.
Trace: `.claude/fix-trace-rcm-grandtotal-still-taxed.md`. Caught by TC-GST-06.

### F29 — A GST-registered seller saw no GST at all on New Invoice — **BLOCKER**, FIXED

Four causes stacked on one screen: the GST card's gate never fetched settings;
`getGstSettings` typed the wire body (`{ settings }`) as the settings themselves,
so `gstEnabled` read `undefined` app-wide; the product pickers passed positional
arguments and dropped the product's `taxCategoryId`, leaving every line untaxed;
and the client totals never added tax, so the bar quoted the pre-tax amount while
the server stored the taxed one. Each fixed at its own SSOT — the gate owns its
fetch, the service unwraps the envelope, pickers emit one `ProductPick` object,
and `calculateInvoiceTotals` takes `totalTax` and rounds off the taxed figure.
Trace: `.claude/fix-trace-gst-ui-never-loads.md`. Caught by TC-GST-08.

### F30 — Every inter-state supply vanished from GSTR-3B — **BLOCKER**, FIXED

`fetchAggregates` expressed "this document carries GST" as `totalCgst > 0`. The
split is state-dependent, so an inter-state document (IGST only) matched neither
the taxable rows nor the nil-rated ones and fell out of 3B entirely: outward
IGST was never declared, and IGST paid on inter-state purchases was never claimed
as input credit — the business pays that tax twice and under-declares its
liability. "Taxed" is now any non-zero head, with the nil-rated bucket its exact
complement.
Trace: `.claude/fix-trace-gstr3b-igst-dropped.md`. Caught by TC-GSTR-11/12.

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

### F31 — A customer's advance showed as a debt of the same size — **BLOCKER**, FIXED

`Party.outstandingBalance` is signed: positive is a receivable, negative means
the shop is holding the customer's money. Both outstanding endpoints returned
`Math.abs(...)`, so an advance of Rs 2,500 rendered as Rs 2,500 *owed*. The
shopkeeper asks for money already paid, and the receivables total is overstated
by twice the advance.

The client types made it worse in the other direction: `OutstandingPartyDetail`
declared `advanceBalance` and `aging` as required fields the server never sends,
which is how `undefined` reaches a formatter as `Rs NaN`.

Root: `server/src/services/payment/outstanding.ts` — the sign is now kept and the
direction comes from a shared `outstandingDirection()` helper.
Caught by TC-PAY-03. Fixed in `6712efa7`.

### F32 — An invoice could be paid past its total, and a rewrite could reach another tenant's invoice — **BLOCKER**, FIXED

Allocation validation was written inline at two call sites. `createPayment`
checked that the allocations fit the payment and that the invoices existed, but
never that an allocation fit the invoice's own `balanceDue` — so an
over-allocation drove `balanceDue` negative, which then subtracts from every
receivables total that sums it. `updateAllocations` repeated the check and
dropped the ownership half entirely: the invoice id came off the wire straight
into `tx.document.update({ where: { id } })`, so a guessed id posted one
business's money onto another's ledger.

Root: `server/src/services/payment/create.ts` — both paths now call one
`assertAllocationsPayable` guard (fits the payment, belongs to this business,
does not exceed what is due). The update path passes its existing allocations as
capacity, since those rows are reversed before the new ones land.
Caught by TC-PAY-07, TC-PAY-09, TC-PAY-10. Fixed in `39b7df2d`.

### F33 — A typo'd backfill locked the wizard for an hour — FIXED

`/api/gst/backfill/execute` allows one run per hour per business+user. The rate
limiter was ordered ahead of body validation and the tax-category ownership
check, so a request the server was always going to refuse with a 400 still spent
the quota: a shopkeeper who picked the wrong tax category could not run the
backfill again until the hour was up. The route already applies the right rule to
the Idempotency-Key header ("must run before the rate limiter so invalid requests
don't consume quota") — the tax-category check simply could not follow it while
it lived inside the handler.

Root: `server/src/routes/gst-backfill.route.ts` — the check is now a middleware,
ordered with the other refusals ahead of the limiter.
Caught by TC-GSTBF-03 followed by TC-GSTBF-04. Fixed in `631ebbfc`.

### F34 — Every import commit died on the advisory lock — **BLOCKER**, FIXED

`pg_advisory_xact_lock` has a `(bigint)` and an `(int4,int4)` overload, never
`(bigint,bigint)`. Widening both arguments to `hashtextextended` aborted the
transaction with 42883 before a single row was written, so no import could ever
commit. The namespace now folds into the hashed text — full 64-bit key, keys
still disjoint.
Root: `server/src/services/import/commit.helpers.ts:60`. Fixed in `911f43a1`.

### F35 — The commit's four-field bind could never be satisfied — **BLOCKER**, FIXED

`ImportJob.idempotencyKey` was written nowhere, so the M3 equality check always
failed with 409 BAD_COMMIT_TOKEN. Carrying the upload's key forward is not an
option: `idempotencyCheck` keys its replay log by (key, user) alone, so a commit
re-presenting the upload's key is answered with the cached *upload* response.
The commit claims its own key inside the same transaction; the bind accepts an
unclaimed job.
Root: `server/src/services/import/commit.helpers.ts:110`. Fixed in `911f43a1`.

### F36 — Imported parties carried a phone shape nothing else could read — **BLOCKER**, FIXED

The normalizer wrote E.164 while every other writer of `Party.phone` stores bare
10 digits. Exact-dedup compared against `Party.phone` and therefore never matched
an existing customer, and an imported party failed the update schema on the way
back in. `lib/party-phone.ts` is now the one definition and the field is named
`phone` so the shape cannot drift again.
Root: `server/src/services/import/normalizers/party-normalizer.ts:71`. Fixed in `911f43a1`.

### F37 — All three parsers dropped nameless rows before the preview saw them — **BLOCKER**, FIXED

Counts are the shopkeeper's only reconciliation: "498 imported" against a file
they believe holds 500 is a customer who quietly does not exist. Row validity is
now judged only by the normalizer (which already flags `MISSING_NAME`); genuine
non-party filters (Vyapar `Type`, Tally ledger group) stay.
Root: `server/src/services/import/parsers/vyapar-csv.parser.ts:88`. Fixed in `911f43a1`.

### F38 — A duplicate was staged as new, and the create aborted the whole file — **BLOCKER**, FIXED

`classifyRow` judged a row from its issues alone and ignored the dedup result, so
a customer the shop already had was created a second time and the
`(businessId, phone)` unique index took the entire commit down with it — losing
every other row in the file. Status is now the single place a row's fate is
decided, duplicates *within* one file are detected too, and unresolved duplicates
count as skipped so committed + skipped + errors reconciles to the row count.
This also unblocks SKIP / OVERWRITE / CREATE_NEW, which were unreachable: they
only accept `DUPLICATE_*` rows and no row was ever in that status.
Root: `server/src/services/import/party-parse.helper.ts:34`. Fixed in `911f43a1`.

### F39 — The wizard could not complete an upload from the UI — **BLOCKER**, FIXED

Four client/server contract drifts, none visible to the compiler because
`api<T>()` asserts its type parameter instead of checking it: `CreateImportRes`
described a flat `{jobId}` envelope the route has never returned (every upload
navigated to `/imports/undefined`); `ImportFormat` was lowercase against a
`.strict()` uppercase server enum; the idempotency key went out as
`Idempotency-Key`, which the middleware ignores, so a double submit is processed
twice instead of replayed; and `clientVersion` was appended to the FormData —
rejected by `.strict()` — while `requireMinClientVersion` reads the
`X-Client-Version` **header**, missing on every request. In production that last
one is a 426 on all five import routes: the feature would have been unreachable
from the app even with the flag on.

`error-csv` drops the version gate instead. It is fetched by a top-level browser
navigation, which cannot carry a custom header, so the gate would 426 every
download from every client. The gate stops stale clients replaying COMMITs; a
read-only CSV of the job's own error rows carries no such risk, and auth + owner
+ feature still apply.
Root: `src/features/import/types/import.types.ts` + `services/import.service.ts`.
Caught by TC-IMP-06. Fixed in `98870c7c`.

### F40 — Import ships disabled unless two flags are set — **BLOCKER (release config)**

`requireFeature('DATA_IMPORT')` defaults OFF server-side and the wizard is behind
`VITE_FEATURE_DATA_IMPORT` client-side. Production must set **both**
`FEATURE_DATA_IMPORT=true` (plus `FEATURE_DATA_IMPORT_COHORT_PCT=100` for a full
rollout) and `VITE_FEATURE_DATA_IMPORT=true`, or "import your customers from
Excel" silently does not exist for anyone. This is why none of F34–F39 had ever
been hit by a user: nobody could reach the path.

### F41 — A shopkeeper finished onboarding holding a session with no business — **BLOCKER**, FIXED

Every business-scoped route reads `businessId` off the JWT, and this user's token
was minted at registration — before their business existed. Creating the first
business updated the database and `/auth/me`, but nothing re-issued the token, so
the dashboard the wizard hands them to answered `403 NO_BUSINESS` on every call
until they logged out and back in. `POST /auth/switch-business` is the one
endpoint that re-mints the token (blacklists the old one, rotates cookies) and the
business switcher already used it; onboarding now goes through the same path.
Root: `src/features/onboarding/useOnboarding.ts` — `onSuccess` refreshed React
state only. Caught by TC-ONB-01/03/04 (`GET /businesses/:id` → 403 "Business
mismatch"). Trace: `.claude/fix-trace-onboarding-session-and-answers.md`.

### F42 — The wizard asked for the shop's location and threw it away — FIXED

`businessLocation` was collected on step 2 and left out of the create payload,
though `createBusinessSchema` accepts `city` and the invoice header prints it.
Asking and discarding is worse than not asking: the shopkeeper believes it is on
file. Same call also ignored `startPath` — a user who chose the *recommended*
"import my existing data" was dropped on an empty dashboard with no hint the
importer exists; they now land on `/imports`. Caught by TC-ONB-04/05.

### F43 — An interrupted setup lost every answer — FIXED

The wizard's step and fields lived in component `useState`, so a reload, a back
gesture, or an Android low-memory kill restarted setup at the welcome screen with
the fields blank — on the one form a shopkeeper cannot skip, minutes into an app
they do not trust yet. Fixed at the pattern level: `createSessionDraft` in
`src/lib/session-draft.ts` is now the single storage contract for multi-step form
drafts (sessionStorage per OFFLINE_RULES rule 4, best-effort, corrupt-payload
tolerant); onboarding and the campaign wizard both use it. `ready` is never
resumed (it asserts a server fact) and a successful create clears the draft, so
adding a second business starts blank. Honest limit: sessionStorage dies with the
tab, so a process kill still loses the draft. Caught by TC-ONB-07 and TC-ONB-01.

### F44 — `dataSource` is collected and has nowhere to go — OPEN (needs a schema epic)

Step 4 asks whether the shop keeps its books in a notebook / Excel / Tally / another
app, and `Business` has no column for the answer, so it is discarded. It is the
single most useful signal for what to offer next (an import template, a migration
nudge), and persisting it is a `prisma/schema.prisma` change — a high-risk path
that needs `/start-epic` before any edit. Recorded rather than silently patched.
