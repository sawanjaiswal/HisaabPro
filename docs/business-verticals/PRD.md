# PRD — Business Verticals

## Problem
HisaabPro today is generic. Onboarding asks the user to pick a business type
(retail / wholesale / services / restaurant / pharmacy / etc.) but the answer
is stored and ignored — every user, regardless of vertical, sees the same nav,
the same terminology ("Invoice", "Product", "Stock"), and the same defaults.

A plumber doesn't need batches, expiry, or godowns. A cake shop wants order
date + delivery date + custom design notes, not a static SKU. A restaurant
wants "Bill", not "Invoice". A pharmacy MUST track batch and expiry.

Generic ≠ helpful. Vyapar / Tally suffer the same problem; this is the lever
to differentiate.

## Goals (P0)
1. Make the user's chosen `businessType` materially change the app:
   - Hide nav items that don't apply (services don't see Batches/Godowns).
   - Re-label core nouns ("Invoice" → "Bill" for restaurants, "Quote" for
     services, "Order" for cake shops).
   - Seed sensible defaults per type (pharmacy → batch tracking on by default;
     services → stock tracking off).
2. Add a richer set of vertical types so the picker is meaningful:
   - `bakery`, `salon`, `clinic`, `tailor`, `freelancer` (in addition to
     existing 8).
3. Service businesses can run a basic **Job** flow (quote → schedule →
   complete → invoice) without bending the product/stock model.
4. Custom-order businesses (cake, tailor) can capture an **Order** with event
   date, custom fields, advance, balance.

## Non-Goals (P1+)
- Vertical-specific reports (e.g., baker productivity).
- Appointment scheduling (salon/clinic) — defer to Phase 5.
- BOM / recipe explosion (restaurant) — defer to Phase 6.
- Per-vertical dashboards.
- Admin-side vertical analytics.

## User Stories

**As a plumber (services)**, I want:
- The app to not show me "Batches", "Godowns", "Serial Numbers", "Stock Verification".
- A "New Job" button that captures customer + scope + scheduled date.
- The job to convert into an invoice when complete.

**As a cake shop owner (bakery)**, I want:
- A "New Order" button that captures: customer, design notes, delivery date,
  delivery slot, advance paid, balance due.
- Yesterday's deliveries marked complete; tomorrow's deliveries highlighted.
- Each order convertible into an invoice on delivery.

**As a pharmacist**, I want:
- Batch + expiry mandatory on every product.
- Expiry alerts surfaced on the dashboard.
- Prescription number captured on the bill (optional field).

**As a restaurant owner**, I want:
- The app to say "Bill", not "Invoice".
- A simple POS as the home screen.
- No "Quote" or "Purchase Order" in nav (irrelevant).

## Success Metrics
- ≥ 70% of new signups in 30 days post-launch pick a non-`general` type
  (today: untracked, default is `general`).
- 30-day retention for the top-3 verticals (retail, services, restaurant)
  improves by ≥ 5 pp vs current cohort.
- Support tickets containing "how do I hide X" drop ≥ 50%.

## Acceptance — Phase 1
- Picking a business type during onboarding changes the visible nav within
  one second of completing onboarding.
- Each vertical sees correct terminology on the Header title, the FAB label,
  and the empty-state copy of major lists.
- A user can change vertical from Settings → Business with a confirmation
  warning ("This will hide / show some menu items.").
- All 4 UI states preserved on every page touched.
- TypeScript clean, enforce.js clean, offline baseline holds.

## Acceptance — Phase 2 (Defaults)
- Creating a new business in vertical X applies vertical X's default settings
  (stock tracking, batch tracking, expiry tracking, default unit, default
  document type) without the user touching them.
- Switching vertical post-creation does NOT silently change settings; the
  user sees a "Apply X defaults?" prompt.

## Acceptance — Phase 3 (Job flow for services)
- A "New Job" CTA exists in the services vertical.
- Job has states: `QUOTED → SCHEDULED → IN_PROGRESS → COMPLETED → INVOICED`.
- Converting a Job to an Invoice copies line items + customer; Job moves to
  `INVOICED`.
- Jobs list page with all 4 UI states.

## Acceptance — Phase 4 (Custom Order for bakery/tailor)
- A "New Order" CTA exists in the bakery/tailor verticals.
- Order has: customer, items, delivery date, delivery slot, custom fields
  (design notes / measurements), advance amount, balance due.
- "Today's Deliveries" + "Tomorrow's Deliveries" widgets on dashboard for
  these verticals.
- Order converts to invoice on completion.

## Out of scope (explicit)
- No appointment scheduling.
- No staff/baker assignment beyond a free-text field.
- No SMS/WhatsApp delivery reminders to customers (use existing reminder system).
- No hardware POS integration changes.
