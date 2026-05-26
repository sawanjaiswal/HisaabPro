# SCOPE — Phase 5 Epic C: Customer-Facing Features
## Features #129 UPI QR · #130 Web Invoice Links · #121 Online Store · #131 Party Invite Portal

**Status:** DRAFT — 2026-05-14
**Author:** Sawan Jaiswal
**Personas:** Raju / Priya / Amit (business-side) · Kamlesh (customer-side)

---

## 1. Problem

HisaabPro businesses have no way to share invoices digitally, let customers browse products, or receive WhatsApp orders without calling — all flows that competitors like Vyapar and OkCredit partially solve but poorly on mobile. Phase 5 Epic C adds a zero-login public surface (`/p/`) that lets a business share a web invoice link, embed a UPI QR on it, run a bare-bones online storefront, and invite a trusted party to a branded signup — all without building a separate customer auth system or storefront backend.

---

## 2. Personas

| Persona | Role | Core pain |
|---------|------|-----------|
| Raju (micro retailer, Rs 1-5L/mo) | Business owner | Sends paper invoices or screenshots; no digital payment link |
| Priya (wholesaler, Rs 5-25L/mo) | Business owner | Shares PDF invoices over WhatsApp; customers call to confirm orders |
| Amit (distributor, Rs 25L-2Cr/mo) | Business owner | Wants parties to place repeat orders without ringing sales staff |
| Kamlesh (party / customer) | End-customer receiving a link | Opens the shared link on an Rs 9K Android; pays via UPI; views their bill |

---

## 3. Shared Infrastructure Dependencies

All four features in this epic share a common layer that ships in PR1 first. No PR2-PR5 is mergeable without PR1 green.

| Dependency | Detail |
|-----------|--------|
| HMAC util | `src/lib/share-token.ts` — `sign(payload, ttlSeconds)` / `verify(token)` → returns payload or throws `TokenExpiredError` / `TokenInvalidError`. Uses `crypto.createHmac('sha256', SHARE_SECRET)`. SHARE_SECRET in env. |
| Public route prefix | All public routes live at `/p/` — no auth middleware, but rate-limited. Express router `src/routes/public.ts`. |
| Public layout | `PublicLayout` component: business logo + name header, no HP nav, no login gate. Rendered by `src/features/public/PublicLayout.tsx`. |
| UPI deep-link builder | `src/lib/upi.ts` — `buildUpiLink({ vpa, name, amount, ref })` → `upi://pay?pa=...&pn=...&am=...&tr=...`. No server write. |
| Rate limiter | 60 requests / minute / IP on all `/p/` routes. Backed by in-memory store (Redis upgrade is an open question for architect). 429 JSON `{ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } }`. |
| SharedLink model | Prisma model tracking every shareable token; enables per-link revocation. See data model below. |

**SharedLink Prisma model (PR1):**

```prisma
model SharedLink {
  id          String   @id @default(cuid())
  businessId  String
  entityType  String   // "invoice" | "store" | "party_invite"
  entityId    String   // invoiceId, businessId, partyId
  token       String   @unique
  expiresAt   DateTime?
  isRevoked   Boolean  @default(false)
  createdAt   DateTime @default(now())
  createdBy   String   // userId
  business    Business @relation(fields: [businessId], references: [id])
  @@index([token])
  @@index([businessId, entityType])
}
```

---

## 4. PR Sequence

### PR1 — Shared Infra

Scope: `SharedLink` migration + `share-token.ts` HMAC util + `upi.ts` deep-link builder + public Express router (`/p/`) + `PublicLayout` component + rate limiter middleware.

Gate: migration applied, `GET /p/health` → 200, 61st req/min → 429, `verify(sign(p, 60))` passes, expired token throws.

---

### PR2 — #129 UPI QR on Invoice

Scope: Invoice detail page gets a "Pay via UPI" section showing the business UPI QR + tap-to-open deep link. Same QR is rendered on the shared web invoice page (PR3 hook — display component ships in PR2, wired in PR3). UPI QR is NOT added to the React-PDF template.

- Component: `<UpiPayCard vpa={} name={} amount={} invoiceNo={} />` in `src/features/invoices/components/`
- Deep link: `upi://pay?pa={vpa}&pn={name}&am={amount}&tr={invoiceNo}&tn=Invoice+{invoiceNo}`
- Amount in paise internally; `am` param is decimal rupees string (e.g. `"1200.00"`)
- Placement: below invoice summary on detail page, above line items
- PDF: explicitly excluded — PDF stays clean for formal/GST use

UI states:

| State | Copy |
|-------|------|
| No UPI configured | "Add UPI ID in Settings to show payment QR" (tappable, links to settings) |
| UPI present | QR rendered; "Tap to pay Rs X via UPI" below |
| Amount = 0 | QR hidden; "Invoice fully paid" badge |

---

