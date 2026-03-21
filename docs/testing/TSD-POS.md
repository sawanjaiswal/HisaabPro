# Test Specification: POS Quick Sale

## 1. Feature Summary

POS Quick Sale provides a streamlined point-of-sale interface for rapid billing at retail counters. Users scan barcodes or search products, build a cart, apply discounts, select payment method, and generate a receipt — all optimized for speed. The interface is designed for touch-first use on tablets and phones, with keyboard shortcuts for desktop.

**Pages:** `/pos`
**Priority:** P0 (Phase 4)
**Depends on:** Products, Inventory, Batches, Serial Numbers, Godowns, Payment Tracking

---

## 2. Preconditions

| # | Condition | How to Set Up |
|---|-----------|---------------|
| 1 | User logged in with POS permission | Create user with `pos:create` role |
| 2 | At least 5 products exist with stock > 0 | Seed via API or UI |
| 3 | At least 2 products have barcodes assigned | Set barcode field on product |
| 4 | At least 1 product has batch tracking enabled | Enable batch tracking, create batch with stock |
| 5 | At least 1 product has serial number tracking | Create serial numbers in AVAILABLE state |
| 6 | Default godown is configured | Set in business settings |
| 7 | At least 2 payment methods enabled (Cash, UPI) | Configure in settings |
| 8 | Thermal printer configured (optional) | Set printer in POS settings |

---

## 3. Test Scenarios

### 3a. Happy Path

| Step | Action | Expected Result | Verify Method |
|------|--------|-----------------|---------------|
| 1 | Navigate to `/pos` | POS interface loads with search bar focused, empty cart, total = Rs 0.00 | Visual: search bar has focus ring |
| 2 | Type product name in search bar | Dropdown shows matching products within 300ms (debounced) | Network: GET /api/products/search?q=... fires after 300ms pause |
| 3 | Click a product from search results | Product added to cart with qty=1, cart total updates | DOM: cart item count = 1, total = product price |
| 4 | Click "+" on cart item | Quantity increments to 2, line total = price x 2 | DOM: qty input shows 2, line total doubled |
| 5 | Click "-" on cart item (qty=2) | Quantity decrements to 1 | DOM: qty input shows 1 |
| 6 | Type quantity "5" directly in qty input | Quantity updates to 5, line total = price x 5 | DOM: qty=5, total recalculated |
| 7 | Scan barcode (type in barcode field + Enter) | Product identified and added to cart (or qty incremented if already in cart) | Network: GET /api/products/barcode/:code returns product |
| 8 | Scan same barcode again | Existing cart item qty increments by 1 | DOM: qty increases, no duplicate row |
| 9 | Add a second different product | Two line items in cart, grand total = sum of both | DOM: 2 cart rows |
| 10 | Click discount icon on line item | Discount input appears (% or Rs toggle) | Visual: discount input visible |
| 11 | Enter 10% discount on line item | Line total recalculates: price x qty x 0.9 | DOM: discount shown, total updated |
| 12 | Click "Cart Discount" button | Overall discount input appears | Visual: cart-level discount field |
| 13 | Enter Rs 50 flat cart discount | Grand total reduces by Rs 50 | DOM: discount line shows -Rs 50.00 |
| 14 | Select customer from party search | Customer name appears in cart header, outstanding balance shown | DOM: customer badge visible |
| 15 | Click "Add Note" | Text area appears for sale note | Visual: note input visible |
| 16 | Type "Urgent order" in note field | Note saved to sale | DOM: note text visible |
| 17 | Click "Checkout" button | Checkout bottom sheet slides up with payment options | Visual: sheet visible with Cash/UPI/Credit |
| 18 | Select "Cash" payment method | Cash selected, amount field shows grand total | DOM: Cash highlighted |
| 19 | Enter received amount (more than total) | Change amount calculated and displayed | DOM: "Change: Rs X.XX" shown |
| 20 | Click "Complete Sale" | Sale processed, success animation plays | Network: POST /api/pos/quick-sale returns 201 |
| 21 | Receipt screen shows | Receipt with all items, discounts, payment, date | Visual: receipt layout correct |
| 22 | Click "Print Receipt" | Print dialog opens (or thermal print triggers) | System: print dialog or thermal command sent |
| 23 | Click "Share via WhatsApp" | WhatsApp share intent opens with receipt | System: share sheet / WhatsApp opens |
| 24 | Click "New Sale" | Cart clears, search bar focused, ready for next sale | DOM: cart empty, total = Rs 0.00 |
| 25 | Add batch-tracked product | Batch selection modal appears before adding to cart | Visual: batch picker with expiry dates |
| 26 | Select a batch | Product added with batch info shown in cart | DOM: batch number visible on line item |
| 27 | Add serial-tracked product | Serial number input/scan modal appears | Visual: serial entry modal |
| 28 | Enter/scan serial number | Product added with serial shown, serial marked as reserved | DOM: serial visible, Network: serial status check |

