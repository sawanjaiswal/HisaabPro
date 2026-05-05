# TRD — Business Verticals

## Architecture overview

Vertical behaviour is driven by a single SSOT config table indexed by
`businessType`. Components consume it via a thin React hook backed by the
existing `/me` response (which already carries `businessType`).

```
                        VERTICAL_PROFILES (config)
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
        useVertical()        terminology         defaults seeder
        React hook           lookup              (Phase 2)
              │                   │                   │
              ▼                   ▼                   ▼
        nav filter,         page titles,        new-business
        FAB label,          empty copy          settings rows
        section visibility
```

No backend schema change in Phase 1. `businessType` is already stored,
already returned by `/me`, already validated by Zod.

## Phase 1 — Wire the existing field

### Files

| Path | Status | Purpose |
|------|--------|---------|
| `src/config/verticals.config.ts` | new | SSOT: each type → `{ label, terminology, hiddenSections, defaultRoute, fabLabel }` |
| `src/hooks/useVertical.ts` | new | Reads `me.businessType` → returns the active VerticalProfile + helpers |
| `src/components/layout/SideNav.tsx` | edit | Filter MORE_MENU groups by `vertical.hiddenSections` |
| `src/components/layout/BottomNav.tsx` | edit | Hide tabs not in `vertical.bottomNavTabs` |
| `src/features/onboarding/OnboardingPage.tsx` | edit | Replace plain dropdown with visual cards (icon + name + 1-line description) |
| `src/features/onboarding/onboarding.constants.ts` | edit | Add 5 new verticals (`bakery`, `salon`, `clinic`, `tailor`, `freelancer`) + descriptions |
| `src/features/business/BusinessEditPage.tsx` | edit | Allow changing vertical with confirmation modal |
| `src/lib/translations.{en,hi}.ext*.ts` | edit | Add labels + descriptions for new verticals + terminology overrides |
| `server/src/schemas/business.schemas.ts` | edit | Add 5 new types to `BUSINESS_TYPES` enum |

### Data shape — VerticalProfile

```ts
export interface VerticalProfile {
  type: BusinessType                              // 'retail' | 'bakery' | …
  labelKey: TranslationKey                        // i18n
  descriptionKey: TranslationKey                  // shown on onboarding card
  iconName: string                                // lucide-react icon key
  fabLabelKey: TranslationKey                     // "New Bill" | "New Job" | "New Order"
  invoiceTermKey: TranslationKey                  // "Invoice" | "Bill" | "Quote"
  itemTermKey: TranslationKey                     // "Item" | "Service" | "Cake"
  hiddenNavKeys: ReadonlySet<NavKey>              // 'batches' | 'godowns' | …
  hiddenBottomNavKeys: ReadonlySet<BottomNavKey>
  defaultRoute: keyof typeof ROUTES               // first screen after login
  // Phase 2 — defaults to seed on business creation
  defaults?: {
    stockTracking?: boolean
    batchTracking?: boolean
    expiryTracking?: boolean
    serialNumberTracking?: boolean
  }
}
```

### useVertical hook

```ts
export function useVertical(): VerticalProfile {
  const { user } = useAuth()
  const type = (user?.businessType ?? 'general') as BusinessType
  return VERTICAL_PROFILES[type] ?? VERTICAL_PROFILES.general
}
```

`useAuth` already exposes `businessType` via the `/me` response (verified in
`server/src/services/auth/me.ts:38,111`). No backend work needed.

### Nav filter integration

`SideNav.tsx` builds menu items from `MORE_MENU_GROUPS`. Add a `key:
NavKey` to each group entry, then filter:

```ts
const vertical = useVertical()
const groups = MORE_MENU_GROUPS.map(g => ({
  ...g,
  items: g.items.filter(i => !vertical.hiddenNavKeys.has(i.key))
}))
```

`BottomNav.tsx` likewise filters tabs.

### Terminology integration

Pages that hardcode "Invoice" / "Bill" / "Item" already use `useLanguage()`
for translation. Add a thin helper:

```ts
export function useTerm() {
  const { t } = useLanguage()
  const v = useVertical()
  return {
    invoice: t[v.invoiceTermKey],
    item: t[v.itemTermKey],
    fab: t[v.fabLabelKey],
  }
}
```

Wire into Header titles for invoice/item screens (only the screens explicitly
named in PHASE_PLAN.md — not a global search-and-replace).

### Onboarding picker

Replace `<select>` with a 2-column card grid:

```tsx
{VERTICALS.map(v => (
  <button onClick={() => setType(v.type)}
          className={selected === v.type ? 'card--active' : 'card'}>
    <Icon name={v.iconName} />
    <h3>{t[v.labelKey]}</h3>
    <p>{t[v.descriptionKey]}</p>
  </button>
))}
```

Mobile-first: 2 columns at 320px, 3 at 480px+.

### Settings change-vertical flow

`BusinessEditPage.tsx` already lets the user edit name/email. Add a
"Business Type" row that opens the same picker; on submit, show a confirm
modal:

> "Switching to **Services** will hide Batches, Godowns, Stock Verification,
> and Serial Numbers from the menu. Your data is not deleted. You can switch
> back any time."

PATCH `/businesses/:id` already accepts `businessType` (verified in
`server/src/services/business.service.ts:236`). No backend change.

### Risk surface — Phase 1
- **Zero schema changes.** The field is already in the model with default `'general'`.
- **Zero new endpoints.** `/me` and PATCH `/businesses/:id` already support this.
- **No migration.** Existing users keep `'general'` and see today's nav (no change for them).
- **Reversible.** A user can switch back. Hidden menu items are NOT deleted, just filtered.

