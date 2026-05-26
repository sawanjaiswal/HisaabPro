# ARCHITECTURE — Phase 5 Epic C: Customer-Facing
## Features #129 / #130 / #121 / #131

**Status:** DRAFT — 2026-05-14
**Companion:** `docs/SCOPE_EPIC_C_customer_facing.md`

## Revision history

- **2026-05-14** — Security-audit revisions incorporated (CONDITIONAL PASS → addressed): (1) hashed-token storage `tokenHash` replacing plaintext `token` column; (2) atomic `updateMany`-guarded claim transaction with 409 on count===0; (3) single `resolvePublicToken(req, expectedResource)` helper as the only entry point for `/api/p/*`; (4) explicit `Pick<>` allowlist sanitizers (no Prisma spread); (5) OTP confirmation mandatory for invite-claim against existing User; (6) reserved-slug const list + strict regex + unique-on-lowercase for storefront slugs.
- **2026-05-14** — Initial architecture draft.

---

## 1. Overview

Epic C ships a zero-login public surface mounted at `/p/*` (server) and `/p/*` (client SPA route gate) and four user-facing features that ride on it: UPI QR on invoice (PR2), web-share invoice link (PR3), online storefront (PR4), and party-invite portal (PR5). PR1 is the shared-infra PR: `SharedLink` model + opaque-token issuer/resolver + public Express router + rate limiter + `PublicShell` React layout + UPI deep-link util. PR2-PR5 are mergeable only after PR1 is green. Three migrations total (PR1, PR4, PR5); PR2 and PR3 are schema-free.

---

## 2. Schema changes (aggregated)

### PR1 — `SharedLink` (tokens hashed at rest — security A2)

```prisma
model SharedLink {
  id             String    @id @default(cuid())
  businessId     String
  resource       String    // "INVOICE" | "STORE" | "INVITE"
  resourceId     String    // documentId | businessId | partyId
  tokenHash      String    @unique  // sha256(opaqueToken) hex; plaintext NEVER stored
  expiresAt      DateTime?
  revokedAt      DateTime?
  claimedAt      DateTime?           // one-shot links (INVITE) — set atomically on consume
  createdBy      String    // userId who issued
  createdAt      DateTime  @default(now())
  lastAccessedAt DateTime?
  accessCount    Int       @default(0)

  business       Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([businessId, resource])
  @@index([tokenHash])
  @@index([businessId, resource, resourceId])
}
```

**No plaintext `token` column exists.** The 32-byte opaque token is generated at issue-time, the response returns it exactly once, and only `sha256(token)` is persisted. A DB dump cannot be replayed against the public router. Reverse relation on `Business`: `sharedLinks SharedLink[]`.

### PR4 — Storefront fields on `Business`

```prisma
storefrontSlug      String?  @unique    // null = store disabled / not configured; stored lowercase
storefrontIsPublic  Boolean  @default(false)
storefrontTagline   String?            // max 80 chars (Zod)
storefrontTheme     String   @default("LIGHT")  // "LIGHT" | "DARK"
storefrontWhatsapp  String?            // E.164 without +; falls back to Business.phone
```

`storefrontSlug` is stored already-lowercased; the validator (see §H Storefront slug rules) lowercases at write-time and the unique index then enforces case-insensitive uniqueness without needing a functional index.

`storefrontProducts` visibility lives on a new small join table to keep `Business` lean:

```prisma
model StorefrontProduct {
  id          String   @id @default(cuid())
  businessId  String
  productId   String
  priceVisible Boolean @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())

  business    Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([businessId, productId])
  @@index([businessId, sortOrder])
}
```

### PR5 — Party-to-User link

```prisma
// on Party
userId  String?  @unique
user    User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
```

Reverse on `User`: `linkedParties Party[]`.

**Important invariant (PR5):** `Party.userId` is `@unique` — at most ONE Party in the whole system can point at a given User. Open question #6 (multi-business supplier) is resolved in §13 by accepting this MVP limitation and adding a follow-up ticket for a `PartyBusinessUser` join model in Phase 6. The unique constraint blocks hijack — if Kamlesh signs up via Business A's invite, no other business's invite can re-bind his User; a separate party row stays unlinked until a future epic.

---

## 3. Migration sequence

All three migrations are **add-column-nullable only**. No backfills, no NOT-NULL tightening. Order does not matter across PRs (no FK between them), but within each PR a single migration:

| PR | Migration name | What |
|----|----------------|------|
| PR1 | `epic_c_shared_links` | Create `SharedLink` table (tokenHash unique, claimedAt nullable) |
| PR4 | `epic_c_storefront_fields` | Add 5 storefront cols on `Business`; create `StorefrontProduct` |
| PR5 | `epic_c_party_user_link` | Add `Party.userId` (nullable, unique) + FK |

No rollback dance. Per `.claude/rules/PRISMA_MIGRATION_RULES.md`: `npx prisma migrate dev --name <name>`; never `db push`. GST-style raw-SQL indexes not needed here.

---

## 4. Public route surface

`server/src/routes/public.routes.ts` mounts at `/api/p/*` BEFORE the global auth/CSRF stack runs. Mount order in `app.ts`:

```
helmet → cors → compression
→ public-router (mounted at /api/p, owns its own middleware stack)
→ express.json + cookieParser
→ apiRateLimiter → csrfProtection → sanitizeInput → fieldFilter ...
→ mountFeatureRoutes()
```

`public-router` middleware stack (in order):

