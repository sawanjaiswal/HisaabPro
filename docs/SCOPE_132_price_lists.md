# SCOPE #132 — Price Lists (Tiered Pricing)

> Status: Draft · Author: Scope Writer · Date: 2026-05-14

---

## Problem

Priya (growing wholesaler) sells the same product at different prices to
retailers, distributors, and walk-in customers. Today she manages this
manually — editing the invoice price every time or maintaining per-party
PartyPricing overrides. HisaabPro needs a first-class Price List feature
so she can define Retail / Wholesale / Distributor tiers once, assign
parties to a tier, and have invoices auto-fill the right price without
any per-line mental arithmetic.

---

## Personas

| Persona | Role | Priority |
|---------|------|----------|
| Priya | Growing wholesaler, 2-5 staff, Rs 5-25L/month — manages 3 customer tiers | Primary |
| Amit | Multi-location distributor, 5-20 staff — needs bulk-assign to reassign large party sets | Secondary |
| Raju | Micro retailer, single tier — uses only the default list, ignores this feature | Ignored |

---

## User Stories

1. As Priya, I want to create named price lists (Retail, Wholesale, Distributor) so that I stop maintaining per-product overrides for every party.
2. As Priya, I want each list entry to support three price modes (absolute paise, % off default, fixed rupee off default) so that I can express prices the way I think about them.
3. As Priya, I want quantity-break ranges within a single list (1-9 @ ₹100, 10-99 @ ₹95, 100+ @ ₹90) so that volume discounts are automatic.
4. As Priya, I want one list nominated as the business default so that every new party is automatically on Retail pricing without manual setup.
5. As Priya, I want to assign a party to a list from the Party form so that the right price auto-fills when I raise an invoice for that party.
6. As Amit, I want to bulk-assign a price list to multiple parties at once so that reclassifying 50 distributors does not take 50 taps.
7. As Priya, I want to see all list prices side-by-side on a product's detail screen so that I can sanity-check margins before confirming a list.
8. As Priya, I want to override the auto-filled tier price on a single invoice line so that I can honour a one-off deal without changing anyone's tier.

---

## Price Resolution Order (invoice line)

When HisaabPro prices a line item:

1. **Manual line-override** — user typed a price on this line → wins.
2. **PartyPricing per-product override** (existing feature) → wins over tier.
3. **Party's assigned price-list tier** (this feature) → resolved by qty-break range.
4. **Product default `sellingPrice`** — fallback of last resort.

PartyPricing and Price Lists coexist. Per-product PartyPricing overrides
always beat the tier price; the tier price beats the product default.

---

## Out of Scope (MVP)

- Date/validity windows on lists (always-on only)
- Bulk CSV import of list prices (manual entry only)
- Multiple list assignments per party (one active list per party)
- Price-list versioning, audit history, or change log
- GST / tax-category overrides per list
- Currency or UOM overrides per list

---

## Acceptance Criteria

### Price List CRUD

- [ ] User can create a price list with a name (max 60 chars).
- [ ] User can rename an existing price list.
- [ ] User can delete a price list only if zero parties are assigned to it; otherwise a blocking error names the count: "X parties are assigned — reassign before deleting."
- [ ] One list can be set as the business default in Settings; only one default at a time.
- [ ] Changing the default does NOT retroactively reassign existing parties; only future new parties auto-assign.

### Price List Entry — Three Modes

- [ ] For each product, a list entry stores exactly one mode:
  - `ABSOLUTE` — price in paise, e.g., 9500 = ₹95.00
  - `PERCENT_OFF` — a float (0–100), e.g., 5.0 = 5% off product default
  - `FIXED_OFF` — paise amount deducted from product default, e.g., 500 = ₹5 off
- [ ] UI validates that `ABSOLUTE` >= 0, `PERCENT_OFF` in [0, 100], `FIXED_OFF` >= 0.
- [ ] Computed price shown in real-time as user enters values (read-only preview field).

### Quantity-Break Ranges