### 3b. Error Cases

| # | Scenario | Input | Expected Error |
|---|----------|-------|----------------|
| 1 | Search with no results | Query: "xyznonexistent" | "No products found" empty state with suggestion to check spelling |
| 2 | Invalid barcode | Barcode: "0000000000" | "Product not found for this barcode" toast (warning) |
| 3 | Quantity exceeds stock | Set qty to 999 (stock = 10) | "Only 10 in stock" error, qty reverts to max available |
| 4 | Quantity = 0 | Type "0" in qty field | Item removed from cart with undo toast (5s) |
| 5 | Negative quantity | Type "-1" in qty field | Input rejected, stays at previous value |
| 6 | Discount > 100% | Enter "150" in % discount | "Discount cannot exceed 100%" validation error |
| 7 | Discount > line total (flat) | Line total Rs 100, discount Rs 150 | "Discount cannot exceed item total" validation error |
| 8 | Checkout with empty cart | Click "Checkout" with no items | Button disabled; if somehow triggered: "Add items to cart first" |
| 9 | Network failure during sale | POST /api/pos/quick-sale fails (500) | "Sale failed. Your cart is saved." + Retry button. Cart preserved |
| 10 | Offline during sale | Device goes offline before checkout | Sale queued for sync, success shown with "Will sync when online" badge |
| 11 | Serial number already sold | Enter serial in SOLD state | "Serial XYZ is already sold" error, cannot add |
| 12 | Batch expired | Select expired batch | Warning: "This batch expired on DD/MM/YYYY. Continue?" confirmation |
| 13 | Concurrent stock depletion | Another user bought last item while in cart | On checkout: "Stock changed. Item X: only 3 available (you had 5)" |
| 14 | Session expired during POS | Token expires mid-sale | Auth redirect with cart preserved in sessionStorage, restore after login |
| 15 | Duplicate serial in cart | Scan same serial twice | "Serial XYZ is already in cart" toast, no duplicate |

### 3c. Edge Cases

| # | Scenario | Steps | Expected Behavior |
|---|----------|-------|-------------------|
| 1 | Single item sale | Add 1 item, checkout immediately | Sale completes, minimal receipt |
| 2 | 50+ items in cart | Add 50 different products | Cart scrolls smoothly, total correct, checkout works |
| 3 | Rs 0.50 rounding | Items totaling Rs 99.50 | Display shows Rs 99.50, stored as 9950 paise |
| 4 | Very long product name | Product name 100+ chars | Truncated with ellipsis in cart, full name on tap |
| 5 | Rapid barcode scanning | Scan 10 barcodes in 5 seconds | All products added correctly, no race conditions |
| 6 | Cart discount + line discounts | Both applied simultaneously | Cart discount applied AFTER line discounts |
| 7 | Switch customer mid-sale | Change customer after adding items | Prices remain (no customer-specific pricing in MVP) |
| 8 | Browser refresh during sale | F5 with items in cart | Cart restored from sessionStorage/IndexedDB |
| 9 | Split payment (Cash + UPI) | Pay Rs 500 cash + Rs 200 UPI | Both payment records created, total matches |
| 10 | Zero-price item (free sample) | Add product with Rs 0 price | Allowed, sale total can be Rs 0 |
| 11 | Maximum cart value | Cart total > Rs 10,00,000 | No overflow, Indian number formatting correct |
| 12 | Product with all tracking | Product with batch + serial + godown | All selection modals appear in sequence |
| 13 | Decimal quantity (kg items) | Enter 2.5 kg | Accepted for weight-based items, rejected for piece-based |
| 14 | Back button during checkout | Press back while checkout sheet open | Sheet closes, cart preserved |
| 15 | Multiple tabs open | Open /pos in two tabs | Each tab has independent cart, no conflicts |