### PR3 — #130 Web Invoice Share Links

Scope: Share drawer on Invoice detail page gains an expiry picker and generates a signed URL. Public page at `/p/invoice/:token` renders the invoice using `PublicLayout`.

**Share drawer additions:**

- Expiry picker: 7d / 30d (default) / 90d / Never (radio group, label "Link expires in")
- "Copy link" + "Share on WhatsApp" buttons
- Existing links listed with revoke button per link

**Public page `/p/invoice/:token`:**

- Server: `GET /api/p/invoice/:token` → verifies HMAC → checks `SharedLink.isRevoked` → returns invoice public payload (no PII beyond what the invoice already shows: party name, amounts, line items, business name/phone)
- 410 if expired, 401 if bad signature, 404 if revoked
- Client renders: business header, invoice summary, line item table, UPI pay card (PR2 component), "Powered by HisaabPro" footer
- Language: `?lang=hi` switches copy to Hindi (supported labels only; amounts always in English numerals)

**API contract:**

```ts
// GET /api/p/invoice/:token
// Response 200
interface PublicInvoiceRes {
  success: true
  data: {
    invoiceNo: string
    date: string          // ISO
    dueDate: string | null
    partyName: string
    businessName: string
    businessPhone: string
    businessUpi: string | null
    lineItems: Array<{ name: string; qty: number; unit: string; rate: number; amount: number }> // amounts in paise
    subtotal: number      // paise
    total: number         // paise
    amountDue: number     // paise
    status: 'draft' | 'sent' | 'paid' | 'partial'
  }
}
// Error
// 401: { success: false, error: { code: 'INVALID_TOKEN', message: 'Link is invalid' } }
// 410: { success: false, error: { code: 'LINK_EXPIRED', message: 'This link has expired' } }
// 404: { success: false, error: { code: 'LINK_REVOKED', message: 'This link has been revoked' } }
```

---

### PR4 — #121 Online Storefront

Scope: Business settings → "Online Store" tab to configure storefront (enable toggle, slug, tagline, visible product list). Public page at `/p/store/:slug`.

**Settings (authenticated):**

- Enable/disable store toggle
- Slug (auto-generated from business name, editable, unique-validated)
- Tagline (max 80 chars)
- Product visibility: multi-select from existing catalog; price shown/hidden toggle per product

**Public page `/p/store/:slug`:**

- Server: `GET /api/p/store/:slug` → returns business name, tagline, visible products (name, price if visible, unit)
- No HP auth on this endpoint
- CTA per product: WhatsApp deep-link only — `https://wa.me/<business_phone>?text=Hi%2C+I+want+to+order+<product_name>`
- No cart, no checkout, no HP server write from public surface
- No CAPTCHA (CTA redirects to WhatsApp; abuse surface is negligible)
- 404 if store disabled or slug not found

**API contract:**

```ts
// GET /api/p/store/:slug
interface PublicStoreRes {
  success: true
  data: {
    businessName: string
    tagline: string | null
    whatsappNumber: string     // E.164 without +
    products: Array<{
      id: string
      name: string
      unit: string
      price: number | null    // paise; null if hidden
    }>
  }
}
```

---

### PR5 — #131 Party Invite Portal

Scope: One-shot invite link that sends a party through standard HP signup, then pre-links the new User to the inviting business as a party.

**Flow:**

1. Business user opens party detail → "Invite to portal" button
2. Server generates a `SharedLink` with `entityType: 'party_invite'`, `entityId: partyId`, TTL 7 days (fixed, no picker)
3. WhatsApp message sent (or link copied): "Join {Business} on HisaabPro: {link}"
4. Party opens `/p/invite/:token` → public page shows business name + "Create your account"
5. Token verified → redirects to `/signup?invite={token}` — standard HP signup form
6. On signup success, server reads invite token → links new `User.id` to the business as a confirmed party (`Party.userId = newUserId`)
7. Token marked `isRevoked = true` (one-shot)
8. Party lands on their HP dashboard (standard app, no separate portal)

