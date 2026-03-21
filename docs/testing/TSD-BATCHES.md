# Test Specification: Batch Tracking

## 1. Feature Summary

Batch tracking enables businesses to manage products by manufacturing batches, tracking expiry dates, cost prices per batch, and maintaining batch-level inventory. Critical for FMCG, pharma, and food businesses where FIFO/FEFO (First Expiry, First Out) selling is required. Each batch has its own stock quantity, cost price, selling price, manufacturing date, and expiry date.

**Pages:** `/products/:id/batches`, `/batches/:id`
**Priority:** P1 (Phase 4)
**Depends on:** Products, Inventory, Godowns

---

## 2. Preconditions

| # | Condition | How to Set Up |
|---|-----------|---------------|
| 1 | User logged in with inventory permission | Create user with `inventory:manage` role |
| 2 | At least 3 products exist | Seed via API |
| 3 | At least 1 product has batch tracking enabled | `product.batchTracking = true` |
| 4 | At least 2 godowns exist | Create default + 1 additional |
| 5 | At least 1 existing batch with stock | Create batch B001 with qty > 0 |
| 6 | At least 1 batch near expiry (within 30 days) | Set expiry date to today + 15 days |
| 7 | At least 1 expired batch with stock | Set expiry date to past date |

---

## 3. Test Scenarios

### 3a. Happy Path

| Step | Action | Expected Result | Verify Method |
|------|--------|-----------------|---------------|
| 1 | Navigate to product detail, click "Batches" tab | Batch list loads for this product | DOM: batch table visible with existing batches |
| 2 | Click "Add Batch" | Batch creation form opens | Visual: form with batch#, mfg date, expiry, cost, selling price, qty |
| 3 | Enter batch number: "B002" | Input accepts alphanumeric value | DOM: input value = "B002" |
| 4 | Enter manufacturing date: today | Date picker sets to today | DOM: date value = today |
| 5 | Enter expiry date: 6 months from now | Date picker sets future date | DOM: valid date, no error |
| 6 | Enter cost price: Rs 100 | Input accepts, stored as 10000 paise | DOM: shows Rs 100.00 |
| 7 | Enter selling price: Rs 150 | Input accepts, validates >= cost price (warning, not error) | DOM: shows Rs 150.00 |
| 8 | Enter opening stock: 50 | Input accepts positive integer | DOM: qty = 50 |
| 9 | Select godown: "Default" | Godown dropdown selected | DOM: godown shown |
| 10 | Click "Save Batch" | Batch created successfully | Network: POST /api/batches returns 201, batch in list |
| 11 | View batch list | New batch B002 visible with all details | DOM: row with B002, expiry, qty, price |
| 12 | Click on batch B002 | Batch detail page loads | URL: /batches/:id, shows full batch info |
| 13 | View batch stock movements | History table shows "Opening Stock: +50" | DOM: movement history table |
| 14 | Click "Edit Batch" | Edit form with pre-filled data | DOM: all fields populated |
| 15 | Update selling price to Rs 160 | Price field updated | DOM: input = 160 |
| 16 | Click "Update" | Batch updated successfully | Network: PUT /api/batches/:id returns 200 |
| 17 | View batch list sorted by expiry | FEFO order: nearest expiry first | DOM: first batch has earliest expiry |
| 18 | View expiry alerts | Near-expiry batches highlighted in amber, expired in red | Visual: color coding correct |
| 19 | Delete batch with 0 stock | Click delete, confirm | Network: DELETE /api/batches/:id returns 200 |
| 20 | Sell from batch (via invoice/POS) | Stock decrements for specific batch | DOM: batch qty reduced |

### 3b. Error Cases