### 3d. State Transitions

| From | Action | To | Verify |
|------|--------|----|--------|
| Empty Cart | Add product | Cart with items | Cart item count > 0, checkout enabled |
| Cart with items | Remove all items | Empty Cart | "Cart is empty" message, checkout disabled |
| Cart with items | Click Checkout | Checkout Sheet open | Payment options visible, total shown |
| Checkout Sheet | Click back/overlay | Cart with items | Sheet dismissed, cart unchanged |
| Checkout Sheet | Complete Sale | Receipt Screen | Sale saved, stock decremented |
| Receipt Screen | New Sale | Empty Cart | Fresh POS interface |
| Any state | Network loss | Offline mode | Offline banner shown, local operations continue |
| Offline mode | Network restored | Online mode | Pending sales sync, banner removed |

---

## 4. API Contracts

| Method | Endpoint | Request Body | Success Response | Status |
|--------|----------|-------------|------------------|--------|
| GET | `/api/products/search?q={query}&limit=10` | — | `{ success: true, data: Product[] }` | 200 |
| GET | `/api/products/barcode/:code` | — | `{ success: true, data: Product }` | 200 |
| GET | `/api/products/barcode/:code` (not found) | — | `{ success: false, error: { code: "NOT_FOUND", message: "..." } }` | 404 |
| POST | `/api/pos/quick-sale` | `{ items: CartItem[], customerId?: string, discounts: Discount[], payments: Payment[], note?: string, godownId: string }` | `{ success: true, data: { saleId: string, invoiceNumber: string, receiptUrl: string } }` | 201 |
| POST | `/api/pos/quick-sale` (insufficient stock) | Same as above | `{ success: false, error: { code: "INSUFFICIENT_STOCK", message: "...", details: StockIssue[] } }` | 409 |
| GET | `/api/pos/recent-sales?cursor={id}&limit=20` | — | `{ success: true, data: Sale[], nextCursor: string \| null }` | 200 |

**CartItem shape:**
```typescript
{
  productId: string;
  quantity: number;       // integer for piece, decimal for weight
  unitPrice: number;      // paise
  discount?: { type: 'percentage' | 'flat'; value: number };
  batchId?: string;
  serialNumbers?: string[];
  godownId?: string;
}
```

---

## 5. Visual Checkpoints

| Page / State | Viewport | What to Check |
|-------------|----------|---------------|
| POS — Empty | 375x812 | Search bar top, barcode icon right, empty cart illustration, "Scan or search to start" text |
| POS — Empty | 768x1024 | Two-column: product search left, cart right |
| POS — Empty | 1280x720 | Three-column: categories left, products center, cart right |
| POS — Cart filled | 375x812 | Cart items scrollable, sticky total bar at bottom, checkout button full-width |
| POS — Cart filled | 320x568 | No horizontal overflow, product names truncate, prices visible |
| Checkout Sheet | 375x812 | Bottom sheet with payment methods as cards, amount input, "Complete Sale" button |
| Receipt | 375x812 | Receipt-style layout: business name, items table, totals, payment, footer |
| Receipt | 58mm (thermal) | Narrow receipt format, no cut-off text, barcode/QR at bottom |
| Search Results | 375x812 | Dropdown below search, product image thumbnail, name, price, stock badge |
| Batch Picker | 375x812 | Modal with batch list: batch#, expiry date, available qty, select button |
| Serial Entry | 375x812 | Modal with scan input, list of entered serials, remove button per serial |
| Offline Banner | All | Yellow/amber banner at top: "You're offline. Sales will sync when connected." |

---

## 6. Accessibility Requirements

