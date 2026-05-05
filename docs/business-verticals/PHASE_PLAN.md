# Phase Plan — Business Verticals

Each phase is independently shippable. Phase N+1 builds on N but never
breaks N. No flags — additive UX only.

---

## Phase 1 — Wire the existing `businessType` field  *(2-3 days)*

Goal: a vertical pick during onboarding actually changes the app.

### Tasks
1. Define `BusinessType` union + 13 entries (8 existing + 5 new: bakery,
   salon, clinic, tailor, freelancer).
2. Build `src/config/verticals.config.ts` with the full `VerticalProfile`
   for every type.
3. Build `src/hooks/useVertical.ts` reading from existing auth state.
4. Add nav-key annotations to `MORE_MENU_GROUPS` and bottom-nav config.
5. Filter `SideNav` and `BottomNav` by `vertical.hiddenNavKeys`.
6. Build `useTerm()` and apply on the 4 highest-traffic Header titles
   (Dashboard, Documents/Invoices, Products/Items, POS/Bills).
7. Replace onboarding `<select>` with a card grid picker.
8. Add Settings → Business → "Change vertical" with confirmation modal.
9. Extend server enum (`BUSINESS_TYPES`) and translations (en + hi).
10. Tests: profile-completeness unit test; tsc + enforce.js clean.

### Acceptance
- Pick "Services" at onboarding → SideNav hides Batches, Godowns,
  Stock Verification, Serial Numbers within 1 sec of dashboard load.
- Pick "Restaurant" → Header on /documents reads "Bills" not "Invoices".
- Change vertical from Settings → confirmation modal appears → menu updates.
- All 4 UI states preserved on onboarding + settings pages.

### Out of scope for Phase 1
- Defaults seeding (Phase 2).
- New entities (Phase 3+).

---

## Phase 2 — Vertical defaults seeder  *(3-4 days)*

Goal: pick a vertical → app pre-configures sensible inventory + document
settings.

### Tasks
1. `server/src/services/verticals/defaults.ts` — pure mapping
   `BusinessType → Partial<InventorySetting> + Partial<DocumentSettings>`.
2. Wire into `createBusiness` after settings rows exist.
3. Add `POST /businesses/:id/apply-vertical-defaults` endpoint
   (idempotent; returns the applied diff).
4. Settings change-vertical modal gets "Apply defaults too?" checkbox.
5. Show 1-line summary of what will change before submit.
6. Integration tests: each type → defaults applied → settings rows match
   expected.

### Acceptance
- Create new business as "Pharmacy" → batch tracking and expiry tracking
  ON without user touching anything.
- Switch existing business from Retail → Services → modal shows "Will turn
  OFF stock tracking" → user confirms → settings updated.

---

## Phase 3 — Job flow for services / freelancer  *(2-3 weeks)*

**HIGH-RISK GATE TRIGGER** — `prisma/schema.prisma` edit.
Sequence required: architect agent → design plan → schema → code.

### Tasks
1. `architect` agent reviews + signs off `Job`, `JobItem`, `JobStatus` schema.
2. `.claude/design-plan-active.md` updated with phase-3 entry, status approved.
3. Migration: add `Job`, `JobItem`, `JobStatus` enum.
4. Server: `routes/jobs.ts`, `services/job.service.ts`, Zod schemas,
   asyncHandler + permission gates.
5. Server: `convert-to-invoice` reuses existing draft path; new tests.
6. Frontend feature folder `src/features/jobs/` (6-layer split).
7. Routes `/jobs`, `/jobs/new`, `/jobs/:id`; lazy loaded.
8. Add `jobs` nav key (visible only when vertical in services/freelancer
   set).
9. Dashboard widget "Active Jobs" for service verticals.
10. Tests: unit (status machine), integration (CRUD + convert), Playwright
    screenshots of all 4 UI states.

### Acceptance
- Plumber creates Job, schedules it, marks IN_PROGRESS, marks COMPLETED,
  converts to invoice → invoice shows correct line items and customer.
- All transitions validated server-side (can't skip QUOTED → INVOICED).
- All 4 UI states on the Jobs list page.

---

## Phase 4 — Custom Order for bakery / tailor  *(3-4 weeks)*

**HIGH-RISK GATE TRIGGER** — schema additions.

### Tasks
1. `architect` agent signs off Document additions (deliveryAt,
   deliverySlot, customFields Json).
2. Migration adds the 3 columns (NULL-safe, backwards-compatible).
3. Document subtype `CUSTOM_ORDER` added to enum.
4. Frontend feature folder `src/features/orders/` (full split).
5. Order form: standard line items + delivery date picker + slot dropdown
   + dynamic custom-field renderer (driven by per-business
   `CustomFieldDefinition` rows that already exist).
6. Convert-to-invoice path: stamps `deliveredAt`, copies to a
   SALE_INVOICE document.
7. Dashboard widgets: "Today's Deliveries" + "Tomorrow's Deliveries"
   (visible only when vertical in bakery/tailor set).
8. PDF: order print template (reuses existing template engine, new
   layout with delivery info block).

### Acceptance
- Cake shop creates an order for "Vanilla 1 kg eggless, 'Happy Birthday
  Riya'", advance Rs 500, balance Rs 1500, deliver tomorrow 4pm.
- Order appears on tomorrow's delivery widget.
- On delivery day, owner taps "Convert to Bill" → invoice draft opens
  with line items + customer + advance applied as payment.

---

## Phase 5+ — Deferred

- Appointment scheduling (salon/clinic).
- BOM / recipe explosion (restaurant).
- Per-vertical dashboards.
- Vertical-specific reports.
- Telemetry on vertical adoption.

---

## Sequencing

```
Phase 1  ──►  Phase 2  ──►  Phase 3  ──►  Phase 4  ──►  Phase 5+
   ▲               ▲              ▲              ▲
   no risk         settings       schema         schema
                   rows           (Job)          (Document cols)
                                  arch agent     arch agent
```

Phases 1+2 can ship to production immediately as additive improvements.
Phases 3 & 4 each require their own approved design plan before schema work.

---

## Status board

| Phase | Status   | Owner | Started     | Shipped |
|-------|----------|-------|-------------|---------|
| 1     | shipped  | Sawan | 2026-05-05  | 2026-05-05 |
| 2     | shipped  | Sawan | 2026-05-05  | 2026-05-05 |
| 3     | planned  | Sawan | —           | —       |
| 4     | planned  | Sawan | —           | —       |