- [ ] A list entry can have multiple qty-break rows: `(min_qty, max_qty | null, price_entry)`.
- [ ] Ranges must not overlap; UI blocks save and shows: "Qty ranges overlap — fix before saving."
- [ ] `max_qty = null` means "and above" (open-ended top tier).
- [ ] If party's line qty falls in no range, fall through to next resolution step.

### Default List Business Setting

- [ ] Settings > Pricing > "Default price list" picker shows all active lists.
- [ ] Saving updates the business record; new parties created after this point auto-assign.
- [ ] Setting screen shows current default name or "None."

### Party Assignment

- [ ] Party create/edit form has a "Price list" picker (single-select).
- [ ] Default list pre-selected for new parties; existing parties retain their current assignment (no silent migration).
- [ ] Clearing the picker sets party's list to null (falls through to product default).

### Bulk Assign

- [ ] Parties list screen has a multi-select mode (checkbox per row).
- [ ] "Assign price list" action available in the bulk action bar when >= 1 party selected.
- [ ] A bottom sheet shows a list picker; confirm assigns all selected parties to the chosen list.
- [ ] Success toast: "Price list updated for X parties."
- [ ] Partial failure (offline queue): "X updated · Y queued for sync."

### Invoice Line Auto-Fill

- [ ] When a line item is added and a party is selected, price auto-fills following the resolution order above.
- [ ] Qty-break lookup uses the line qty at the moment of fill; changing qty re-evaluates.
- [ ] Manual override: user can tap the price field and type any value; a subtle "edited" indicator appears.
- [ ] Removing the manual value restores the auto-filled tier price.

### Product Detail Price Preview

- [ ] Product detail screen has a "Price lists" section showing a table: List name | Mode | Effective price (at qty 1).
- [ ] If the product has no entry in a list, that list row shows "—".
- [ ] Table is read-only; tapping a row deep-links to that list's edit screen.

---

## UI Surfaces

| Surface | Location | Trigger |
|---------|----------|---------|
| Price List management | Settings > Pricing > Price Lists | Settings nav item |
| List entry editor | Full-screen form per list | "Edit" from list row |
| Default list picker | Settings > Pricing | Inline select |
| Party form picker | Create/Edit Party screen | "Price list" field |
| Bulk-assign sheet | Parties list, multi-select mode | Bulk action bar |
| Invoice line auto-fill | Invoice create/edit, each line | Automatic on party/product select |
| Per-line manual override | Same invoice line | Tap price field |
| Product detail preview | Product detail, "Price lists" section | Always visible |

---

## Open Questions (for Architect)

1. **Floating vs. snapshotted `PERCENT_OFF` / `FIXED_OFF`:** If a list entry
   uses `PERCENT_OFF: 5%` and the product's default `sellingPrice` is ₹100,
   then the owner later changes the default to ₹120 — does the effective tier
   price float to ₹114, or was ₹95 snapshotted at list-entry creation? The
   PRD assumes floating (computed at invoice time from the current default),
   but this must be confirmed before schema design.

2. **Qty re-evaluation on qty change:** When a user changes line qty from 5
   to 15 and the list has a break at 10, should the price auto-update silently
   or prompt ("Price changed from ₹100 to ₹95 — keep?"). Silent re-eval is
   simpler; prompt is safer for large orders.

3. **Offline qty-break resolution:** The full price-list data must be available
   in IndexedDB for offline invoice creation. What is the IDB record shape and
   eviction policy? (Likely synced with products on app open.)

4. **PartyPricing interaction on bulk assign:** If a party has both a
   PartyPricing row for Product X and is bulk-assigned to a new list,
   existing PartyPricing rows are untouched (per resolution order). Is there
   a warning in the bulk-assign confirmation? ("X of these parties have
   per-product overrides that will still take precedence.")

5. **Zero-product list save:** Should creating a list with no entries be
   allowed (shell list to assign parties upfront), or must at least one
   product entry exist before save?