| # | Requirement | Implementation |
|---|------------|----------------|
| 1 | Search bar has label | `aria-label="Search products by name or barcode"` |
| 2 | Cart items are a list | `<ul role="list">` with `<li>` per item |
| 3 | Quantity +/- buttons labeled | `aria-label="Increase quantity"` / `aria-label="Decrease quantity"` |
| 4 | Checkout sheet is a dialog | `role="dialog"` with `aria-modal="true"`, focus trapped |
| 5 | Payment method selection | Radio group with `role="radiogroup"`, each option `role="radio"` |
| 6 | Success announcement | `aria-live="polite"` region announces "Sale completed successfully" |
| 7 | Error announcements | `aria-live="assertive"` for stock errors, validation errors |
| 8 | Touch targets | All buttons >= 44x44px, spacing >= 8px between targets |
| 9 | Keyboard shortcuts | Enter = add to cart, Esc = close modals, Tab = navigate, F2 = barcode focus |
| 10 | High contrast | All text passes WCAG AA (4.5:1 ratio), prices pass AAA |

---

## 7. Performance Budgets

| Metric | Budget | Measurement |
|--------|--------|-------------|
| Barcode lookup (API) | < 100ms (p95) | Network tab, server logs |
| Product search (API) | < 150ms (p95) | Network tab with 300ms debounce |
| Cart update (add/remove/qty change) | < 200ms (UI response) | Performance.mark() around state update + render |
| Checkout complete (API) | < 500ms (p95) | Network tab, POST /api/pos/quick-sale |
| POS page initial load | < 2s (LCP) | Lighthouse, Web Vitals |
| Cart with 50 items scroll | 60fps | Performance monitor, no jank |
| Receipt render | < 300ms | Time from sale complete to receipt visible |
| Barcode scan → cart add | < 500ms (end-to-end) | Stopwatch: scan to item appearing in cart |
| Bundle size (POS chunk) | < 80KB gzipped | Build output, vite-bundle-visualizer |
| Memory (after 50 sales) | < 100MB heap | DevTools Memory tab, no leaks between sales |

---

## 8. Security Checks

| # | Check | Expected |
|---|-------|----------|
| 1 | POS endpoint requires auth | 401 without token |
| 2 | POS requires `pos:create` permission | 403 without permission |
| 3 | Sale amount cannot be tampered | Server recalculates total from product prices, ignores client total |
| 4 | Price from server, not client | unitPrice in request validated against DB product price |
| 5 | Stock validated server-side | Server checks stock before decrementing, rejects if insufficient |
| 6 | Serial ownership validated | Serial must belong to the product and be AVAILABLE |
| 7 | Rate limit on sale creation | Max 30 sales/min per user (prevents scripted abuse) |
| 8 | No PII in receipt URL | Receipt URL uses UUID, not sequential ID |
| 9 | Input sanitization | Product search query sanitized (no SQL injection via Prisma, no XSS in display) |
| 10 | Offline sale integrity | Offline sales signed with device key, validated on sync |

---

## 9. Pass/Fail Criteria

### Must Pass (P0 — blocks release)
- [ ] Barcode scan adds correct product to cart
- [ ] Cart total calculates correctly with discounts (paise precision)
- [ ] Sale creates invoice and decrements stock atomically
- [ ] Batch-tracked products require batch selection
- [ ] Serial-tracked products require serial entry and validate state
- [ ] Offline sale queues and syncs correctly
- [ ] Receipt displays all sale details accurately
- [ ] No horizontal scroll on 320px viewport
- [ ] All touch targets >= 44px
- [ ] Barcode lookup < 100ms (p95)

### Should Pass (P1 — degrades experience)
- [ ] Cart persists across browser refresh
- [ ] Split payment works correctly
- [ ] Keyboard shortcuts functional
- [ ] Thermal print format correct (58mm/80mm)
- [ ] 50-item cart scrolls at 60fps

### Nice to Pass (P2 — polish)
- [ ] Sale success micro-animation
- [ ] WhatsApp share generates correct message
- [ ] Recent sales list loads with cursor pagination
- [ ] Customer search shows outstanding balance