---

## Phase 2 — Vertical defaults seeder

### Backend
- `server/src/services/verticals/defaults.ts` — pure mapping `type → InventorySetting + DocumentSettings overrides`.
- On business creation (`createBusiness` in `business.service.ts`) call the seeder after the InventorySetting is created.
- New endpoint `POST /businesses/:id/apply-vertical-defaults` for the
  Settings "Switch vertical" flow.

### Frontend
- Settings change-vertical modal gets a checkbox "Also apply default
  settings for this vertical" (defaults checked).
- Surfaces a 1-line summary of what will change ("Will turn ON batch tracking
  and expiry tracking").

### Risk
- Touches `inventory_settings` and `document_settings` tables (writes only,
  no schema).
- Settings changes are reversible (the user can re-toggle each setting).

---

## Phase 3 — Job flow (services vertical)

### Schema
```prisma
model Job {
  id           String    @id @default(cuid())
  businessId   String
  partyId      String
  title        String
  description  String?
  status       JobStatus @default(QUOTED)
  scheduledAt  DateTime?
  completedAt  DateTime?
  invoiceId    String?   @unique
  totalPaise   Int       @default(0)
  // standard
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?

  business Business @relation(fields: [businessId], references: [id])
  party    Party    @relation(fields: [partyId], references: [id])
  invoice  Document? @relation(fields: [invoiceId], references: [id])
  items    JobItem[]

  @@index([businessId, status])
  @@index([businessId, scheduledAt])
}

enum JobStatus { QUOTED SCHEDULED IN_PROGRESS COMPLETED INVOICED CANCELLED }

model JobItem {
  id          String  @id @default(cuid())
  jobId       String
  description String
  quantity    Decimal @db.Decimal(12, 3)
  unitPaise   Int
  totalPaise  Int
  job         Job @relation(fields: [jobId], references: [id], onDelete: Cascade)
}
```

### Endpoints (REST, all behind `requireAuth + requirePermission('jobs:write|read')`)
- `GET    /jobs?status=…&q=…&cursor=…`
- `GET    /jobs/:id`
- `POST   /jobs`
- `PATCH  /jobs/:id`
- `POST   /jobs/:id/transition`  — body: `{ status: JobStatus }`
- `POST   /jobs/:id/convert-to-invoice` — creates Document(SALE_INVOICE), links back, sets status `INVOICED`
- `DELETE /jobs/:id` (soft)

### Frontend
- New feature folder `src/features/jobs/` (full 6-layer split).
- New routes `/jobs`, `/jobs/new`, `/jobs/:id`.
- Visible only when `vertical === 'services' || 'freelancer'` (added to
  `VerticalProfile.hiddenNavKeys` whitelist).
- `convert-to-invoice` reuses the existing invoice draft creation path —
  no duplicated rendering or PDF logic.

### Risk
- New tables — needs a migration. Triggers high-risk gate (`prisma/schema.prisma`).
  Will run `architect` agent + create design-plan-active.md before the schema edit.
- New permission keys — extends RBAC config; existing role seeds get
  additive update.

---

## Phase 4 — Custom Order (bakery / tailor verticals)

### Schema
Reuse `Document` with a new subtype:

```prisma
// Document.documentSubType: 'CUSTOM_ORDER'
// Add three optional columns to Document:
deliveryAt   DateTime?
deliverySlot String?      // 'morning' | 'afternoon' | 'evening' | free text
customFields Json?        // arbitrary key/value (design notes, measurements)
```

Custom orders flow through the existing Document machinery (line items,
totals, payments, PDF). The new fields are optional and ignored by other
document types.

### Frontend
- `src/features/orders/` feature folder (CustomOrderListPage, CustomOrderForm,
  CustomOrderDetailPage).
- Dashboard widget: "Today's Deliveries" + "Tomorrow's Deliveries" — visible
  only for bakery / tailor verticals.

### Risk
- Adds 3 columns to Document — high-risk gate fires. Design plan required.
- Backwards-compatible: existing documents have NULL in the new columns.

---

## Cross-cutting concerns

### Offline
All new endpoints route through `api()` with `entityType: 'job' | 'order'`
and human-readable `entityLabel`. No raw fetch, no localStorage writes.

### Permissions
- `jobs:read`, `jobs:write`, `orders:read`, `orders:write` — added to
  `server/src/config/permissions.ts`.
- Owner role gets all four; staff role inherits from existing
  parties/invoices grants by default.

### i18n
Every new label keyed in `translations.en.ext*.ts` AND `translations.hi.ext*.ts`
in the same commit. Hindi mirrors English; native-speaker review queued.

### Audit
Job + Order mutations write to `AuditLog` via the existing middleware (no
new code).

### Tests
- Unit: `verticals.config.spec.ts` — every type has a complete profile.
- Integration: Phase 3 — Job CRUD + transition + convert-to-invoice happy
  path + 401/403/409 paths.
- E2E (manual + screenshots): onboarding picker, vertical change, nav
  filter, job creation, order creation. Screenshots checked into
  `docs/business-verticals/screenshots/`.

### Rollout
Flag-free. The feature is additive — users on the default `general` type
see exactly today's app. Everyone else sees their vertical immediately.

### Telemetry (P1, deferred)
Track `vertical_picked` event on onboarding completion + `vertical_changed`
on settings save. Use the existing `/events` route (no new infra).