| # | Scenario | Input | Expected Error |
|---|----------|-------|----------------|
| 1 | Empty batch number | Leave batch# blank | "Batch number is required" |
| 2 | Duplicate batch number for same product | Batch# "B001" (already exists) | "Batch B001 already exists for this product" |
| 3 | Expiry before manufacturing date | Mfg: 2026-06-01, Exp: 2026-01-01 | "Expiry date must be after manufacturing date" |
| 4 | Negative cost price | Cost: -100 | "Cost price must be 0 or greater" |
| 5 | Negative stock quantity | Qty: -5 | "Quantity must be 0 or greater" |
| 6 | Delete batch with stock > 0 | Delete batch with qty = 25 | "Cannot delete batch with existing stock (25 units). Adjust stock first." |
| 7 | Non-numeric price | Cost: "abc" | Input rejects non-numeric, or "Enter a valid price" |
| 8 | Selling price below cost (warning) | Cost: 100, Sell: 80 | Warning (not error): "Selling price is below cost price" |
| 9 | Expiry date in the past for new batch | Exp: yesterday | Warning: "This batch is already expired. Continue?" |
| 10 | Edit batch number to duplicate | Change B002 to B001 | "Batch B001 already exists for this product" |

### 3c. Edge Cases

| # | Scenario | Steps | Expected Behavior |
|---|----------|-------|-------------------|
| 1 | Zero cost price | Enter cost = Rs 0 (free goods / samples) | Accepted, profit margin shows as 100% |
| 2 | Same mfg and expiry date | Both set to same day | Accepted (some items valid for one day) |
| 3 | Batch with no expiry date | Leave expiry blank | Accepted, batch shows "No expiry" |
| 4 | 100+ batches for one product | Create many batches | Paginated list, search/filter by batch#, expiry status |
| 5 | Batch number with special chars | Batch#: "LOT-2026/03-A" | Accepted, displayed correctly |
| 6 | Selling from expired batch | POS or invoice selects expired batch | Warning shown, requires confirmation to proceed |
| 7 | Batch in multiple godowns | Same batch, stock split across 2 godowns | Batch shows total qty + per-godown breakdown |
| 8 | Transfer batch between godowns | Transfer 10 units of B001 from Default to Warehouse B | Batch stock updates per godown, total unchanged |
| 9 | Decimal quantity (weight-based) | Enter 2.5 kg | Accepted for weight-based products |
| 10 | Very long batch number | Batch#: 50 chars | Accepted, truncated in list, full in detail |

### 3d. State Transitions

| From | Action | To | Verify |
|------|--------|----|--------|
| Product without batches | Enable batch tracking | Product with empty batch list | Batch tab appears, "No batches yet" message |
| No batches | Add first batch | Has batches | Batch list shows 1 entry |
| Batch active (stock > 0) | Sell all stock | Batch depleted (stock = 0) | Qty = 0, shown as "Out of stock" |
| Batch active | Expiry date passes | Batch expired | Red "Expired" badge, warning on sale attempt |
| Batch near expiry | Within 30 days of expiry | Near-expiry alert | Amber "Expiring soon" badge |
| Batch depleted | Delete | Batch removed | No longer in list, 404 on direct URL |
| Product with batches | Disable batch tracking | Blocked | "Remove all batches before disabling batch tracking" |

---

## 4. API Contracts

| Method | Endpoint | Request Body | Success Response | Status |
|--------|----------|-------------|------------------|--------|
| GET | `/api/batches?productId={id}&cursor={id}&limit=20` | — | `{ success: true, data: Batch[], nextCursor: string \| null }` | 200 |
| GET | `/api/batches/:id` | — | `{ success: true, data: Batch & { movements: Movement[] } }` | 200 |
| POST | `/api/batches` | `{ productId: string, batchNumber: string, mfgDate?: string, expiryDate?: string, costPrice: number, sellingPrice: number, openingStock: number, godownId: string }` | `{ success: true, data: Batch }` | 201 |
| PUT | `/api/batches/:id` | `{ batchNumber?: string, mfgDate?: string, expiryDate?: string, costPrice?: number, sellingPrice?: number }` | `{ success: true, data: Batch }` | 200 |
| DELETE | `/api/batches/:id` | — | `{ success: true }` | 200 |
| DELETE | `/api/batches/:id` (has stock) | — | `{ success: false, error: { code: "HAS_STOCK", message: "..." } }` | 409 |
| GET | `/api/batches/expiring?days=30&cursor={id}&limit=20` | — | `{ success: true, data: Batch[] }` | 200 |

**Batch shape:**
```typescript
{
  id: string;
  productId: string;
  batchNumber: string;
  mfgDate: string | null;
  expiryDate: string | null;
  costPrice: number;       // paise
  sellingPrice: number;    // paise
  currentStock: number;
  godownStock: { godownId: string; godownName: string; quantity: number }[];
  status: 'active' | 'depleted' | 'expired';
  createdAt: string;
}
```

