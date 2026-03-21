# Test Specification: Godown Management

## 1. Feature Summary

Godown (warehouse) management allows businesses to track inventory across multiple physical locations. Users can create godowns, assign stock to specific godowns, transfer stock between godowns, and view godown-wise stock reports. Essential for distributors and multi-location retailers.

**Pages:** `/godowns`, `/godowns/:id`, `/godowns/transfer`
**Priority:** P1 (Phase 4)
**Depends on:** Products, Inventory, Batches, Serial Numbers

---

## 2. Preconditions

| # | Condition | How to Set Up |
|---|-----------|---------------|
| 1 | User logged in with inventory permission | Create user with `inventory:manage` role |
| 2 | At least 5 products with stock > 0 | Seed via API or UI |
| 3 | At least 1 godown already exists (default) | Created during business setup |
| 4 | At least 1 product has batch tracking | Batch with stock in default godown |
| 5 | At least 1 product has serial tracking | Serials in AVAILABLE state in default godown |
| 6 | Business plan supports multi-godown | Plan check passes (or bypass for test) |

---

## 3. Test Scenarios

### 3a. Happy Path

| Step | Action | Expected Result | Verify Method |
|------|--------|-----------------|---------------|
| 1 | Navigate to `/godowns` | Godown list page loads with default godown shown | DOM: at least 1 godown card |
| 2 | Click "Add Godown" button | Create godown form/modal opens | Visual: form with name, address, contact fields |
| 3 | Fill name: "Warehouse B" | Name input accepts text | DOM: input value = "Warehouse B" |
| 4 | Fill address: "Plot 45, MIDC, Pune" | Address input accepts text | DOM: input value matches |
| 5 | Fill contact person: "Ramesh" | Contact field populated | DOM: input value matches |
| 6 | Fill phone: "9876543210" | Phone validated (10 digits) | No validation error shown |
| 7 | Click "Save" | Godown created, redirects to godown list | Network: POST /api/godowns returns 201, new godown in list |
| 8 | Click on "Warehouse B" card | Godown detail page loads | URL: /godowns/:id, shows stock summary |
| 9 | View stock in godown | Table shows products with quantities in this godown | DOM: product rows with qty, value columns |
| 10 | Click "Edit" on godown | Edit form opens with pre-filled data | DOM: all fields populated with saved values |
| 11 | Change name to "Warehouse B - Pune" | Name updates | DOM: input value changed |
| 12 | Click "Update" | Godown updated successfully | Network: PUT /api/godowns/:id returns 200, toast shown |
| 13 | Navigate to `/godowns/transfer` | Transfer form loads with source/destination dropdowns | Visual: two godown selectors, product picker |
| 14 | Select source godown: "Default" | Source selected, available products load | DOM: source dropdown shows "Default" |
| 15 | Select destination: "Warehouse B - Pune" | Destination selected | DOM: destination dropdown shows "Warehouse B - Pune" |
| 16 | Search and select product to transfer | Product appears with available qty shown | DOM: product row with max qty from source |
| 17 | Enter transfer qty: 10 | Qty input accepts value, <= available stock | DOM: qty = 10, no error |
| 18 | Add another product to transfer | Second product row added | DOM: 2 transfer items |
| 19 | Add transfer note: "Monthly restock" | Note field populated | DOM: note text visible |
| 20 | Click "Transfer Stock" | Transfer processed, success toast | Network: POST /api/godowns/transfer returns 201 |
| 21 | Navigate to source godown | Stock reduced by transfer qty | DOM: product qty decreased |
| 22 | Navigate to destination godown | Stock increased by transfer qty | DOM: product qty increased |

### 3b. Error Cases

| # | Scenario | Input | Expected Error |
|---|----------|-------|----------------|
| 1 | Create godown without name | Leave name empty, click Save | "Godown name is required" inline error |
| 2 | Duplicate godown name | Name: "Default" (already exists) | "A godown with this name already exists" |
| 3 | Transfer qty > available stock | Source has 5, enter 10 | "Only 5 available in source godown" |
| 4 | Transfer to same godown | Source = Destination | "Source and destination must be different" |
| 5 | Transfer with no products selected | Click Transfer with empty list | "Add at least one product to transfer" |
| 6 | Delete godown with stock | Click Delete on godown with stock > 0 | "Cannot delete godown with existing stock. Transfer stock first." |
| 7 | Invalid phone number | Phone: "123" | "Enter a valid 10-digit phone number" |
| 8 | Transfer zero quantity | Enter qty = 0 | "Quantity must be greater than 0" |
| 9 | Network failure during transfer | POST fails (500) | "Transfer failed. No stock was moved. Try again." with Retry |
| 10 | Delete default godown | Click Delete on default | "Cannot delete the default godown" |
| 11 | Transfer serial-tracked item without selecting serials | Skip serial selection | "Select serial numbers to transfer" |
| 12 | Transfer expired batch | Select expired batch for transfer | Warning: "Batch expired on DD/MM/YYYY. Continue?" |