1. `express.json({ limit: '256kb' })` — tighter than the global 2MB
2. `publicRateLimiter` — own bucket, per-route-group (see §5)
3. **`resolvePublicToken(req, expectedResource)`** helper invoked AS THE FIRST LINE of every `/invoice/:token`, `/invite/:token`, `/invite/:token/claim` handler (see §6). The middleware-style version simply wraps this call; handlers MAY call the helper directly when they need typed access to `{ link, resource }`.
4. Route handlers — never read cookies, never write cookies, never call `requireAuth`

Routes:

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/p/health` | Heartbeat | none |
| GET | `/api/p/invoice/:token` | Sanitized invoice payload | token |
| GET | `/api/p/store/:slug` | Storefront meta + products | slug |
| GET | `/api/p/store/:slug/products` | Paginated products (cursor) | slug |
| GET | `/api/p/invite/:token` | Invite preview (business name only) | token |
| POST | `/api/p/invite/:token/claim` | OTP-verified bind of Party.userId; consumes link | token + OTP |

CSRF is NOT applied to `/api/p/*` because there are no cookies and no auth context. The `POST /api/p/invite/:token/claim` endpoint is safe without CSRF because the token IS the credential — knowing the token already proves the caller has the invite link.

---

## 5. Rate limiter

Use the existing `RateLimitStore` interface from `server/src/middleware/rate-limit/store.ts`. The `MemoryStore` implementation is fine for MVP — HP runs single-instance on Render Starter (per memory/MEMORY.md). When/if HP scales to multi-instance, swap `MemoryStore` for a Redis-backed store via the existing pluggable interface — no public-route code change needed.

Buckets (separate keyspaces so an attacker hitting `/invoice/:token` can't starve `/store/:slug`):

| Key prefix | Window | Max |
|------------|--------|-----|
| `pub:health:<ip>` | 60s | 120 |
| `pub:invoice:<ip>` | 60s | 60 |
| `pub:store:<ip>` | 60s | 60 |
| `pub:invite:<ip>` | 60s | 30 |
| `pub:claim:<ip>` | 60s | 10 |

429 response: `{ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } }`.

Header IP source: `req.ip` (Express respects `trust proxy: 1` set in `app.ts`). Spoof-mitigation: only `X-Forwarded-For` from one hop trusted; documented as residual risk in §14.

Note: the per-request rate-limit increment is performed by `resolvePublicToken` AFTER hash lookup succeeds — see §6 — so a flood of garbage tokens still counts against the bucket. The bucket key is `(ip, route-group)`, NOT keyed on token, to avoid an enumeration oracle.

---

## 6. Token strategy — opaque token + hashed DB row + single resolver (security A2 / C2 / A5)

### 6.1 Token format

A 32-byte opaque random token (`crypto.randomBytes(32).toString('base64url')`, ~43 chars). The plaintext token is returned to the issuer **exactly once** in the API response that creates the SharedLink. Only `tokenHash = sha256(token)` is stored. There is no way to read the token back out of the DB.

### 6.2 Issuer pseudocode — `services/shared-link.service.ts`

```ts
import crypto from 'node:crypto'

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex')
}

export async function issueShareLink(args: {
  resource: 'INVOICE' | 'STORE' | 'INVITE'
  resourceId: string
  businessId: string
  createdBy: string
  expiresIn?: number  // seconds; null/undefined = no expiry
}): Promise<{ link: SharedLink; token: string /* PLAINTEXT — return once, never readable again */ }> {
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = sha256(token)
  const expiresAt = args.expiresIn
    ? new Date(Date.now() + args.expiresIn * 1000)
    : null
  const link = await prisma.sharedLink.create({
    data: {
      tokenHash,
      resource: args.resource,
      resourceId: args.resourceId,
      businessId: args.businessId,
      createdBy: args.createdBy,
      expiresAt,
    },
  })
  // Caller (the route handler) is responsible for handing `token` back in the
  // HTTP response body. After that single response the token is unrecoverable.
  return { link, token }
}
```

The owner-side `POST /api/documents/:id/share-links` response shape:

```json
{ "success": true, "data": {
    "id": "ckxxx...", "expiresAt": "...", "accessCount": 0,
    "shareUrl": "https://hisaabpro.in/p/invoice/<token>"   // contains plaintext, only on creation
} }
```

Subsequent `GET /api/documents/:id/share-links` responses return the row without `shareUrl` / token. Existing-link "copy URL" UX therefore offers "re-issue" rather than "show again".

### 6.3 Resolver — `resolvePublicToken(req, expectedResource)` (security C2)

Single entry point. ALL `/api/p/*` handlers that take a `:token` param invoke this helper as their first call. No handler may inline the hash lookup, the revoked check, the expired check, or the resource-type check — those four are the bug factory the audit flagged. Any handler doing so fails review.

```ts
// server/src/services/public-resolver.service.ts

export type PublicLinkErrorCode =
  | 'INVALID_TOKEN'      // 404 — hash not found
  | 'LINK_EXPIRED'       // 410
  | 'LINK_REVOKED'       // 410
  | 'LINK_CONSUMED'      // 410 — one-shot already claimed
  | 'WRONG_RESOURCE'     // 404 — token is for a different resource type; same shape as INVALID_TOKEN to the caller
  | 'RATE_LIMITED'       // 429

export class PublicLinkError extends Error {
  constructor(public code: PublicLinkErrorCode, public status: number) { super(code) }
}

export async function resolvePublicToken(
  req: Request,
  expectedResource: 'INVOICE' | 'STORE' | 'INVITE',
): Promise<{ link: SharedLink; resource: typeof expectedResource }> {
  const raw = String(req.params.token ?? '')
  if (!raw || raw.length < 16 || raw.length > 128) {
    throw new PublicLinkError('INVALID_TOKEN', 404)
  }
  const tokenHash = sha256(raw)

  // 1. Hash lookup — single indexed point query
  const link = await prisma.sharedLink.findUnique({ where: { tokenHash } })
  if (!link) throw new PublicLinkError('INVALID_TOKEN', 404)

  // 2. Resource type — return INVALID_TOKEN (not a distinct code) to avoid an
  //    enumeration oracle that says "this token exists but for something else"
  if (link.resource !== expectedResource) {
    throw new PublicLinkError('INVALID_TOKEN', 404)
  }

  // 3. Revoked
  if (link.revokedAt) throw new PublicLinkError('LINK_REVOKED', 410)

  // 4. Expired
  if (link.expiresAt && link.expiresAt < new Date()) {
    throw new PublicLinkError('LINK_EXPIRED', 410)
  }

  // 5. One-shot consumed (INVITE)
  if (link.claimedAt) throw new PublicLinkError('LINK_CONSUMED', 410)

  // 6. Rate-limit increment — keyed on (ip, route-group)
  await incrementPublicRateLimit(req.ip, routeGroupFor(expectedResource))

  // 7. Audit log — fire-and-forget
  prisma.sharedLink.update({
    where: { id: link.id },
    data: { lastAccessedAt: new Date(), accessCount: { increment: 1 } },
  }).catch((e) => logger.warn('sharedLink access bump failed', { id: link.id, err: e?.message }))
  auditPublicAccess({ linkId: link.id, ip: req.ip, ua: req.get('user-agent'), resource: expectedResource })

  return { link, resource: expectedResource }
}
```

Route handler pattern:

```ts
// server/src/routes/public/invoice.routes.ts
router.get('/invoice/:token', async (req, res, next) => {
  try {
    const { link } = await resolvePublicToken(req, 'INVOICE')
    const payload = await loadAndSanitizeInvoice(link)   // see §8 — Pick<>-based
    res.json({ success: true, data: payload })
  } catch (e) {
    if (e instanceof PublicLinkError) {
      return res.status(e.status).json({ success: false, error: { code: e.code } })
    }
    next(e)
  }
})
```

**HTTP status mapping** (deviates slightly from SCOPE — corrected here as the SSOT):

| Outcome | Status | Code |
|---------|--------|------|
| Active | 200 | — |
| Expired | 410 | `LINK_EXPIRED` |
| Revoked | 410 | `LINK_REVOKED` |
| One-shot already consumed | 410 | `LINK_CONSUMED` |
| Not found / wrong resource | 404 | `INVALID_TOKEN` |

Both expired and revoked return 410 (resource gone) — distinguished only by `error.code`. Wrong-resource and not-found both return `INVALID_TOKEN` so the response cannot be used as an oracle for "this token exists but for a different resource type".

### 6.4 Atomic claim path (security A5 / C3 / F3)

For INVITE links (one-shot consumption) we never read-then-write. The claim is a guarded `updateMany` whose `WHERE` clause includes every condition that must still be true at write-time. If `count === 0`, another request already won the race → return `409 ALREADY_CLAIMED`. The pattern is reused for any future one-shot link.

```ts
// server/src/services/party-invite.service.ts
export async function claimInvite(args: {
  token: string
  newUserId: string         // already-OTP-verified User (see §11)
}): Promise<{ partyId: string }> {
  const tokenHash = sha256(args.token)

  return prisma.$transaction(async (tx) => {
    // Atomic guarded mark — only succeeds if link is still INVITE/unclaimed/unrevoked/unexpired.
    const now = new Date()
    const marked = await tx.sharedLink.updateMany({
      where: {
        tokenHash,
        resource: 'INVITE',
        revokedAt: null,
        claimedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: { claimedAt: now, revokedAt: now },
    })
    if (marked.count === 0) {
      throw new PublicLinkError('LINK_CONSUMED', 409)  // includes "already claimed" race
    }

    const link = await tx.sharedLink.findUnique({ where: { tokenHash } })
    if (!link) throw new PublicLinkError('INVALID_TOKEN', 404)  // belt-and-braces

    // Atomic guarded bind — only succeeds if Party.userId is still null.
    const bound = await tx.party.updateMany({
      where: { id: link.resourceId, businessId: link.businessId, userId: null },
      data: { userId: args.newUserId },
    })
    if (bound.count === 0) {
      // Party was bound to a different user between resolve and claim.
      // Compensating: unset our claimedAt? — no. The link is single-use by design;
      // the race loser sees 409 and the owner must re-issue.
      throw new PublicLinkError('ALREADY_CLAIMED' as any, 409)
    }

    return { partyId: link.resourceId }
  })
}
```

Why `updateMany` and not `update` + `WHERE id = ?`: `update` throws on 0 rows AFTER an extra round-trip; `updateMany` returns a `count` directly and lets us encode all the "still-true" predicates in a single SQL statement. Postgres serializes concurrent `updateMany`s on the same row at the storage layer — at most one transaction observes `count: 1`. The other transactions observe `count: 0` and we map that to 409.

---

## 7. Public layout strategy

**Single bundle, route-gated shell.** Same `main.tsx`, same Vite entry. A top-level component (`src/AppRoot.tsx`) inspects `window.location.pathname`:

- starts with `/p/` → render `<PublicShell>` (logo header, no BottomNav, no `<AuthProvider>`, no `<BusinessProvider>`)
- everything else → render existing `<AppShell>`

Why single bundle:
- Zero Vercel/Render deploy complexity (one build, one CDN path)
- Kamlesh downloads ~200KB gz once; subsequent navigations are client-side
- Public pages are PR2-PR5 only — a separate Vite entry would mean a build-config fork that costs more than it saves at MVP scale

Public bundle size budget: ≤ 200KB gz at /p/invoice/:token first-load. Achieved by lazy-loading the QR component (`qrcode.react`, ~14KB gz) and code-splitting `<PublicShell>` from `<AppShell>` via `React.lazy`.

Language: `?lang=hi|en` query param read by `usePublicLang()` hook → writes to `localStorage('public-lang')` so a refresh keeps the choice. The existing `useLanguage()` hook is auth-coupled (reads user prefs) — we DO NOT refactor it; `<PublicShell>` ships its own narrow hook that only knows the query param + storage. Accept-Language header is NOT consulted (Open Q #5 resolved in §13).

---

## 8. Sanitization & PII (security E1 — Pick allowlists, no spread)

Two pure functions in `server/src/services/public-sanitize.service.ts`. **They MUST be implemented as explicit field-pick functions (`Pick<>` types with hand-written object construction). `...spread` of any Prisma model is forbidden.** A new field added to `Document` / `Business` / `Party` / `Product` is invisible to the public payload until someone explicitly adds it to the allowlist — that is the safety property.

### 8.1 `sanitizeInvoiceForPublic(doc, business, party)` — explicit allowlist

```ts
// Public DTO — the ONLY fields that leave the server for /p/invoice/:token
export type PublicInvoiceDto = {
  invoiceNo: string
  issuedAt: string                       // ISO; the only timestamp exposed
  dueDate: string | null
  partyName: string                      // from Party.name — no phone, no address, no GSTIN, no PAN
  businessName: string
  businessPhone: string | null           // Business.phone — already on the printed invoice
  businessUpi: string | null             // BusinessSettings.upiId (PR2)
  businessGstin: string | null           // already on the printed invoice (Open Q #1)
  lineItems: Array<{
    name: string
    qty: number
    unit: string | null
    rate: number                         // paise
    amount: number                       // paise
  }>
  subtotal: number                       // paise
  total: number                          // paise
  amountDue: number                      // paise
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE'
}

export function sanitizeInvoiceForPublic(
  doc: DocumentWithLineItems,
  business: Business,
  party: Party,
): PublicInvoiceDto {
  return {
    invoiceNo: doc.documentNumber,
    issuedAt: doc.issueDate.toISOString(),
    dueDate: doc.dueDate?.toISOString() ?? null,
    partyName: party.name,
    businessName: business.name,
    businessPhone: business.phone ?? null,
    businessUpi: business.settings?.upiId ?? null,
    businessGstin: business.gstin ?? null,
    lineItems: doc.lineItems.map((li) => ({
      name: li.name,
      qty: li.quantity,
      unit: li.unit ?? null,
      rate: li.rate,
      amount: li.amount,
    })),
    subtotal: doc.subtotal,
    total: doc.total,
    amountDue: doc.amountDue,
    status: doc.status,
  }
}
```

**Explicitly stripped** (lint-style checklist enforced by unit test that fuzzes every Prisma field): party `phone`, `email`, `address`, `gstin`, `pan`, `creditLimit`, `outstandingBalance`, `totalBusiness`, `notes`, `userId`, `createdAt`, `updatedAt`, `isDeleted`, `deletedAt`, `createdBy`, `updatedBy`; business `email`, `udyam`, `addressLine1/2`, `city`, `state`, `pincode`, `ownerName`, `bankDetails`, all settings except `upiId`; document internal `id`, `businessId`, `partyId`, all `*By` user ids, all cost / margin / profit fields, `createdAt` / `updatedAt` / `isDeleted` / `deletedAt`, line-item `id` / `productId` / `costPrice` / `taxRate` (if tax not on the printed invoice).

### 8.2 `sanitizeStorefrontForPublic(business, storefrontProducts)` — explicit allowlist

```ts
export type PublicStorefrontDto = {
  businessName: string
  tagline: string | null
  whatsappNumber: string | null    // E.164; falls back to business.phone
  theme: 'LIGHT' | 'DARK'
  products: Array<{
    id: string                     // needed for the WA deep-link text= param
    name: string
    unit: string | null
    price: number | null           // null if priceVisible=false
    // sku: omitted unless business.storefrontExposeSku === true (per E1; default false)
  }>
}

export function sanitizeStorefrontForPublic(
  business: Business,
  rows: Array<StorefrontProduct & { product: Product }>,
): PublicStorefrontDto {
  return {
    businessName: business.name,
    tagline: business.storefrontTagline ?? null,
    whatsappNumber: business.storefrontWhatsapp ?? business.phone ?? null,
    theme: business.storefrontTheme === 'DARK' ? 'DARK' : 'LIGHT',
    products: rows.map((r) => ({
      id: r.productId,
      name: r.product.name,
      unit: r.product.unit ?? null,
      price: r.priceVisible ? r.product.sellPrice : null,
    })),
  }
}
```

**Explicitly stripped:** business `email`, `gstin`, `udyam`, `address*`, `bankDetails`, `ownerName`, all settings; product `costPrice`, `stock`, `reorderLevel`, `hsn`, `supplierId`, `supplierName`, internal `sku` (unless the user opts in via `business.storefrontExposeSku`), `createdAt` / `updatedAt` / `isDeleted` / `deletedAt`.

Both sanitizers are pure (no `req` / `res`) and 100%-unit-tested with a "fuzz every field" test that asserts no non-allowlisted Prisma field ever appears in the output — see acceptance gate in §15.

---

## 9. UPI deep-link util (PR2)

Server util at `server/src/services/upi-link.service.ts`, FE mirror at `src/lib/upi.ts` (kept in sync via a single source-of-truth comment — both files ~30 LOC, manual sync is fine at this size).

```ts
export function buildUpiLink(args: {
  payeeVpa: string         // validated against /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/
  payeeName: string        // URL-encoded
  amountRupees?: number    // optional; <= 100000 (UPI hard limit, env-overridable)
  transactionNote?: string // <= 80 chars after encode
  transactionRef?: string  // invoice number, alnum + hyphen only
}): string
```

Output: `upi://pay?pa=...&pn=...&am=1200.00&tn=Invoice+INV-001&tr=INV-001&cu=INR`. Amounts always 2-decimal string (paise → rupees division done at the boundary). VPA validation throws `ValidationError` (server) / returns null (FE) so the QR card hides cleanly.

FE QR rendering: use `qrcode.react` (already in DH; if HP doesn't have it, add — 14KB gz, no native deps). Component: `<UpiPayCard />` in `src/features/invoices/components/upi-pay-card.tsx`.

PDF: explicitly NOT touched. React-PDF template stays QR-free. PR2 acceptance includes a screenshot proving the PDF output has no QR.

---

## 10. SharedLink revocation UX (PR3)

Owner-side endpoints (authenticated, mounted under `/api/documents` and `/api/shared-links`):

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/documents/:id/share-links` | List active+expired+revoked SharedLinks for one invoice; tenant-scoped; NEVER returns token or shareUrl |
| POST | `/api/documents/:id/share-links` | Issue new link `{ expiresIn: 7d/30d/90d/null }`; response includes `shareUrl` ONCE |
| PATCH | `/api/shared-links/:id` | `{ revokedAt: now }` — only `createdBy === req.userId` OR business-owner role |
| GET | `/api/businesses/me/share-links?resource=INVOICE&...` | Audit list for admin / owner; never includes plaintext |

All four enforce `businessId === req.businessId` (tenant scoping) in the service layer before any read/write. Authorization layer (revoke permission) reuses the existing role/permission system.

Client UX (PR3 share drawer):
- Expiry picker (radio): 7 days / 30 days (default) / 90 days / Never
- "Copy link" + "Share on WhatsApp" buttons — these consume the one-time `shareUrl` from the creation response and hold it in component state until the drawer closes; closing the drawer wipes it
- "Existing links" list: each row shows `createdAt`, `expiresAt`, `accessCount`, status pill + revoke button (confirms via small inline confirm — no separate dialog). Re-acquiring a URL for an existing link requires "Reissue" — which revokes the old row and issues a new one (new token, new hash, new URL)

---

## 11. State machine — Invite Claim flow (PR5, with OTP — security F2)

```
States:    UNCLAIMED | PREVIEW | OTP_REQUIRED | OTP_VERIFIED | CLAIMING | SUCCESS | FAILED
Initial:   UNCLAIMED (the token row in DB at issue time; tokenHash, claimedAt=null)
Terminal:  SUCCESS (Party.userId set, SharedLink.claimedAt=now, revokedAt=now)
           FAILED  (terminal — owner must issue a new invite)

Transitions:
  UNCLAIMED     --GET /p/invite/:token--> PREVIEW
                  (resolver returns business name + masked party phone; no PII beyond name)
  PREVIEW       --user taps "Continue"--> branches on phone match:
                  (a) party.phone matches NO existing User     → OTP_REQUIRED (new signup OTP)
                  (b) party.phone matches an existing User     → OTP_REQUIRED (login OTP to that user)
  OTP_REQUIRED  --POST /auth/otp/send {phone, purpose:'invite-claim', linkToken}--> OTP_REQUIRED
  OTP_REQUIRED  --POST /auth/otp/verify {phone, code}--> OTP_VERIFIED  (server stores otpSessionId)
  OTP_VERIFIED  --POST /p/invite/:token/claim {otpSessionId}--> CLAIMING (server starts tx)
  CLAIMING      --tx commit--> SUCCESS                 (Party.userId set, link consumed)
  CLAIMING      --tx error (already claimed)--> FAILED (race lost; 409)
  CLAIMING      --tx error (otp invalid)--> OTP_REQUIRED (retry; token still valid)
  any           --expiresAt < now / revoked--> FAILED
```

### 11.1 Why OTP is mandatory for the existing-user branch (security F2)

This is the single highest-impact threat in Epic C. Without OTP, **anyone who obtains the share URL can claim a Party against the legitimate owner's existing User account** — the token alone proves nothing about who the holder is. The mitigation is:

- **Branch (a) — phone matches no existing User:** the existing signup flow already requires OTP delivery to the party's phone. The attacker would need SIM access. Acceptable.
- **Branch (b) — phone matches an existing User:** the server MUST send a login OTP to the registered phone and require the caller to verify it before the bind runs. This is enforced server-side; the client cannot skip the step. The token by itself does not authenticate the caller as the User.

### 11.2 Server-side enforcement — `auth.service.ts` integration notes

`POST /api/p/invite/:token/claim` accepts `{ otpSessionId }` (NOT a raw OTP). The OTP session is created/verified via the existing `/api/auth/otp/*` endpoints, scoped to `purpose: 'invite-claim'` and tied to the token hash. Claim handler:

1. `resolvePublicToken(req, 'INVITE')` → typed `{ link }`
2. Load `Party` by `(id: link.resourceId, businessId: link.businessId)` — tenant-scoped fetch
3. Resolve the User who will be bound:
   - If `Party.phone` matches an existing `User.phone` → the bind target is that existing User. **Require `otpSessionId` proves OTP-verified for that phone with purpose=`invite-claim` and linkTokenHash matches.**
   - Else → call existing signup service to create a new User (which itself requires OTP-verification on the same phone). The signup service returns the new userId.
4. Run `claimInvite({ token: rawToken, newUserId })` from §6.4 — the atomic guarded `$transaction`.
5. On success, issue session cookies for the bound User (Party-owner is now signed in).
6. On race-loss (409): respond with `{ code: 'ALREADY_CLAIMED' }`, do NOT issue cookies, do NOT mutate state. The OTP session remains spent (single-use); attacker must repeat OTP to retry.

`Party.userId @unique` is the belt-and-braces — even if the OTP layer were bypassed, the DB would refuse a second bind. OTP is the suspenders.

### 11.3 Sequence (existing-user branch)

```
Client                    Public API                Auth API              DB
  | GET /p/invite/:tok ----->|
  |                          | resolvePublicToken      |                   |
  |                          | (hash, checks, audit)   |                   |
  |<--- {business, masked} --|                         |                   |
  | POST /auth/otp/send -----+------------------------>| send SMS OTP      |
  |       {phone,purpose,    |                         | store session     |
  |        linkToken}        |                         |                   |
  | POST /auth/otp/verify ---+------------------------>| verify code       |
  |<--- {otpSessionId} ------+-------------------------|                   |
  | POST /p/invite/:tok/claim|                         |                   |
  |       {otpSessionId} --->|                         |                   |
  |                          | resolvePublicToken      |                   |
  |                          | check otpSessionId      |                   |
  |                          | (phone matches link)    |                   |
  |                          | claimInvite tx          |                   |
  |                          |  - updateMany(link)     |                   |
  |                          |  - updateMany(party)    |                   |
  |<--- set-cookie + 200 ----|                         |                   |
```

---

## 12. File plan manifest (every file ≤ 200 LOC; 6-layer split)

### PR1 — Shared infra (~13 files)

```
server/prisma/schema.prisma (+SharedLink model with tokenHash unique)
server/prisma/migrations/.../epic_c_shared_links/migration.sql
server/src/services/shared-link.service.ts        — issue/revoke (~120 LOC)
server/src/services/public-resolver.service.ts    — resolvePublicToken + PublicLinkError (~120 LOC)
server/src/middleware/public/rate-limit.ts        — per-bucket limiter wrapping existing store
server/src/routes/public.routes.ts                — mounts /health + sub-routers
server/src/routes/public/invoice.routes.ts        — placeholder, PR3 fills in
server/src/__tests__/public-resolver.test.ts      — hash lookup + wrong-resource + revoked + expired
server/src/__tests__/public-rate-limit.test.ts
src/AppRoot.tsx                                    — /p/* gate
src/features/public/PublicShell.tsx                — header + footer wrapper
src/features/public/hooks/usePublicLang.ts
src/features/public/public.css                     — bundle-isolated styles
```

### PR2 — UPI QR (~6 files)

```
server/src/services/upi-link.service.ts
src/lib/upi.ts                                     — FE mirror
src/features/invoices/components/upi-pay-card.tsx
src/features/invoices/components/upi-pay-card.test.tsx
src/features/invoices/hooks/useUpiPayLink.ts
src/features/settings/components/upi-id-input.tsx  — wires BusinessSettings.upiId
```

### PR3 — Web invoice links (~11 files)

```
server/src/routes/documents/share-links.routes.ts
server/src/routes/public/invoice.routes.ts        — GET /api/p/invoice/:token (uses resolvePublicToken)
server/src/services/public-sanitize.service.ts    — Pick<>-based, no spread
server/src/services/public-sanitize.invoice.test.ts  — fuzz-every-field test
src/features/invoices/components/share-drawer-expiry.tsx
src/features/invoices/components/share-links-list.tsx
src/features/invoices/components/share-link-issued-toast.tsx  — shows one-time URL
src/features/invoices/services/share-links-crud.service.ts
src/features/public/invoice/PublicInvoicePage.tsx
src/features/public/invoice/PublicInvoicePage.states.tsx
src/features/public/invoice/hooks/usePublicInvoice.ts
```

### PR4 — Storefront (~13 files)

```
server/prisma/migrations/.../epic_c_storefront_fields/migration.sql
server/src/routes/public/store.routes.ts
server/src/services/storefront.service.ts
server/src/services/storefront-slug.service.ts    — slug-uniqueness + reserved-words const
server/src/lib/reserved-slugs.ts                  — SHARED CONST (see §H below)
server/src/services/storefront.sanitize.test.ts
server/src/services/storefront-slug.test.ts       — regex, reserved-list, lowercase
src/features/settings/storefront/StorefrontSettingsPage.tsx
src/features/settings/storefront/components/slug-picker.tsx
src/features/settings/storefront/components/product-visibility-picker.tsx
src/features/settings/storefront/hooks/useStorefrontSettings.ts
src/features/settings/storefront/services/storefront-crud.service.ts
src/features/public/store/PublicStorePage.tsx
src/features/public/store/components/whatsapp-cta.tsx
```

### PR5 — Party invite portal (~12 files)

```
server/prisma/migrations/.../epic_c_party_user_link/migration.sql
server/src/routes/parties/invite.routes.ts          — POST /api/parties/:id/invite (auth)
server/src/routes/public/invite.routes.ts           — GET/POST /api/p/invite/:token (uses resolvePublicToken + claimInvite)
server/src/services/party-invite.service.ts        — claimInvite atomic tx (§6.4)
server/src/services/party-invite.otp.service.ts    — wraps auth/otp for purpose='invite-claim'
server/src/services/party-invite.claim.test.ts     — hijack scenarios + race scenarios
server/src/services/party-invite.otp.test.ts       — OTP required for existing-user branch
src/features/parties/components/invite-button.tsx
src/features/parties/services/invite-crud.service.ts
src/features/public/invite/PublicInvitePage.tsx
src/features/public/invite/PublicInviteOtpStep.tsx — OTP send + verify
src/features/public/invite/hooks/usePublicInvite.ts
```

**Estimated new LOC across epic:** ~3,500 LOC server + client (excluding tests). 55 new files. ~800 LOC of tests.

---

## 13. Open question resolutions

| # | Question | Resolution | Rationale |
|---|----------|------------|-----------|
| 1 | Redis vs memory rate-limit store | Memory (existing `MemoryStore`) for MVP; pluggable interface is already there to swap to Redis when HP goes multi-instance | Single Render instance per memory/MEMORY.md; YAGNI |
| 2 | DB-lookup vs stateless HMAC | DB lookup on every resolve; cache layer NOT added in MVP | Revocation needs the row anyway; accessCount needs the write; Render Postgres can handle 60 lookups/min/IP comfortably |
| 3 | HMAC vs opaque token | **Opaque random 32-byte token + hashed DB row** (see §6) | Shorter URLs, O(1) revoke, no key rotation, single SoT, hash-at-rest neutralises DB-dump replay |
| 4 | Separate Vite entry vs route gate | Route gate in single bundle (see §7) | Single deploy, ~200KB gz budget achievable with lazy-load |
| 5 | Accept-Language fallback | NO — `?lang=` query param only, persisted in localStorage | Business owner previewing their own link must see WYSIWYG |
| 6 | `Party.userId` unique vs many-to-many | Unique (1 User → 1 Party globally) for MVP | Multi-supplier case is rare (<5% of Amit's profile); ticket logged for Phase 6 `PartyBusinessUser` join model |
| 7 | Slug uniqueness scope | Global unique on lowercased slug; reserved-words const list (see §H) checked at validator layer with 400 | Public URL collisions unacceptable; reserved list prevents impersonation of `/p/store/admin` etc. |

GSTIN on public invoice: **KEEP** — already on the PDF/paper invoice; removing creates confusion for tax-compliance display. Confirmed default in §8 allowlist.

---

## 14. Risks & mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Token brute-force enumeration | Low | 32-byte token = 256 bits entropy; rate limit 60/min; tokenHash storage means no DB dump leaks tokens |
| Token leak via DB dump / backup | Critical → Mitigated | `tokenHash = sha256(plaintext)`; plaintext never stored after issuance response |
| Race on party-claim (double bind) | Medium → Mitigated | Atomic `updateMany`-guarded `$transaction` returns count=0 → 409; `Party.userId @unique` second line of defense |
| Race on one-shot link consumption | Medium → Mitigated | `updateMany` with `claimedAt: null` in WHERE; serialized at storage layer |
| Inline-check drift across handlers | High → Mitigated | All `/api/p/*` handlers MUST call `resolvePublicToken(req, expectedResource)` first; no inline checks allowed; review-gate enforced |
| Public bundle leaks dev tools | Low | Production Vite build strips devtools; verified in `scripts/perf-budget.js` |
| Slug squatting (`amazon`, `flipkart`) | Medium | Reserved-words const list + admin moderation queue (queue is Phase 6; for MVP block at slug-pick time with strict regex) |
| WhatsApp deep-link phone misuse | Low | E.164 validation server-side; only digit characters in URL output |
| `X-Forwarded-For` spoof to evade rate-limit | Medium | `trust proxy: 1` (Render front-proxy only); documented residual; revisit if Render adds chained proxies |
| Cross-tenant IDOR via resolver | Critical → Mitigated | `resolvePublicToken` returns SharedLink including `businessId`; ALL downstream queries filter `where: { businessId: link.businessId, id: link.resourceId }` |
| PII regression: future field added to Prisma model, sanitizer not updated | Medium → Mitigated | Sanitizers use explicit `Pick<>`/hand-written object construction (no `...spread`); fuzz-every-field test catches new leaks |
| Invite-claim hijack via guessed phone / leaked URL against existing User | Critical → Mitigated | OTP-verified login required in addition to token for the existing-user branch (§11); `Party.userId @unique` constraint |
| Reserved-slug bypass via case/unicode | Medium → Mitigated | Slug lowercased + ASCII regex; reserved list compared against lowercased value; unicode and uppercase rejected at validator |

---

## 15. Acceptance gates (taken into design-plan-active.md)

### Backend
- `tsc --noEmit` clean
- `npx prisma migrate dev` succeeds for all 3 epic migrations on a fresh DB
- `curl GET /api/p/invoice/:token` → 200 (active) / 410 LINK_EXPIRED / 410 LINK_REVOKED / 410 LINK_CONSUMED / 404 INVALID_TOKEN
- 61st request/min from same IP to `/api/p/invoice/*` → 429 RATE_LIMITED
- **Hash-at-rest**: `SELECT token FROM "SharedLink"` fails (column does not exist); `tokenHash` is a 64-char hex
- **Atomic claim**: 50 concurrent claim attempts on a single invite → exactly one SUCCESS, 49× 409 ALREADY_CLAIMED; `Party.userId` set exactly once
- **Resolver helper**: grep for inline `prisma.sharedLink.findUnique` in `routes/public/**` returns ZERO results outside of `public-resolver.service.ts`
- **Sanitization fuzz test**: every field on a fully-populated `Document` / `Business` / `Party` / `Product` fixture NOT in the allowlist returns `undefined` in the public DTO
- **OTP enforcement**: claim attempt with valid token but missing/invalid `otpSessionId` against a phone matching an existing User → 401 OTP_REQUIRED; no Party mutation
- **Reserved slugs**: POST storefront settings with slug ∈ reserved list → 400 RESERVED_SLUG; slug `Admin` (mixed case) → 400 INVALID_SLUG; slug `valid-store` → 200

### Frontend
- Screenshots (4 states each): PublicInvoicePage, PublicStorePage, PublicInvitePage, PublicInviteOtpStep
- 320px screenshots: all public pages, no horizontal overflow
- `?lang=hi` toggle renders Hindi labels on invoice page
- Issue-link drawer: one-time URL is visible after issue, gone after drawer close; existing-links list never shows the URL again
- OTP step on invite-claim: visible whenever phone matches an existing user (manually verified test case)

---

## 16. Security agent hand-off

`security` agent has run (`docs/SECURITY_AUDIT_EPIC_C.md`, CONDITIONAL PASS, 2026-05-14). Six required revisions have been incorporated above:

1. **A2 — Hash tokens at rest** → §2 schema (`tokenHash @unique`, plaintext column removed), §6.1–6.2 issuer pseudocode, §6.3 resolver hashes the inbound URL token
2. **A5 + C3 + F3 — Atomic claim path** → §6.4 `updateMany`-guarded transaction; `count === 0` → 409 ALREADY_CLAIMED
3. **C2 — `resolvePublicToken(req, expectedResource)`** → §6.3 single entry point with typed `{ link, resource }` return and `PublicLinkError` errors; all `/api/p/*` handlers call this first
4. **E1 — Positive Pick allowlists** → §8.1 / §8.2 explicit DTOs and hand-written field construction; no Prisma spread; fuzz-every-field test in acceptance gates
5. **F2 — OTP for existing-user invite-claim** → §11 state machine adds `OTP_REQUIRED` / `OTP_VERIFIED`; §11.2 auth.service integration notes; §11.3 sequence diagram
6. **H1 + H3 — Storefront slug rules** → §H below; reserved const list, strict regex, unique-on-lowercase, 400 at validator

Residual items for security re-review post-implementation (not blocking task-manager seeding):

- Token entropy proof in PR1 code review (`crypto.randomBytes(32)`, not `Math.random`)
- `trust proxy: 1` audit and confirmation no manual XFF parsing in public routes
- XSS escape audit on `partyName` / `businessName` / `tagline` / `lineItem.name` rendering (no `dangerouslySetInnerHTML`, no string-concat into `href`)
- Confirm OTP send/verify endpoints do not differentiate "phone already registered" from "OTP failed" in their public responses
- CSRF posture: confirm `/api/p/*` mounted before `csrfProtection` and that no cookies are written on any public route except the final claim's session cookie

---

## H. Storefront slug rules (security H1 + H3)

### H.1 Shared const — `server/src/lib/reserved-slugs.ts`

```ts
// Reserved storefront slugs. Importable from validators, route handlers, and
// admin tools. Compared against the lowercased input.
export const RESERVED_SLUGS = [
  'admin', 'api', 'p', 'public', 'www', 'app', 'login', 'signup', 'billing',
  'settings', 'help', 'support', 'about', 'contact', 'terms', 'privacy',
  'root', 'system', 'staff', 'owner', 'store', 'stores', 'invite', 'invites',
  'invoice', 'invoices', 'me', 'health', 'status', 'static', 'assets',
] as const

export type ReservedSlug = typeof RESERVED_SLUGS[number]

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug.toLowerCase())
}
```

The frontend re-exports a mirror via the shared types package so client-side validation can pre-flight without a round-trip.

### H.2 Slug regex

```
^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$
```

Rules:
- ASCII only — no unicode lookalikes (`аdmin` with Cyrillic `а` is rejected)
- 3–32 characters total
- No leading or trailing hyphen
- Only lowercase letters, digits, and internal hyphens
- The validator MUST `.toLowerCase()` the input before regex test AND before reserved-list check, then store the lowercased value

### H.3 Validator layer (Zod)

```ts
// server/src/routes/storefront/storefront.validators.ts
import { z } from 'zod'
import { isReservedSlug } from '../../lib/reserved-slugs'

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/

export const storefrontSlugSchema = z
  .string()
  .min(3)
  .max(32)
  .transform((s) => s.toLowerCase())
  .refine((s) => SLUG_RE.test(s), { message: 'INVALID_SLUG' })
  .refine((s) => !isReservedSlug(s), { message: 'RESERVED_SLUG' })
```

The route handler maps the two Zod messages to distinct 400 responses:

| Failure | Status | Code |
|---------|--------|------|
| Regex fail | 400 | `INVALID_SLUG` |
| In reserved list | 400 | `RESERVED_SLUG` |
| DB unique violation (race) | 409 | `SLUG_TAKEN` |

### H.4 DB enforcement

`storefrontSlug String? @unique` on `Business`. Because the validator forces lowercase before write, the unique index on a single case form is sufficient — no need for a `LOWER(slug)` functional index. A migration test asserts that two businesses cannot set `storefrontSlug = 'mystore'`.

---

**End of architecture document.** Task-manager runs after security to produce `docs/TASKS_EPIC_C_customer_facing.md` with proof gates between Backend → Frontend → QA per PR.
