# Test Specification: Serial Number Tracking

## 1. Feature Summary

Serial number tracking provides unit-level traceability for high-value products (electronics, appliances, jewelry). Each unit has a unique serial number with a state machine governing its lifecycle: AVAILABLE, SOLD, RETURNED, DAMAGED, WARRANTY. Enables warranty lookups, return verification, and theft/fraud prevention.

**Pages:** `/products/:id/serials`, `/serials/lookup`
**Priority:** P1 (Phase 4)
**Depends on:** Products, Inventory, Godowns, Invoicing

---

## 2. Preconditions

| # | Condition | How to Set Up |
|---|-----------|---------------|
| 1 | User logged in with inventory permission | Create user with `inventory:manage` role |
| 2 | At least 2 products with serial tracking enabled | `product.serialTracking = true` |
| 3 | At least 10 serial numbers in AVAILABLE state | Bulk create via API |
| 4 | At least 2 serial numbers in SOLD state | Create and sell via invoice |
| 5 | At least 1 serial in RETURNED state | Process a return |
| 6 | At least 1 serial in DAMAGED state | Mark as damaged |
| 7 | At least 1 serial in WARRANTY state | Register warranty claim |
| 8 | At least 2 godowns exist | For location tracking |

---

## 3. Test Scenarios

### 3a. Happy Path

| Step | Action | Expected Result | Verify Method |
|------|--------|-----------------|---------------|
| 1 | Navigate to product detail, click "Serial Numbers" tab | Serial number list loads | DOM: serial table with existing serials |
| 2 | Click "Add Serial Numbers" | Add form opens (single + bulk modes) | Visual: input for single, textarea for bulk |
| 3 | Enter single serial: "SN-2026-001" | Input accepts value | DOM: input value matches |
| 4 | Select godown: "Default" | Godown assigned | DOM: dropdown shows "Default" |
| 5 | Click "Add" | Serial created in AVAILABLE state | Network: POST /api/serial-numbers returns 201 |
| 6 | Switch to "Bulk Add" mode | Textarea for multiple serials appears | Visual: textarea with placeholder "One serial per line" |
| 7 | Enter 5 serials (one per line) | Textarea accepts multiline input | DOM: 5 lines in textarea |
| 8 | Click "Add All" | 5 serials created | Network: POST /api/serial-numbers/bulk returns 201, count = 5 |
| 9 | View serial list | All serials shown with status badges (AVAILABLE = green) | DOM: rows with serial#, status, godown, date |
| 10 | Search serial: "SN-2026-001" | Filtered to matching serial | DOM: 1 result shown |
| 11 | Click on serial | Serial detail page loads | URL shows serial detail, full history visible |
| 12 | View serial history | Timeline: "Created → AVAILABLE" entry | DOM: history table with timestamps |
| 13 | Sell product with serial (via invoice) | Select serial during invoice creation | Serial picker shows AVAILABLE serials only |
| 14 | Complete sale | Serial status changes to SOLD | DB: serial status = SOLD, invoiceId linked |
| 15 | View serial detail after sale | Shows SOLD status with invoice link | DOM: "Sold via Invoice #INV-001" with clickable link |
| 16 | Process return for serial | Return flow selects serial | Serial identified by number |
| 17 | Complete return | Serial status changes to RETURNED | DB: serial status = RETURNED |
| 18 | Mark serial as damaged | Click "Mark Damaged" with reason | Serial status changes to DAMAGED |
| 19 | Register warranty claim | Click "Warranty Claim" with details | Serial status changes to WARRANTY |
| 20 | Navigate to `/serials/lookup` | Lookup page loads with search input | Visual: prominent search bar |
| 21 | Enter serial number in lookup | Full serial info displayed (product, status, history, customer) | DOM: comprehensive serial card |
| 22 | Edit serial godown location | Change godown assignment | Network: PUT /api/serial-numbers/:id returns 200 |

### 3b. Error Cases

| # | Scenario | Input | Expected Error |
|---|----------|-------|----------------|
| 1 | Empty serial number | Submit blank | "Serial number is required" |
| 2 | Duplicate serial for same product | Serial "SN-001" already exists | "Serial number SN-001 already exists for this product" |
| 3 | Sell serial not in AVAILABLE state | Try to add SOLD serial to invoice | "Serial SN-001 is not available (current status: SOLD)" |
| 4 | Return serial not in SOLD state | Return AVAILABLE serial | "Serial SN-001 was not sold (current status: AVAILABLE)" |
| 5 | Bulk add with duplicates in list | Two identical serials in textarea | "Duplicate serial numbers found: SN-001" |
| 6 | Bulk add with existing duplicate | One serial already in DB | "Serial SN-001 already exists. Other 4 serials added successfully." |
| 7 | Lookup nonexistent serial | Search "FAKE-123" | "Serial number not found" empty state |
| 8 | Delete serial in SOLD state | Try to delete sold serial | "Cannot delete serial in SOLD state" |

