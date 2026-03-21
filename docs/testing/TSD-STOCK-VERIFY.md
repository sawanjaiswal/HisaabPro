# Test Specification: Stock Verification

## 1. Feature Summary

Stock Verification (physical stock count) enables businesses to reconcile physical inventory against system records. Users create a verification session, count products physically, record findings, and adjust stock to match reality. Supports partial counts (one category at a time), variance reports, and adjustment approval workflows. Essential for inventory accuracy and shrinkage detection.

**Pages:** `/stock-verification`, `/stock-verification/:id`
**Priority:** P1 (Phase 4)
**Depends on:** Products, Inventory, Godowns, Batches, Serial Numbers

---

## 2. Preconditions

| # | Condition | How to Set Up |
|---|-----------|---------------|
| 1 | User logged in with inventory permission | Create user with `inventory:manage` role |
| 2 | At least 10 products with stock > 0 | Seed via API |
| 3 | At least 2 godowns with stock | Stock distributed across godowns |
| 4 | At least 1 batch-tracked product with stock | Batch with qty > 0 |
| 5 | At least 1 serial-tracked product | Serials in AVAILABLE state |
| 6 | System stock quantities known | Record current system quantities for verification |
| 7 | At least 1 completed verification exists (for history tests) | Run a previous verification |

---

## 3. Test Scenarios

### 3a. Happy Path

| Step | Action | Expected Result | Verify Method |
|------|--------|-----------------|---------------|
| 1 | Navigate to `/stock-verification` | Verification list page loads | DOM: list of past verifications (or empty state) |
| 2 | Click "New Verification" | Create verification form opens | Visual: godown selector, category filter, date, note |
| 3 | Select godown: "Default" | Godown selected | DOM: dropdown shows "Default" |
| 4 | Select category filter: "All Products" | All products in godown will be counted | DOM: "All Products" selected |
| 5 | Enter note: "Quarterly stock count Q1 2026" | Note field populated | DOM: note text visible |
| 6 | Click "Start Verification" | Verification created in DRAFT status, redirects to count page | Network: POST /api/stock-verification returns 201, URL: /stock-verification/:id |
| 7 | View count page | Product list with system qty shown, physical qty input empty | DOM: table with product rows, system qty column filled |
| 8 | Click "Start Counting" | Status changes to IN_PROGRESS, physical qty inputs enabled | DOM: inputs become editable, status badge = "In Progress" |
| 9 | Enter physical count for product 1: 48 (system: 50) | Physical qty recorded, variance = -2 shown | DOM: variance column shows -2 in red |
| 10 | Enter physical count for product 2: 100 (system: 100) | No variance, shown as matched | DOM: variance = 0, shown in green or neutral |
| 11 | Enter physical count for product 3: 55 (system: 50) | Positive variance = +5 | DOM: variance = +5 in amber |
| 12 | Scan barcode for product 4 | Product row highlighted, cursor moves to physical qty input | Visual: row highlighted, input focused |
| 13 | Enter count for batch-tracked product | Batch-level count form appears | Visual: batch breakdown with qty per batch |
| 14 | Enter count for serial-tracked product | Serial checklist appears (check present serials) | Visual: list of serials with checkboxes |
| 15 | Check 8 of 10 serials as present | 2 serials marked as missing | DOM: 2 unchecked = missing, variance = -2 |
| 16 | Save progress | Counts saved (can resume later) | Network: PUT /api/stock-verification/:id, toast "Progress saved" |
| 17 | Click "Complete Count" | Confirmation dialog: "You counted X of Y products. Complete?" | Visual: dialog with summary stats |
| 18 | Confirm completion | Status changes to COMPLETED, variance report generated | Network: POST /api/stock-verification/:id/complete returns 200 |
| 19 | View variance report | Summary: total products, matched, short, excess, total variance value | DOM: report cards with metrics |
| 20 | Review individual variances | Each discrepancy listed with product, system qty, physical qty, variance, value impact | DOM: variance table sorted by absolute variance DESC |
| 21 | Click "Adjust Stock" | Adjustment confirmation: "This will update system stock to match physical count" | Visual: confirmation dialog with impact summary |
| 22 | Confirm adjustment | Stock adjusted, status changes to ADJUSTED | Network: POST /api/stock-verification/:id/adjust returns 200 |
| 23 | Verify product stock updated | Product 1 stock now = 48 (was 50) | DB: product stock matches physical count |
| 24 | View verification history | Completed verification in list with date, godown, variance summary | DOM: history entry with status "Adjusted" |

