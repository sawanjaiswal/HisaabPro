# Test Specification: Cross-Feature Integration

## 1. Feature Summary

Cross-feature integration tests verify that Phase 4 features (POS, Godowns, Batches, Serial Numbers, Stock Verification) work correctly together. These tests catch boundary issues where individual features pass in isolation but fail when combined — the #1 source of production bugs in inventory systems.

**Pages:** All Phase 4 pages
**Priority:** P0 (blocks release)
**Depends on:** All Phase 4 features individually passing

---

## 2. Preconditions

| # | Condition | How to Set Up |
|---|-----------|---------------|
| 1 | User logged in with full inventory + POS permissions | Admin role or all relevant permissions |
| 2 | 2 godowns: "Main Store" and "Warehouse" | Created via godown CRUD |
| 3 | Product A: batch-tracked, 3 batches (B1: 20 units, B2: 30 units, B3: 10 units) in Main Store | Batch setup with stock |
| 4 | Product B: serial-tracked, 10 serials (SN-001 to SN-010) in AVAILABLE state in Main Store | Serial setup |
| 5 | Product C: basic (no tracking), 100 units in Main Store, 50 in Warehouse | Stock distributed |
| 6 | Product D: batch + serial tracked, 2 batches with 5 serials each | Combined tracking |
| 7 | At least 1 customer exists | For POS sale with customer |
| 8 | All individual feature tests passing | Run feature TSDs first |

---

## 3. Test Scenarios

### 3a. Happy Path — Integration Flows

| Step | Action | Expected Result | Verify Method |
|------|--------|-----------------|---------------|
| 1 | **POS → Batch stock**: Open POS, add Product A (batch-tracked) | Batch picker modal appears showing B1 (20), B2 (30), B3 (10) | DOM: 3 batches listed with correct quantities |
| 2 | Select batch B1, qty = 5 | B1 selected, 5 units in cart from B1 | DOM: cart shows "Product A (Batch: B1) x5" |
| 3 | Complete POS sale | Sale succeeds | Network: POST /api/pos/quick-sale returns 201 |
| 4 | Check batch B1 stock | B1 stock = 15 (was 20, sold 5) | API: GET /api/batches → B1.currentStock = 15 |
| 5 | Check overall Product A stock | Total = 55 (was 60, sold 5) | API: product.currentStock = 55 |
| 6 | **POS → Serial status**: Open POS, add Product B (serial-tracked) | Serial picker modal appears showing 10 AVAILABLE serials | DOM: SN-001 through SN-010 listed |
| 7 | Select serial SN-003, complete sale | Sale succeeds with serial SN-003 | Network: sale includes serialNumbers: ["SN-003"] |
| 8 | Check serial SN-003 status | Status = SOLD, linked to invoice | API: GET /api/serial-numbers/SN-003 → status = "SOLD" |
| 9 | Check Product B stock | Stock = 9 (was 10, sold 1) | API: product.currentStock = 9 |
| 10 | Open POS again, add Product B | Serial picker shows 9 AVAILABLE serials (SN-003 missing) | DOM: SN-003 not in list |
| 11 | **Godown transfer → Stock update**: Transfer 10 units of Product C from Main Store to Warehouse | Transfer succeeds | Network: POST /api/godowns/transfer returns 201 |
| 12 | Check Main Store stock for Product C | 90 units (was 100, transferred 10) | API: godown stock = 90 |
| 13 | Check Warehouse stock for Product C | 60 units (was 50, received 10) | API: godown stock = 60 |
| 14 | **Godown transfer → Batch stock**: Transfer 5 units of Product A, Batch B2, from Main Store to Warehouse | Transfer with batch selection succeeds | Network: transfer includes batchId |
| 15 | Check B2 stock in Main Store | 25 units (was 30, transferred 5) | API: godown-batch stock = 25 |
| 16 | Check B2 stock in Warehouse | 5 units (was 0, received 5) | API: godown-batch stock = 5 |
| 17 | **Godown transfer → Serial location**: Transfer serial SN-005 of Product B from Main Store to Warehouse | Transfer with serial selection succeeds | Network: transfer includes serialNumbers |
| 18 | Check SN-005 location | godownId = Warehouse | API: serial.godownId = warehouseId |
| 19 | **Stock verification after POS**: Start stock verification for Main Store | Verification loads with updated system quantities reflecting all sales and transfers | DOM: Product A system qty = 50 (60 - 5 sold - 5 transferred), Product B = 8 (10 - 1 sold - 1 transferred), Product C = 90 |
| 20 | Count Product A physically: 48 (2 missing) | Variance = -2 shown | DOM: variance = -2 |
| 21 | Complete verification and adjust | Stock updated to physical counts | DB: Product A stock in Main Store = 48 |
| 22 | **Post-adjustment POS**: Open POS, add Product A | Available stock reflects adjusted quantity | DOM: max qty = 48 (adjusted) in Main Store |
| 23 | **Batch expiry in POS**: Add Product A, batch B3 (near expiry) | Expiry warning shown in batch picker | Visual: amber "Expiring soon" badge on B3 |
| 24 | **Serial warranty after sale**: Look up serial SN-003 (sold earlier) | Shows SOLD status, customer info, sale date | DOM: full serial history |