No new `PartyUser` join model. Party binding is `Party.userId` FK (nullable, added in this PR's migration).

**Party.userId migration (PR5):**

```prisma
// Field addition on existing Party model
userId  String?  @unique
user    User?    @relation(fields: [userId], references: [id])
```

---

## 5. User Stories

| # | As | I want to | So that |
|---|---|-----------|---------|
| C-1 | Priya | Share a web invoice link with a 30-day expiry from the share drawer | My customer can view and pay without needing the HP app |
| C-2 | Raju | Show a UPI QR on the invoice detail page | My customer can scan and pay immediately in-store |
| C-3 | Amit | Revoke a share link I sent by mistake | The customer can no longer view that invoice |
| C-4 | Priya | Let a customer browse my product list and tap to WhatsApp me | I receive orders without being called every time |
| C-5 | Amit | Configure which products show on my storefront and whether price is visible | I control my public catalogue |
| C-6 | Priya | Invite Raju Traders to the portal so they can see their own invoices | Raju stops calling me to ask for copies |
| C-7 | Kamlesh (customer) | Open a shared invoice link on my Android and pay via UPI | I can settle bills without installing an app |
| C-8 | Kamlesh | Open a storefront link and tap WhatsApp to place an order | I can order without a phone call |
| C-9 | Priya | Set a 7-day expiry on a share link for a one-time delivery | The link auto-expires without me remembering to revoke it |
| C-10 | Amit | Invite a new party via a link that expires after one use | The signup cannot be replayed or hijacked |

---

## 6. Out of Scope

- Multi-language storefront (beyond `?lang=hi` copy for invoice page)
- Custom domains for storefront (e.g. `shop.raju.in`)
- End-customer login / portal dashboard (they use the HP app after signup)
- Payment reconciliation from UPI (no webhook from bank; manual match only)
- Storefront analytics / visitor counts
- SEO meta tags / Open Graph for storefront
- CAPTCHA on any public surface (WhatsApp CTA is the abuse boundary)
- Product images on storefront (catalog enrichment epic owns that)
- Storefront orders management (no order entity; WhatsApp is the pipe)
- Party accepting/rejecting an invite notification back to business
- Bulk invite (invite one party at a time only)
- PartyUser many-to-many join model (flat `Party.userId` FK is sufficient for MVP)

---

## 7. Cross-PR Acceptance Criteria

- [ ] `GET /p/health` → 200 with no auth cookie (public route, no auth middleware)
- [ ] 61st request/min from same IP to `/p/*` → 429 `RATE_LIMITED`
- [ ] `GET /api/p/invoice/:expiredToken` → 410 `LINK_EXPIRED`
- [ ] `GET /api/p/invoice/:badSigToken` → 401 `INVALID_TOKEN`
- [ ] Revoked link: `isRevoked=true` in DB → `GET /api/p/invoice/:token` → 404 `LINK_REVOKED`
- [ ] `?lang=hi` on invoice public page renders Hindi labels (party name, amount labels)
- [ ] No PII leak: public invoice payload omits party phone, party email, party address
- [ ] UPI deep-link on invoice detail page opens UPI app when tapped on Android (manual test)
- [ ] UPI QR absent from React-PDF output (screenshot: PDF has no QR)
- [ ] Storefront `GET /api/p/store/:slug` → products with `price: null` when price hidden
- [ ] `GET /api/p/store/nonexistent` → 404
- [ ] Party invite token reuse after signup → 404 `LINK_REVOKED`
- [ ] After invite signup, `Party.userId` is set to new user's id
- [ ] SharedLink expiry picker: 7d / 30d / 90d / Never — each generates correct `expiresAt` (or null)
- [ ] `tsc --noEmit` clean after each PR
- [ ] Mobile 375px: public invoice page no horizontal overflow
- [ ] Mobile 320px: storefront product list no overflow

---

## 8. Open Questions for Architect

1. **Rate-limit backing store**: In-memory store works for single-server but fails on multi-instance deploy. Should PR1 use Redis from day one (adds infra dep) or accept the single-server limitation until scale forces it?

2. **HMAC scope vs DB lookup**: For invoice links, should the server trust the HMAC alone (stateless, no DB hit per view) or always hit `SharedLink` for revocation check? The stateless path can't honour revocation without the DB row — so the answer is always DB, but what's the caching strategy for high-traffic links?

3. **SharedLink schema vs pure JWT**: JWTs are self-contained and need no DB for verification, but revocation requires a blocklist (same DB write anyway). Current design uses HMAC + DB row — is that the right tradeoff, or should we standardise on short-TTL JWTs with no revocation (simpler) and accept that revocation means waiting for expiry?

4. **Public layout strategy**: `PublicLayout` has no HP shell (no BottomNav, no auth header). Should it live in `src/features/public/` as a standalone React tree (separate Vite entry point for performance) or as a route inside the existing SPA that conditionally hides the shell? Separate entry = smaller bundle for Kamlesh's Rs 9K phone.

5. **Language detection on public pages**: `?lang=hi` is the stated mechanism. Should the server also read `Accept-Language` header as a fallback, or keep it explicit-only to avoid surprising the business owner when they preview their own link on an English phone?

6. **`Party.userId` uniqueness constraint**: `@unique` means one User can only be a party at one business. For Amit who supplies multiple businesses, this breaks. Should it be a many-to-many `PartyBusinessUser` table now, or accept the single-business limitation for MVP and migrate later?

7. **Slug uniqueness scope**: Is the storefront slug unique globally (e.g. `hisaabpro.in/p/store/raju`) or per-business-type? Namespace collision at scale (two Raju's) needs a reservation or suffix strategy.