---

## 5. Visual Checkpoints

| Page / State | Viewport | What to Check |
|-------------|----------|---------------|
| Batch List | 375x812 | Cards per batch: batch#, expiry date badge, stock qty, cost/sell price |
| Batch List | 1280x720 | Table view: batch#, mfg date, expiry, cost, selling, stock, status, actions |
| Batch List — Empty | 375x812 | "No batches yet" illustration + "Add First Batch" CTA |
| Batch List — Expiry alerts | 375x812 | Expired = red badge, near-expiry = amber badge, active = green |
| Batch Detail | 375x812 | Header: batch# + status badge. Info cards: dates, prices, stock. Movement history table |
| Create/Edit Form | 375x812 | Full-width inputs, date pickers, price inputs with Rs prefix, save button sticky bottom |
| Create/Edit Form | 320x568 | No horizontal scroll, labels above inputs, all fields accessible |
| Expiring Soon Report | 375x812 | List of near-expiry batches grouped by product, sorted by expiry ASC |

---

## 6. Accessibility Requirements

| # | Requirement | Implementation |
|---|------------|----------------|
| 1 | Batch status badges have text labels | Not color-only: "Expired", "Expiring soon", "Active" text alongside color |
| 2 | Date pickers keyboard accessible | Arrow keys navigate dates, Enter selects, Escape closes |
| 3 | Price inputs have currency context | `aria-label="Cost price in rupees"` |
| 4 | Expiry alerts announced | `aria-live="polite"` for near-expiry notification banner |
| 5 | Delete confirmation is alertdialog | `role="alertdialog"` with clear description of consequences |
| 6 | Table sortable columns announced | `aria-sort="ascending"` / `"descending"` on sorted column |
| 7 | Form errors linked to inputs | `aria-describedby` on each input pointing to error element |
| 8 | Touch targets | All interactive elements >= 44x44px |

---

## 7. Performance Budgets

| Metric | Budget | Measurement |
|--------|--------|-------------|
| Batch list load (20 items) | < 300ms (API) | Network tab |
| Batch detail + movements | < 500ms (API) | Network tab |
| Batch create/update (API) | < 300ms (p95) | Network tab |
| Expiring soon report | < 500ms (API) | Network tab |
| Batch list page LCP | < 2s | Lighthouse |
| List with 100 batches scroll | 60fps | Performance monitor |
| Bundle size (batches chunk) | < 40KB gzipped | Build output |

---

## 8. Security Checks

| # | Check | Expected |
|---|-------|----------|
| 1 | All batch endpoints require auth | 401 without token |
| 2 | Batch CRUD requires `inventory:manage` permission | 403 without permission |
| 3 | User can only access own business batches | `where: { product: { businessId } }` enforced |
| 4 | Batch deletion checked server-side for stock | Cannot bypass via direct API call |
| 5 | Cost/selling prices validated as non-negative | Server rejects negative values |
| 6 | Batch number uniqueness per product enforced at DB level | Unique constraint on (productId, batchNumber) |
| 7 | Prices stored as integers (paise) | No floating point in DB |
| 8 | Input sanitization | Batch number, notes sanitized for XSS |

---

## 9. Pass/Fail Criteria

### Must Pass (P0 — blocks release)
- [ ] CRUD operations for batches work correctly
- [ ] Duplicate batch number for same product rejected
- [ ] Cannot delete batch with stock > 0
- [ ] Expiry date validation (must be after mfg date)
- [ ] Prices stored in paise, displayed in rupees
- [ ] Batch stock decrements correctly on sale
- [ ] Near-expiry and expired batches visually distinct
- [ ] All endpoints enforce auth and ownership

### Should Pass (P1 — degrades experience)
- [ ] FEFO sorting (nearest expiry first) in batch list
- [ ] Batch movement history accurate
- [ ] Batch-godown stock breakdown correct
- [ ] Selling below cost shows warning
- [ ] Form validation on blur

### Nice to Pass (P2 — polish)
- [ ] Expiry notification/alert system
- [ ] Batch-wise profit report
- [ ] Batch import from CSV
- [ ] Barcode per batch