### 3b. Error Cases

| # | Scenario | Input | Expected Error |
|---|----------|-------|----------------|
| 1 | POS sale exceeds batch stock | Sell 25 from B1 (only 15 remaining after step 4) | "Only 15 available in batch B1" |
| 2 | POS sale with sold serial | Try to sell SN-003 again | "Serial SN-003 is not available (current status: SOLD)" |
| 3 | Transfer more than godown-batch stock | Transfer 30 of B2 from Main (only 25 after step 15) | "Only 25 available in Main Store for batch B2" |
| 4 | Transfer serial in wrong godown | Transfer SN-005 from Main Store (it's now in Warehouse) | "Serial SN-005 is not in Main Store" |
| 5 | Stock verification during active transfers | Start verification while transfer is processing | Either: queue verification after transfer, or warning about in-flight transfers |
| 6 | POS sale from non-default godown without selection | Sell without specifying godown (multiple exist) | Godown selection required, or defaults to user's assigned godown |
| 7 | Adjust stock verification then retry POS with old cart | Cart had 20 units, stock adjusted down to 15 | On checkout: "Stock changed. Only 15 available for Product A" |

### 3c. Edge Cases

| # | Scenario | Steps | Expected Behavior |
|---|----------|-------|-------------------|
| 1 | Sell entire batch stock via POS | Sell all 15 remaining from B1 | B1 stock = 0, batch status = "depleted", still visible in history |
| 2 | Sell all serials of a product | Sell all 10 serials of Product B | Product B stock = 0, all serials SOLD, POS shows "Out of stock" |
| 3 | Transfer batch to godown, then sell from that godown | Transfer B2 to Warehouse, open POS for Warehouse, sell from B2 | B2 Warehouse stock decrements correctly |
| 4 | Stock verification with batch counts | Verify Main Store, count batch B1 = 13 (system = 15) | Batch-level variance = -2, adjustment updates B1 specifically |
| 5 | Stock verification with serial check | Verify Main Store, SN-007 not found | SN-007 marked MISSING, investigation record created |
| 6 | Concurrent POS sale and transfer | POS selling Product C while transfer in progress | One operation completes, other gets updated stock or conflict error |
| 7 | Return serial, then re-sell via POS | Return SN-003, it becomes AVAILABLE, sell again | SN-003 available in POS serial picker, sale succeeds, status SOLD again |
| 8 | Godown delete with batch/serial stock | Try to delete godown that has batch and serial stock | "Cannot delete godown with existing stock" |
| 9 | Rapid sequential operations | POS sale → transfer → verification in 30 seconds | All operations see consistent stock numbers |
| 10 | Product D (batch + serial) full flow | Add batch, add serials to batch, sell via POS selecting batch AND serial, verify | All tracking layers update correctly |

### 3d. State Transitions (Cross-Feature)

| Feature A State | Cross-Feature Action | Feature B State Change | Verify |
|----------------|---------------------|----------------------|--------|
| Batch B1: stock=20 | POS sale qty=5 from B1 | Batch B1: stock=15 | API: B1.currentStock = 15 |
| Serial SN-003: AVAILABLE | POS sale with SN-003 | Serial SN-003: SOLD | API: SN-003.status = "SOLD" |
| Main Store: Product C = 100 | Godown transfer qty=10 to Warehouse | Main: 90, Warehouse: 60 | API: both godown stocks correct |
| Serial SN-005: godown=Main | Godown transfer to Warehouse | Serial SN-005: godown=Warehouse | API: SN-005.godownId = warehouseId |
| Product A: stock=50 (Main) | Stock verification: physical=48, adjust | Product A: stock=48 (Main) | API: product stock = 48 in Main |
| Batch B1: stock=15 | Stock verification: physical=13, adjust | Batch B1: stock=13 | API: B1.currentStock = 13 |
| Serial SN-003: SOLD | Return processed | Serial SN-003: RETURNED | API: SN-003.status = "RETURNED" |
| Serial SN-003: RETURNED | Restocked | Serial SN-003: AVAILABLE | API: SN-003.status = "AVAILABLE" |

---

## 4. API Contracts

No new APIs. This TSD tests the interaction between existing APIs:

| Operation | APIs Involved | Consistency Check |
|-----------|--------------|-------------------|
| POS batch sale | POST /api/pos/quick-sale + GET /api/batches | Batch stock decremented |
| POS serial sale | POST /api/pos/quick-sale + GET /api/serial-numbers/:id | Serial status = SOLD |
| Godown transfer | POST /api/godowns/transfer + GET /api/godowns/:id/stock | Both godown stocks updated |
| Godown batch transfer | POST /api/godowns/transfer + GET /api/batches | Batch godown stock moved |
| Stock adjust | POST /api/stock-verification/:id/adjust + GET /api/products/:id | Product stock matches physical |
| Serial return → POS | PUT /api/serial-numbers/:id (RETURNED) + POST /api/pos/quick-sale | Serial available again for sale |

---

## 5. Visual Checkpoints

| Interaction | Viewport | What to Check |
|------------|----------|---------------|
| POS batch picker (after transfer) | 375x812 | Batch list reflects transferred quantities, godown shown per batch |
| POS serial picker (after sale) | 375x812 | Sold serials removed from list, count matches available |
| Godown detail (after POS sale) | 375x812 | Stock quantities reflect sales from that godown |
| Stock verification (after sales + transfers) | 375x812 | System qty column reflects all prior operations |
| Variance report (after cross-feature ops) | 375x812 | Variances calculated against latest system stock, not original |
| Serial lookup (after full lifecycle) | 375x812 | Complete history: Created → Sold → Returned → Available → Sold |

---

## 6. Accessibility Requirements

| # | Requirement | Implementation |
|---|------------|----------------|
| 1 | Cross-feature navigation logical | Breadcrumbs reflect path: POS → Receipt → Serial Detail |
| 2 | Status changes announced across features | Selling a serial in POS announces "Serial SN-003 marked as sold" |
| 3 | Error messages reference source feature | "Stock changed due to transfer" not just "Stock changed" |
| 4 | Batch/serial modals in POS accessible | Focus trapped, Escape closes, screen reader announces product context |

---

## 7. Performance Budgets

| Metric | Budget | Measurement |
|--------|--------|-------------|
| POS sale with batch + serial (API) | < 800ms (p95) | Network tab (includes stock update + serial update) |
| Godown transfer with batch items (API) | < 1s (p95) | Network tab (transaction with multiple updates) |
| Stock adjustment for 100 products (API) | < 3s (p95) | Network tab (batch update in transaction) |
| Stock verification load after sales (API) | < 1s (p95) | Network tab (joins with current stock) |
| Cross-feature data consistency | 0 stale reads | Verify after each operation with fresh API call |

---

## 8. Security Checks

| # | Check | Expected |
|---|-------|----------|
| 1 | POS sale decrements stock atomically | No race between sale and stock check |
| 2 | Transfer and sale cannot both succeed for last unit | Optimistic locking or row-level lock prevents oversell |
| 3 | Stock adjustment creates audit trail | Adjustment reason, user, timestamp, before/after values logged |
| 4 | Serial state transitions enforce business rules across features | Cannot sell serial marked as DAMAGED even from POS |
| 5 | Cross-godown operations enforce ownership | Cannot transfer to another business's godown |
| 6 | All cross-feature operations are transactional | If serial update fails during POS sale, entire sale rolls back |

---

## 9. Pass/Fail Criteria

### Must Pass (P0 — blocks release)
- [ ] POS sale correctly decrements batch-specific stock
- [ ] POS sale correctly marks serial as SOLD
- [ ] Godown transfer correctly updates stock in both source and destination
- [ ] Godown transfer correctly moves batch stock between godowns
- [ ] Godown transfer correctly updates serial location
- [ ] Stock verification reflects stock after all prior POS sales and transfers
- [ ] Stock adjustment updates product, batch, and serial quantities/states
- [ ] Sold serials do not appear in POS serial picker
- [ ] Depleted batches do not allow further sales
- [ ] All cross-feature operations are atomic (all-or-nothing)

### Should Pass (P1 — degrades experience)
- [ ] Concurrent POS sale and transfer handled without data corruption
- [ ] Stock change warnings during verification
- [ ] Return → restock → re-sell lifecycle works end-to-end
- [ ] Product with both batch and serial tracking works correctly

### Nice to Pass (P2 — polish)
- [ ] Cross-feature audit trail shows complete history
- [ ] Dashboard reflects real-time stock after all operations
- [ ] Export reports include cross-feature adjustments