### 3b. Error Cases

| # | Scenario | Input | Expected Error |
|---|----------|-------|----------------|
| 1 | Start verification without godown | Skip godown selection | "Select a godown to verify" |
| 2 | Negative physical count | Enter -5 | "Physical count cannot be negative" |
| 3 | Complete with 0 products counted | Click Complete immediately | "Count at least one product before completing" |
| 4 | Adjust already adjusted verification | Try to adjust twice | "This verification has already been adjusted" |
| 5 | Edit completed verification | Try to change counts after COMPLETED | Inputs disabled, "Verification is complete. Create a new one to recount." |
| 6 | Concurrent verification for same godown | Start while another IN_PROGRESS exists | "A verification is already in progress for this godown (started by [user] on [date])" |
| 7 | Delete in-progress verification without permission | Non-admin tries to delete | "Only admins can cancel an in-progress verification" |
| 8 | Network failure during adjust | POST /adjust fails | "Stock adjustment failed. System stock unchanged. Try again." + Retry |
| 9 | Non-integer count for piece items | Enter 2.5 for piece-based product | "Quantity must be a whole number for this product" |
| 10 | Decimal count for weight items | Enter 2.5 for weight-based product | Accepted (weight items allow decimals) |

### 3c. Edge Cases

| # | Scenario | Steps | Expected Behavior |
|---|----------|-------|-------------------|
| 1 | All stock matches | Every product physical = system | "All stock matches!" success message, no adjustments needed |
| 2 | Product with 0 system stock | Product shows 0, count finds 5 | Positive variance +5, adjustment adds stock |
| 3 | Product not in system found physically | Unknown product scanned | "Product not in system" alert, option to add |
| 4 | 500 products in verification | Large godown count | Virtualized list, search/filter within count page, progress indicator |
| 5 | Resume interrupted verification | Start, count 20, leave, come back next day | Resume from where left off, previous counts preserved |
| 6 | Multiple users counting simultaneously | Two users on same verification | Real-time sync or lock per product, no conflicts |
| 7 | Stock changes during verification | Sale happens while counting | Warning: "System stock changed since verification started for: [products]" |
| 8 | Partial category count | Only count "Electronics" category | Only electronics products in verification, others untouched |
| 9 | Verification with all batches | Batch-level count for 5 batches | Each batch counted separately, per-batch variance shown |
| 10 | Missing serial numbers | 3 serials not found during count | Serials marked as MISSING, investigation flow triggered |

### 3d. State Transitions

| From | Action | To | Verify |
|------|--------|----|--------|
| (none) | Create verification | DRAFT | Status = DRAFT, no counts yet, products loaded |
| DRAFT | Start counting | IN_PROGRESS | Status = IN_PROGRESS, inputs enabled, timestamp set |
| IN_PROGRESS | Save progress | IN_PROGRESS | Counts persisted, can resume, timestamp updated |
| IN_PROGRESS | Complete count | COMPLETED | Status = COMPLETED, variance report generated, inputs locked |
| COMPLETED | Adjust stock | ADJUSTED | Status = ADJUSTED, all product stocks updated, audit log created |
| COMPLETED | Decline adjustment | COMPLETED | Remains COMPLETED, no stock changes, reason recorded |
| DRAFT | Cancel | CANCELLED | Status = CANCELLED, soft deleted |
| IN_PROGRESS | Cancel | CANCELLED | Status = CANCELLED, all counts discarded |
| ADJUSTED | (terminal) | — | Cannot transition further, read-only |