### 3c. Edge Cases

| # | Scenario | Steps | Expected Behavior |
|---|----------|-------|-------------------|
| 1 | Godown with 0 stock | View empty godown | "No stock in this godown" empty state with CTA "Transfer stock here" |
| 2 | 20+ godowns | Create 20 godowns | List paginates or scrolls, search/filter available |
| 3 | Transfer all stock from godown | Transfer 100% of a product | Source shows 0 qty, destination updated |
| 4 | Concurrent transfer | Two users transfer same product simultaneously | One succeeds, other gets "Stock changed" conflict error |
| 5 | Godown name with special chars | Name: "Warehouse #2 (Pune)" | Accepted and displayed correctly |
| 6 | Very long address | 500-char address | Accepted, truncated in list view, full in detail |
| 7 | Transfer batch-tracked product | Transfer 5 units of batch B001 | Batch stock moves between godowns, batch history updated |
| 8 | Transfer serial-tracked product | Transfer serial S001 | Serial's godownId updates, location history recorded |
| 9 | Godown-wise stock valuation | View godown with varied products | Total value calculated correctly (sum of qty x cost price) |
| 10 | Filter stock by product category | Use category filter in godown detail | Only matching products shown |
| 11 | Delete godown after transferring all stock | Transfer out all stock, then delete | Deletion succeeds, godown removed from list |
| 12 | Refresh during transfer | F5 while transfer is processing | Transfer either completes or rolls back atomically |

### 3d. State Transitions

| From | Action | To | Verify |
|------|--------|----|--------|
| No godowns (only default) | Create godown | Multiple godowns | Godown list shows 2+ entries |
| Godown with stock | Transfer out all stock | Godown with 0 stock | Stock count = 0, empty state shown |
| Godown with 0 stock | Transfer stock in | Godown with stock | Stock table populated |
| Godown exists | Delete (no stock) | Godown removed | 404 on direct URL, removed from list |
| Transfer initiated | Processing | Transfer complete | Source decremented, destination incremented atomically |
| Transfer initiated | Network failure | Transfer rolled back | Neither source nor destination changed |

---

## 4. API Contracts

| Method | Endpoint | Request Body | Success Response | Status |
|--------|----------|-------------|------------------|--------|
| GET | `/api/godowns` | — | `{ success: true, data: Godown[] }` | 200 |
| GET | `/api/godowns/:id` | — | `{ success: true, data: Godown & { stock: StockItem[] } }` | 200 |
| POST | `/api/godowns` | `{ name: string, address?: string, contactPerson?: string, phone?: string }` | `{ success: true, data: Godown }` | 201 |
| PUT | `/api/godowns/:id` | `{ name?: string, address?: string, contactPerson?: string, phone?: string }` | `{ success: true, data: Godown }` | 200 |
| DELETE | `/api/godowns/:id` | — | `{ success: true }` | 200 |
| DELETE | `/api/godowns/:id` (has stock) | — | `{ success: false, error: { code: "HAS_STOCK", message: "..." } }` | 409 |
| POST | `/api/godowns/transfer` | `{ sourceGodownId: string, destinationGodownId: string, items: TransferItem[], note?: string }` | `{ success: true, data: { transferId: string, items: TransferResult[] } }` | 201 |
| GET | `/api/godowns/:id/stock?cursor={id}&limit=50` | — | `{ success: true, data: StockItem[], nextCursor: string \| null }` | 200 |
| GET | `/api/godowns/transfers?cursor={id}&limit=20` | — | `{ success: true, data: Transfer[], nextCursor: string \| null }` | 200 |

**TransferItem shape:**
```typescript
{
  productId: string;
  quantity: number;
  batchId?: string;
  serialNumbers?: string[];
}
```