### 3c. Edge Cases

| # | Scenario | Steps | Expected Behavior |
|---|----------|-------|-------------------|
| 1 | 1000+ serials for one product | Bulk import 1000 serials | Paginated list, search works, no performance degradation |
| 2 | Serial number with special characters | Serial: "LOT/2026-03#001" | Accepted, displayed, searchable |
| 3 | Very long serial number | 100-character serial | Accepted, truncated in list with tooltip for full |
| 4 | Concurrent serial sale | Two POS terminals sell same serial | First succeeds, second gets "Serial already sold" |
| 5 | Bulk add 500 serials at once | Paste 500 lines | Processed in chunks, progress indicator shown, all created |
| 6 | Serial moved between godowns | Transfer serial from Default to Warehouse B | Location history updated, current godown changed |
| 7 | Serial with full lifecycle | AVAILABLE → SOLD → RETURNED → AVAILABLE → SOLD | All transitions recorded in history |
| 8 | Filter serials by status | Select "SOLD" filter | Only SOLD serials shown |

### 3d. State Transitions

**Valid transitions:**

| From | Action | To | Verify |
|------|--------|----|--------|
| AVAILABLE | Sold via invoice/POS | SOLD | Status = SOLD, invoiceId linked, soldAt timestamp set |
| SOLD | Return processed | RETURNED | Status = RETURNED, returnId linked, returnedAt set |
| RETURNED | Inspected and restocked | AVAILABLE | Status = AVAILABLE, godownId set, availableAt set |
| RETURNED | Inspected and found defective | DAMAGED | Status = DAMAGED, reason recorded |
| SOLD | Warranty claim registered | WARRANTY | Status = WARRANTY, claimId linked, warrantyAt set |
| WARRANTY | Warranty resolved — replaced | SOLD | New serial issued, original marked as WARRANTY_CLOSED |
| WARRANTY | Warranty resolved — repaired | AVAILABLE | Status = AVAILABLE, repairNote recorded |
| DAMAGED | Written off | WRITTEN_OFF | Status = WRITTEN_OFF, stock adjusted |
| ANY | Edit godown (location transfer) | SAME status | godownId updated, location history entry added |

**Invalid transitions (must be rejected):**

| From | Attempted To | Expected Error |
|------|-------------|----------------|
| WARRANTY | AVAILABLE (direct, without repair) | "Warranty claim must be resolved first" |
| DAMAGED | AVAILABLE (direct) | "Damaged items must go through inspection" |
| AVAILABLE | RETURNED | "Item was never sold" |
| AVAILABLE | WARRANTY | "Item was never sold, cannot register warranty" |
| WRITTEN_OFF | AVAILABLE | "Written-off items cannot be restocked" |
| SOLD | AVAILABLE (direct, without return) | "Process a return before restocking" |

---

## 4. API Contracts

| Method | Endpoint | Request Body | Success Response | Status |
|--------|----------|-------------|------------------|--------|
| GET | `/api/serial-numbers?productId={id}&status={status}&cursor={id}&limit=50` | — | `{ success: true, data: Serial[], nextCursor: string \| null }` | 200 |
| GET | `/api/serial-numbers/:id` | — | `{ success: true, data: Serial & { history: SerialEvent[] } }` | 200 |
| POST | `/api/serial-numbers` | `{ productId: string, serialNumber: string, godownId: string }` | `{ success: true, data: Serial }` | 201 |
| POST | `/api/serial-numbers/bulk` | `{ productId: string, serialNumbers: string[], godownId: string }` | `{ success: true, data: { created: number, duplicates: string[] } }` | 201 |
| PUT | `/api/serial-numbers/:id` | `{ godownId?: string, status?: string, reason?: string }` | `{ success: true, data: Serial }` | 200 |
| PUT | `/api/serial-numbers/:id` (invalid transition) | `{ status: "AVAILABLE" }` (from DAMAGED) | `{ success: false, error: { code: "INVALID_TRANSITION", message: "..." } }` | 422 |
| GET | `/api/serial-numbers/lookup?q={serial}` | — | `{ success: true, data: Serial & { product: Product, customer?: Customer } }` | 200 |
| DELETE | `/api/serial-numbers/:id` | — | `{ success: true }` | 200 |
| DELETE | `/api/serial-numbers/:id` (non-available) | — | `{ success: false, error: { code: "INVALID_STATE", message: "..." } }` | 409 |