**Invalid transitions:**

| From | Attempted To | Expected |
|------|-------------|----------|
| DRAFT | COMPLETED (skip counting) | "Start counting before completing" |
| DRAFT | ADJUSTED | "Complete the count before adjusting" |
| COMPLETED | IN_PROGRESS (reopen) | "Create a new verification to recount" |
| ADJUSTED | COMPLETED (undo) | "Adjusted verifications cannot be reverted" |
| CANCELLED | IN_PROGRESS | "Cancelled verifications cannot be resumed" |

---

## 4. API Contracts

| Method | Endpoint | Request Body | Success Response | Status |
|--------|----------|-------------|------------------|--------|
| GET | `/api/stock-verification?cursor={id}&limit=20` | — | `{ success: true, data: Verification[], nextCursor: string \| null }` | 200 |
| GET | `/api/stock-verification/:id` | — | `{ success: true, data: Verification & { items: VerificationItem[] } }` | 200 |
| POST | `/api/stock-verification` | `{ godownId: string, categoryId?: string, note?: string }` | `{ success: true, data: Verification }` | 201 |
| PUT | `/api/stock-verification/:id` | `{ items: VerificationItem[], note?: string }` | `{ success: true, data: Verification }` | 200 |
| POST | `/api/stock-verification/:id/start` | — | `{ success: true, data: Verification }` | 200 |
| POST | `/api/stock-verification/:id/complete` | — | `{ success: true, data: Verification & { summary: VarianceSummary } }` | 200 |
| POST | `/api/stock-verification/:id/adjust` | `{ reason?: string }` | `{ success: true, data: { adjustedItems: number, totalVariance: number } }` | 200 |
| POST | `/api/stock-verification/:id/cancel` | `{ reason?: string }` | `{ success: true }` | 200 |
| GET | `/api/stock-verification/:id/report` | — | `{ success: true, data: VarianceReport }` | 200 |

**VerificationItem shape:**
```typescript
{
  productId: string;
  systemQty: number;
  physicalQty: number | null;  // null = not yet counted
  variance: number;            // physicalQty - systemQty
  varianceValue: number;       // variance x costPrice (paise)
  batchCounts?: { batchId: string; systemQty: number; physicalQty: number }[];
  serialsPresent?: string[];   // serial IDs found
  serialsMissing?: string[];   // serial IDs not found
}
```

**VarianceSummary shape:**
```typescript
{
  totalProducts: number;
  countedProducts: number;
  matchedProducts: number;
  shortProducts: number;       // physical < system
  excessProducts: number;      // physical > system
  totalShortageValue: number;  // paise
  totalExcessValue: number;    // paise
  netVarianceValue: number;    // paise
}
```

---

## 5. Visual Checkpoints

| Page / State | Viewport | What to Check |
|-------------|----------|---------------|
| Verification List | 375x812 | Cards: date, godown, status badge, product count, variance summary |
| Verification List — Empty | 375x812 | "No verifications yet" + "Start Stock Count" CTA |
| Count Page — DRAFT | 375x812 | Product list with system qty, "Start Counting" button prominent |
| Count Page — IN_PROGRESS | 375x812 | Physical qty inputs enabled, variance column updating live, progress bar (X of Y counted) |
| Count Page — IN_PROGRESS | 320x568 | No horizontal scroll, product name truncates, qty inputs accessible |
| Count Page — Batch product | 375x812 | Expandable row showing batch-level counts |
| Count Page — Serial product | 375x812 | Expandable row showing serial checklist with checkboxes |
| Variance Report | 375x812 | Summary cards (matched/short/excess), detail table below |
| Variance Report | 1280x720 | Dashboard layout: summary cards top, filterable table below, export button |
| Adjustment Confirmation | 375x812 | Dialog: impact summary (products affected, total value change), Cancel + Adjust buttons |
| Status Badges | All | DRAFT=gray, IN_PROGRESS=blue, COMPLETED=amber, ADJUSTED=green, CANCELLED=red |