---

## 5. Visual Checkpoints

| Page / State | Viewport | What to Check |
|-------------|----------|---------------|
| Godown List | 375x812 | Card layout, each card: name, address snippet, stock count badge, tap to open |
| Godown List | 1280x720 | Grid of cards (3-4 per row), search bar top, "Add Godown" button |
| Godown List — Empty | 375x812 | Only default godown shown, "Add Godown" CTA prominent |
| Godown Detail | 375x812 | Header with godown name, stock table (product, qty, value), transfer button |
| Godown Detail — Empty stock | 375x812 | Empty state illustration: "No stock here yet", "Transfer Stock" CTA |
| Create/Edit Form | 375x812 | Full-width inputs, labels above, save button sticky at bottom |
| Transfer Form | 375x812 | Source/destination selectors stacked, product list below, "Transfer" button bottom |
| Transfer Form | 768x1024 | Source/destination side by side, product list below |
| Transfer Success | 375x812 | Success toast with transfer ID, option to view transfer history |

---

## 6. Accessibility Requirements

| # | Requirement | Implementation |
|---|------------|----------------|
| 1 | Godown cards are interactive | `role="link"` or `<a>` wrapping card content |
| 2 | Delete confirmation is a dialog | `role="alertdialog"` with focus trapped, Escape to cancel |
| 3 | Source/destination selectors labeled | `aria-label="Source godown"` / `aria-label="Destination godown"` |
| 4 | Transfer quantity inputs labeled | `aria-label="Transfer quantity for [product name]"` |
| 5 | Stock table is accessible | `<table>` with `<thead>`, `<th scope="col">`, sortable columns announced |
| 6 | Form validation errors linked | `aria-describedby` linking input to error message |
| 7 | Loading states announced | `aria-live="polite"` for "Loading stock..." |
| 8 | Touch targets | All buttons >= 44x44px |

---

## 7. Performance Budgets

| Metric | Budget | Measurement |
|--------|--------|-------------|
| Godown list load | < 500ms (API) | Network tab |
| Godown detail + stock load | < 800ms (API) | Network tab (parallel requests OK) |
| Stock transfer (API) | < 1s (p95) | Network tab, POST /api/godowns/transfer |
| Godown list page LCP | < 2s | Lighthouse |
| Stock table with 200 products | 60fps scroll | Performance monitor |
| Transfer form render | < 200ms | Time from navigation to interactive |
| Bundle size (godowns chunk) | < 50KB gzipped | Build output |

---

## 8. Security Checks

| # | Check | Expected |
|---|-------|----------|
| 1 | All godown endpoints require auth | 401 without token |
| 2 | Godown CRUD requires `inventory:manage` permission | 403 without permission |
| 3 | User can only access own business godowns | `where: { businessId }` enforced server-side |
| 4 | Transfer validated server-side | Server checks source stock, rejects if insufficient |
| 5 | Transfer is atomic (transaction) | If any item fails, entire transfer rolls back |
| 6 | Cannot delete another business's godown | 404 returned (not 403, to avoid enumeration) |
| 7 | Godown ID is UUID | No sequential IDs exposed |
| 8 | Input sanitization | Name/address sanitized for XSS |
| 9 | Rate limit on transfers | Max 10 transfers/min per user |

---

## 9. Pass/Fail Criteria

### Must Pass (P0 — blocks release)
- [ ] CRUD operations for godowns work correctly
- [ ] Stock transfer decrements source and increments destination atomically
- [ ] Cannot delete godown with existing stock
- [ ] Cannot transfer more than available stock
- [ ] Source and destination cannot be the same godown
- [ ] Batch-tracked transfers maintain batch association
- [ ] Serial-tracked transfers update serial location
- [ ] All endpoints enforce auth and ownership
- [ ] No horizontal scroll on 320px viewport

### Should Pass (P1 — degrades experience)
- [ ] Transfer history shows all past transfers
- [ ] Godown stock report shows accurate valuation
- [ ] Duplicate godown name prevented
- [ ] Form validation on blur
- [ ] Godown detail loads stock with pagination

### Nice to Pass (P2 — polish)
- [ ] Godown search/filter in list view
- [ ] Transfer receipt/PDF generation
- [ ] Stock movement timeline in godown detail
- [ ] Map integration showing godown location