**Serial shape:**
```typescript
{
  id: string;
  productId: string;
  serialNumber: string;
  status: 'AVAILABLE' | 'SOLD' | 'RETURNED' | 'DAMAGED' | 'WARRANTY' | 'WRITTEN_OFF';
  godownId: string;
  godownName: string;
  invoiceId: string | null;
  customerId: string | null;
  customerName: string | null;
  soldAt: string | null;
  returnedAt: string | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## 5. Visual Checkpoints

| Page / State | Viewport | What to Check |
|-------------|----------|---------------|
| Serial List | 375x812 | Cards per serial: serial#, status badge (color-coded), godown, date |
| Serial List | 1280x720 | Table view: serial#, product, status, godown, sold to, date, actions |
| Serial List — Empty | 375x812 | "No serial numbers yet" + "Add Serial Numbers" CTA |
| Serial List — Filtered | 375x812 | Status filter chips (ALL, AVAILABLE, SOLD, etc.), active filter highlighted |
| Serial Detail | 375x812 | Header: serial# + status badge. Cards: product info, customer, godown. Timeline: status history |
| Add Single | 375x812 | Serial input, godown selector, "Add" button |
| Add Bulk | 375x812 | Textarea (multiline), godown selector, count indicator, "Add All" button |
| Lookup Page | 375x812 | Large search bar centered, scan icon, recent lookups below |
| Lookup Result | 375x812 | Full serial card: product image, serial#, status, ownership, warranty info |
| Lookup — Not Found | 375x812 | "Serial not found" illustration with suggestion to check number |
| Status Badges | All | AVAILABLE=green, SOLD=blue, RETURNED=amber, DAMAGED=red, WARRANTY=purple |

---

## 6. Accessibility Requirements

| # | Requirement | Implementation |
|---|------------|----------------|
| 1 | Status badges not color-only | Text label + icon alongside color (e.g., checkmark for AVAILABLE) |
| 2 | Serial lookup search accessible | `aria-label="Look up serial number"`, results announced via `aria-live` |
| 3 | Bulk add textarea labeled | `aria-label="Enter serial numbers, one per line"` |
| 4 | History timeline accessible | `<ol>` with `aria-label="Serial number history"` |
| 5 | Status filter chips | `role="radiogroup"` with `aria-label="Filter by status"` |
| 6 | Action buttons labeled | `aria-label="Mark as damaged"`, `aria-label="Register warranty"` etc. |
| 7 | Confirmation dialogs | `role="alertdialog"` with `aria-describedby` for consequences |
| 8 | Touch targets | All buttons >= 44x44px, status chips >= 44px height |

---

## 7. Performance Budgets

| Metric | Budget | Measurement |
|--------|--------|-------------|
| Serial list load (50 items) | < 300ms (API) | Network tab |
| Serial lookup | < 200ms (API) | Network tab |
| Bulk add 100 serials | < 2s (API) | Network tab |
| Bulk add 500 serials | < 5s (API) | Network tab, progress indicator shown |
| Serial detail + history | < 500ms (API) | Network tab |
| Serial list page LCP | < 2s | Lighthouse |
| Filter/search (client-side) | < 100ms | No visible lag |
| Bundle size (serials chunk) | < 40KB gzipped | Build output |

---

## 8. Security Checks

| # | Check | Expected |
|---|-------|----------|
| 1 | All serial endpoints require auth | 401 without token |
| 2 | Serial CRUD requires `inventory:manage` permission | 403 without permission |
| 3 | User can only access own business serials | `where: { product: { businessId } }` enforced |
| 4 | State transitions validated server-side | Invalid transitions return 422, not silently accepted |
| 5 | Serial uniqueness enforced at DB level | Unique constraint on (productId, serialNumber) |
| 6 | Bulk add sanitized | Each serial number sanitized for XSS |
| 7 | Lookup does not expose other business data | Cross-business lookup returns 404 (not 403) |
| 8 | Serial history is append-only | Cannot edit or delete history entries via API |
| 9 | Rate limit on bulk add | Max 1000 serials per request, 5 bulk requests/min |
| 10 | Concurrent sale protection | Optimistic locking on serial status prevents double-sale |

---

## 9. Pass/Fail Criteria

### Must Pass (P0 — blocks release)
- [ ] CRUD operations for serial numbers work correctly
- [ ] State machine enforces valid transitions only
- [ ] Invalid transitions (WARRANTY→AVAILABLE, DAMAGED→AVAILABLE) rejected with clear error
- [ ] Duplicate serial number for same product rejected
- [ ] Serial status updates atomically on sale/return
- [ ] Bulk add handles duplicates gracefully (partial success)
- [ ] Serial lookup returns correct product, status, and customer info
- [ ] All endpoints enforce auth and ownership
- [ ] Concurrent sale of same serial prevented

### Should Pass (P1 — degrades experience)
- [ ] Serial history timeline accurate and complete
- [ ] Status filter works correctly
- [ ] Godown location tracking on serial transfers
- [ ] Serial search within product page
- [ ] Form validation on blur

### Nice to Pass (P2 — polish)
- [ ] Serial number barcode/QR generation
- [ ] Warranty expiry alerts
- [ ] Serial import from CSV
- [ ] Serial scan via camera