---

## 6. Accessibility Requirements

| # | Requirement | Implementation |
|---|------------|----------------|
| 1 | Count inputs labeled per product | `aria-label="Physical count for [product name]"` |
| 2 | Variance color not sole indicator | Negative = red + minus icon, positive = amber + plus icon, zero = green + checkmark |
| 3 | Progress bar accessible | `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` |
| 4 | Status changes announced | `aria-live="polite"` for status transitions |
| 5 | Serial checkboxes labeled | `aria-label="Serial [number] present"` |
| 6 | Adjustment dialog is alertdialog | `role="alertdialog"` with consequences described |
| 7 | Tab order logical | Tab moves through product rows sequentially, within each row: name → qty input → next row |
| 8 | Touch targets | Qty input and serial checkboxes >= 44x44px |
| 9 | Keyboard navigation | Enter moves to next product's qty input, Escape cancels current edit |

---

## 7. Performance Budgets

| Metric | Budget | Measurement |
|--------|--------|-------------|
| Verification list load | < 500ms (API) | Network tab |
| Count page load (100 products) | < 1s (API) | Network tab |
| Count page load (500 products) | < 2s (API) | Network tab with pagination/virtual scroll |
| Save progress (API) | < 500ms (p95) | Network tab |
| Complete count (API) | < 1s (p95) | Network tab (variance calculation) |
| Adjust stock (API) | < 2s (p95) | Network tab (multiple stock updates in transaction) |
| Variance report render | < 500ms | Time from complete to report visible |
| Count page LCP | < 2s | Lighthouse |
| 500-product count page scroll | 60fps | Performance monitor |
| Bundle size (stock-verify chunk) | < 50KB gzipped | Build output |

---

## 8. Security Checks

| # | Check | Expected |
|---|-------|----------|
| 1 | All endpoints require auth | 401 without token |
| 2 | Verification requires `inventory:manage` permission | 403 without permission |
| 3 | Stock adjustment requires `inventory:adjust` permission | 403 without specific permission |
| 4 | User can only access own business verifications | `where: { businessId }` enforced |
| 5 | Adjustment is transactional | All stock updates in a single transaction, all-or-nothing |
| 6 | Audit log created for adjustments | Who adjusted, when, what changed, reason |
| 7 | Cannot adjust same verification twice | Server enforces status check |
| 8 | Variance values calculated server-side | Client cannot manipulate variance amounts |
| 9 | Rate limit on adjustment | Max 5 adjustments/min (prevents scripted manipulation) |
| 10 | Concurrent verification prevention | Server checks for existing IN_PROGRESS for same godown |

---

## 9. Pass/Fail Criteria

### Must Pass (P0 — blocks release)
- [ ] Create, start, count, complete, adjust lifecycle works end-to-end
- [ ] Physical count → variance calculation correct (paise precision)
- [ ] Stock adjustment updates all product quantities atomically
- [ ] Batch-level counting works for batch-tracked products
- [ ] Serial checklist works for serial-tracked products
- [ ] Invalid state transitions rejected with clear errors
- [ ] Cannot adjust same verification twice
- [ ] Audit log created for every adjustment
- [ ] All endpoints enforce auth and ownership
- [ ] Adjustment is transactional (all-or-nothing)

### Should Pass (P1 — degrades experience)
- [ ] Variance report with summary metrics accurate
- [ ] Progress saved and resumable
- [ ] Concurrent verification for same godown prevented
- [ ] Category filter works for partial counts
- [ ] Barcode scan highlights product row
- [ ] No horizontal scroll on 320px viewport

### Nice to Pass (P2 — polish)
- [ ] Variance report PDF export
- [ ] Stock change warning during count
- [ ] Real-time multi-user counting sync
- [ ] Verification schedule/reminders
- [ ] Historical variance trend charts
