# Mission Plan: Dashboard & Reports | Status: Awaiting Approval

> **PRD #7** | **Date:** 2026-03-14
> **Owner:** Sawan Jaiswal
> **Module:** 1G — Dashboard & Reports (Features #50–#55)
> **Depends On:** Party Management (#11–#17), Invoicing (#18–#34), Payments (#40–#43), Inventory (#44–#49)
> **Complexity:** MEDIUM (aggregation of existing data, no new core entities)

---

## 1. What

Six screens that give business owners instant visibility into their business — from a glanceable home dashboard to detailed, filterable, exportable reports. Every screen works fully offline from IndexedDB/Dexie data. No new domain entities are created; all screens aggregate data from parties, invoices, payments, and inventory.

### Features

| # | Feature | Roadmap Ref | Complexity |
|---|---------|-------------|------------|
| 1 | Dashboard (home screen, business summary, quick actions) | #50 | LOW |
| 2 | Sale/Purchase Reports (filterable, groupable, exportable) | #51 | MEDIUM |
| 3 | Party Statements (per-party transaction history with running balance) | #52 | LOW |
| 4 | Stock Summary Report (current stock, value, filters) | #53 | MEDIUM |
| 5 | Day Book (all transactions for a day, chronological) | #54 | LOW |
| 6 | Payment History Report (all payments, filterable by mode/type) | #55 | LOW |

### Key Constraints

- Dashboard loads in < 2 seconds on a Rs 8,000 phone with 2G
- All reports work 100% offline (computed from local IndexedDB data)
- Reports support cursor-based pagination (20 rows default, configurable)
- Export formats: PDF (always), Excel (.xlsx), CSV
- Share via: WhatsApp, Email (PDF attachment)
- All amounts in INR, formatted as Rs XX,XX,XXX.XX (Indian number system)
- Date format follows user setting (default DD/MM/YYYY)

---

## 2. Domain Model

No new entities. This module is a **read-only aggregation layer** over existing domain models.

### Source Entities (defined in other PRDs)

```
Party (customer | supplier)
  ├── id, name, phone, type, groupId, creditLimit, openingBalance, openingBalanceDate
  └── addresses[], customFields[]

Invoice (sale | purchase | estimate | proforma | challan | purchaseOrder | saleOrder)
  ├── id, number, type, date, dueDate, partyId, status
  ├── lineItems[] → { productId, qty, rate, discount, amount }
  ├── additionalCharges[] → { label, amount }
  └── subtotal, discountTotal, taxTotal, roundOff, grandTotal, amountPaid, balanceDue

Payment
  ├── id, date, partyId, invoiceId (nullable), type (in | out)
  ├── mode (cash | upi | bank_transfer | cheque), amount
  └── reference, notes

Product
  ├── id, name, categoryId, unit, purchasePrice, salePrice
  ├── openingStock, currentStock, minStockLevel
  └── customFields[]

StockMovement
  ├── id, productId, type (sale | purchase | adjustment | return)
  ├── qty, date, referenceId, referenceType
  └── notes
```

### Aggregation Indexes Needed (IndexedDB compound indexes for offline perf)

```
invoices:    [date], [type+date], [partyId+date], [status+date]
payments:    [date], [partyId+date], [mode+date], [type+date]
products:    [categoryId], [currentStock]
lineItems:   [invoiceId], [productId+date]
```

These compound indexes ensure dashboard and report queries complete in < 100ms on IndexedDB even with 50,000+ records.

---

## 3. User Flows

### Flow 1: View Dashboard

```
Open App → PIN/Biometric unlock
    │
    ├─→ Dashboard (home tab, bottom nav)
    │       │
    │       ├─→ Date Range Toggle: [Today] [This Week] [This Month] [Custom]
    │       │       └─→ Custom → Date picker (from/to) → Apply
    │       │
    │       ├─→ Summary Cards (2×2 grid on mobile)
    │       │       ├─→ Sales: count + Rs amount (tap → Sale Report pre-filtered)
    │       │       ├─→ Purchases: count + Rs amount (tap → Purchase Report pre-filtered)
    │       │       ├─→ Receivable: Rs total outstanding (tap → Party list, sorted by outstanding)
    │       │       └─→ Payable: Rs total outstanding (tap → Supplier list, sorted by outstanding)
    │       │
    │       ├─→ Top 5 Customers by Outstanding (list)
    │       │       ├─→ Each: name · Rs amount · days overdue
    │       │       ├─→ Tap row → Party Statement
    │       │       └─→ "View All" → Full outstanding list
    │       │
    │       ├─→ Quick Actions (horizontal scroll, 4 pill buttons)
    │       │       ├─→ + New Invoice
    │       │       ├─→ + Record Payment
    │       │       ├─→ + Add Product
    │       │       └─→ + Add Party
    │       │
    │       └─→ Pull-to-refresh (mobile) / Refresh button (desktop)
    │               └─→ Re-queries IndexedDB → updates all widgets
    │
    └─→ [Empty State] First-time user, no transactions yet
            ├─→ "Welcome! Your dashboard will show business insights here."
            ├─→ Illustration (simple, brand-consistent)
            └─→ CTA: "Create Your First Invoice"
```

### Flow 2: Generate Sale/Purchase Report

```
Reports tab (bottom nav) → "Sales Report" or "Purchase Report"
    │
    ├─→ Filter Bar (sticky top, collapsible)
    │       ├─→ Date Range: [This Month ▼] → Today / This Week / This Month / Last Month / This FY / Custom
    │       ├─→ Party: [All ▼] → search/select party
    │       ├─→ Product: [All ▼] → search/select product
    │       ├─→ Status: [All ▼] → Paid / Unpaid / Partial
    │       └─→ "Apply Filters" button (mobile) / auto-apply on change (desktop)
    │
    ├─→ Group By Toggle: [None] [Day] [Week] [Month] [Party] [Product] [Category]
    │
    ├─→ Summary Bar (always visible below filters)
    │       ├─→ Total Invoices: XX
    │       ├─→ Total Amount: Rs XX,XX,XXX
    │       ├─→ Total Paid: Rs XX,XX,XXX
    │       └─→ Total Outstanding: Rs XX,XX,XXX
    │
    ├─→ Report Table / Card List
    │       ├─→ [If grouped] Group header: "March 2026 — 45 invoices — Rs 3,45,000"
    │       │       └─→ Expandable → shows individual rows
    │       ├─→ Each row: Date · Invoice # · Party · Items (count) · Amount · Paid · Balance
    │       ├─→ Tap row → Invoice detail screen
    │       └─→ Pagination: "Load more" button (cursor-based, 20 per page)
    │
    └─→ Export Actions (bottom sticky bar)
            ├─→ "PDF" → generates PDF → preview → share/save
            ├─→ "Excel" → generates .xlsx → share/save
            ├─→ "CSV" → generates .csv → share/save
            └─→ "Share" → WhatsApp / Email (attaches PDF)
```

### Flow 3: View Party Statement

```
Party list → Tap customer/supplier → "Statement" tab
    OR
Reports tab → "Party Statements" → Select party
    │
    ├─→ Party Header
    │       ├─→ Name · Phone · Group
    │       ├─→ Opening Balance: Rs XX,XXX (as of DD/MM/YYYY)
    │       └─→ Current Balance: Rs XX,XXX (receivable / payable)
    │
    ├─→ Filter: Date Range [All Time ▼] → Custom range
    │
    ├─→ Transaction List (chronological, newest first by default)
    │       ├─→ Each row:
    │       │       ├─→ Date · Type icon (invoice/payment/credit note/debit note)
    │       │       ├─→ Description: "Sale Invoice #INV-0042" or "Payment Received (UPI)"
    │       │       ├─→ Debit · Credit · Running Balance
    │       │       └─→ Tap → navigate to source document
    │       │
    │       └─→ Closing Balance row at bottom (bold)
    │
    └─→ Actions
            ├─→ "Share Statement" → PDF via WhatsApp / Email
            ├─→ "Download PDF"
            └─→ "Record Payment" → payment entry pre-filled with party
```

### Flow 4: View Stock Summary

```
Reports tab → "Stock Summary"
    │
    ├─→ Filter Bar
    │       ├─→ Category: [All ▼] → select category
    │       ├─→ Stock Status: [All ▼] → All / Low Stock / Out of Stock / In Stock
    │       └─→ Search: product name search
    │
    ├─→ Summary Bar
    │       ├─→ Total Products: XX
    │       ├─→ Total Stock Value (at purchase price): Rs XX,XX,XXX
    │       └─→ Total Stock Value (at sale price): Rs XX,XX,XXX
    │
    ├─→ Product List
    │       ├─→ Each row:
    │       │       ├─→ Product Name · Category
    │       │       ├─→ Qty in Hand (with unit, e.g., "45 pcs")
    │       │       ├─→ Purchase Value: Rs XX,XXX
    │       │       ├─→ Sale Value: Rs XX,XXX
    │       │       └─→ Status badge: 🔴 Out of Stock / 🟡 Low Stock / 🟢 In Stock
    │       │
    │       ├─→ Sort by: Name (A-Z) / Stock (low-high) / Value (high-low)
    │       └─→ Pagination: 20 per page, "Load more"
    │
    └─→ Export: PDF / Excel / CSV
```

### Flow 5: View Day Book

```
Reports tab → "Day Book"
    │
    ├─→ Date Selector
    │       ├─→ [< Prev Day] [DD/MM/YYYY — Day Name] [Next Day >]
    │       └─→ Tap date → calendar picker
    │
    ├─→ Filter: Type [All ▼] → Sale / Purchase / Payment In / Payment Out / Expense / Stock Adjustment
    │
    ├─→ Transaction List (chronological, earliest first)
    │       ├─→ Each row:
    │       │       ├─→ Time · Type badge (color-coded)
    │       │       ├─→ Description: "Sale to Rahul Traders — INV-0042"
    │       │       ├─→ Amount: Rs XX,XXX
    │       │       └─→ Tap → navigate to source document
    │       │
    │       └─→ Summary Footer (sticky bottom)
    │               ├─→ Total Sales: Rs XX,XXX (X invoices)
    │               ├─→ Total Purchases: Rs XX,XXX (X invoices)
    │               ├─→ Payments In: Rs XX,XXX
    │               ├─→ Payments Out: Rs XX,XXX
    │               └─→ Net Cash Flow: Rs ±XX,XXX
    │
    └─→ Export: PDF (single day summary)
```

### Flow 6: View Payment History

```
Reports tab → "Payment History"
    │
    ├─→ Filter Bar
    │       ├─→ Date Range: [This Month ▼]
    │       ├─→ Party: [All ▼]
    │       ├─→ Mode: [All ▼] → Cash / UPI / Bank Transfer / Cheque
    │       └─→ Type: [All ▼] → Payment In / Payment Out
    │
    ├─→ Group By Toggle: [None] [Day] [Party] [Mode]
    │
    ├─→ Summary Bar
    │       ├─→ Total Received: Rs XX,XX,XXX
    │       ├─→ Total Paid: Rs XX,XX,XXX
    │       └─→ Net: Rs ±XX,XX,XXX
    │
    ├─→ Payment List
    │       ├─→ [If grouped] Group header with subtotal
    │       ├─→ Each row:
    │       │       ├─→ Date · Party Name
    │       │       ├─→ Mode badge (Cash/UPI/Bank/Cheque)
    │       │       ├─→ Amount (green for in, red for out)
    │       │       ├─→ Reference (if any)
    │       │       └─→ Linked invoice (if any) → tap to navigate
    │       └─→ Pagination: 20 per page
    │
    └─→ Export: PDF / Excel / CSV
```

---

## 4. API Contract

All endpoints serve two purposes:
1. **Online mode** — called from frontend when server is reachable
2. **Offline mode** — identical logic runs locally against IndexedDB using the same query shape

The frontend report engine accepts the same filter/pagination params and queries Dexie directly. The API exists for server-rendered exports and multi-device consistency.

**Base URL:** `/api/v1`
**Auth:** Bearer token (JWT) in `Authorization` header
**Response format:** `{ success: boolean, data: T, meta?: { cursor, hasMore, total } }`

### 4.1 Dashboard Stats

```
GET /api/v1/dashboard/stats
```

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `range` | enum | No | `today` | `today` \| `this_week` \| `this_month` \| `custom` |
| `from` | ISO date | If custom | — | Start date (inclusive) |
| `to` | ISO date | If custom | — | End date (inclusive) |

**Response:**

```json
{
  "success": true,
  "data": {
    "range": { "from": "2026-03-14", "to": "2026-03-14", "label": "Today" },
    "sales": {
      "count": 12,
      "amount": 45600.00
    },
    "purchases": {
      "count": 3,
      "amount": 22000.00
    },
    "receivable": {
      "total": 187500.00,
      "partyCount": 34
    },
    "payable": {
      "total": 56000.00,
      "partyCount": 8
    },
    "topOutstandingCustomers": [
      {
        "partyId": "p_abc123",
        "name": "Rahul Traders",
        "phone": "9876543210",
        "outstanding": 45000.00,
        "oldestDueDate": "2026-02-10",
        "daysOverdue": 32
      }
    ],
    "paymentsReceived": 32000.00,
    "paymentsMade": 15000.00,
    "netCashFlow": 17000.00
  }
}
```

### 4.2 Sale/Purchase Report

```
GET /api/v1/reports/invoices
```

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `type` | enum | Yes | — | `sale` \| `purchase` |
| `from` | ISO date | No | First day of current month | Start date |
| `to` | ISO date | No | Today | End date |
| `partyId` | string | No | — | Filter by party |
| `productId` | string | No | — | Filter by product (matches line items) |
| `status` | enum | No | — | `paid` \| `unpaid` \| `partial` |
| `groupBy` | enum | No | `none` | `none` \| `day` \| `week` \| `month` \| `party` \| `product` \| `category` |
| `sortBy` | enum | No | `date_desc` | `date_asc` \| `date_desc` \| `amount_asc` \| `amount_desc` |
| `cursor` | string | No | — | Cursor for pagination (opaque, from previous response) |
| `limit` | number | No | 20 | Items per page (max 100) |

**Response (groupBy = none):**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalInvoices": 156,
      "totalAmount": 845600.00,
      "totalPaid": 623400.00,
      "totalOutstanding": 222200.00,
      "totalDiscount": 12500.00
    },
    "items": [
      {
        "id": "inv_abc123",
        "number": "INV-0042",
        "date": "2026-03-14",
        "partyId": "p_abc123",
        "partyName": "Rahul Traders",
        "itemCount": 5,
        "amount": 12500.00,
        "paid": 10000.00,
        "balance": 2500.00,
        "status": "partial"
      }
    ]
  },
  "meta": {
    "cursor": "eyJpZCI6Imludl9hYmMxMjMiLCJkYXRlIjoiMjAyNi0wMy0xNCJ9",
    "hasMore": true,
    "total": 156
  }
}
```

**Response (groupBy = month):**

```json
{
  "success": true,
  "data": {
    "summary": { "...same as above..." },
    "groups": [
      {
        "key": "2026-03",
        "label": "March 2026",
        "invoiceCount": 45,
        "totalAmount": 345000.00,
        "totalPaid": 280000.00,
        "totalOutstanding": 65000.00,
        "items": [
          { "...same row shape as ungrouped..." }
        ]
      }
    ]
  },
  "meta": { "cursor": "...", "hasMore": true, "total": 156 }
}
```

### 4.3 Party Statement

```
GET /api/v1/reports/party-statement/:partyId
```

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `from` | ISO date | No | Party opening balance date | Start date |
| `to` | ISO date | No | Today | End date |
| `cursor` | string | No | — | Pagination cursor |
| `limit` | number | No | 50 | Items per page (max 200) |

**Response:**

```json
{
  "success": true,
  "data": {
    "party": {
      "id": "p_abc123",
      "name": "Rahul Traders",
      "phone": "9876543210",
      "type": "customer"
    },
    "openingBalance": {
      "amount": 5000.00,
      "type": "receivable",
      "asOfDate": "2026-01-01"
    },
    "closingBalance": {
      "amount": 12500.00,
      "type": "receivable",
      "asOfDate": "2026-03-14"
    },
    "transactions": [
      {
        "id": "txn_abc123",
        "date": "2026-03-14",
        "type": "sale_invoice",
        "reference": "INV-0042",
        "referenceId": "inv_abc123",
        "description": "Sale Invoice #INV-0042",
        "debit": 12500.00,
        "credit": 0,
        "runningBalance": 17500.00
      },
      {
        "id": "txn_def456",
        "date": "2026-03-14",
        "type": "payment_received",
        "reference": "PAY-0018",
        "referenceId": "pay_def456",
        "description": "Payment Received (UPI)",
        "debit": 0,
        "credit": 5000.00,
        "runningBalance": 12500.00
      }
    ],
    "totals": {
      "totalDebit": 45000.00,
      "totalCredit": 37500.00
    }
  },
  "meta": { "cursor": "...", "hasMore": false, "total": 28 }
}
```

**Transaction types in statement:** `sale_invoice`, `purchase_invoice`, `payment_received`, `payment_made`, `credit_note`, `debit_note`, `opening_balance`

### 4.4 Stock Summary Report

```
GET /api/v1/reports/stock-summary
```

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `categoryId` | string | No | — | Filter by category |
| `stockStatus` | enum | No | — | `low` \| `out_of_stock` \| `in_stock` |
| `search` | string | No | — | Search product name (case-insensitive, partial match) |
| `sortBy` | enum | No | `name_asc` | `name_asc` \| `name_desc` \| `stock_asc` \| `stock_desc` \| `value_asc` \| `value_desc` |
| `cursor` | string | No | — | Pagination cursor |
| `limit` | number | No | 20 | Items per page (max 100) |

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalProducts": 234,
      "totalStockValueAtPurchase": 567800.00,
      "totalStockValueAtSale": 789200.00,
      "lowStockCount": 12,
      "outOfStockCount": 3
    },
    "items": [
      {
        "productId": "prod_abc123",
        "name": "Tata Salt 1kg",
        "category": "Groceries",
        "unit": "pcs",
        "currentStock": 45,
        "minStockLevel": 10,
        "purchasePrice": 22.00,
        "salePrice": 28.00,
        "stockValueAtPurchase": 990.00,
        "stockValueAtSale": 1260.00,
        "stockStatus": "in_stock"
      }
    ]
  },
  "meta": { "cursor": "...", "hasMore": true, "total": 234 }
}
```

### 4.5 Day Book

```
GET /api/v1/reports/day-book
```

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `date` | ISO date | No | Today | The day to show |
| `type` | enum | No | — | `sale` \| `purchase` \| `payment_in` \| `payment_out` \| `expense` \| `stock_adjustment` |
| `cursor` | string | No | — | Pagination cursor |
| `limit` | number | No | 50 | Items per page (max 200) |

**Response:**

```json
{
  "success": true,
  "data": {
    "date": "2026-03-14",
    "dayLabel": "Saturday, 14 March 2026",
    "summary": {
      "totalSales": { "count": 12, "amount": 45600.00 },
      "totalPurchases": { "count": 3, "amount": 22000.00 },
      "paymentsIn": { "count": 8, "amount": 32000.00 },
      "paymentsOut": { "count": 2, "amount": 15000.00 },
      "expenses": { "count": 1, "amount": 500.00 },
      "stockAdjustments": { "count": 0, "amount": 0 },
      "netCashFlow": 17000.00
    },
    "transactions": [
      {
        "id": "txn_abc123",
        "time": "09:15",
        "type": "sale",
        "description": "Sale to Rahul Traders",
        "reference": "INV-0042",
        "referenceId": "inv_abc123",
        "partyName": "Rahul Traders",
        "amount": 12500.00
      },
      {
        "id": "txn_def456",
        "time": "10:30",
        "type": "payment_in",
        "description": "Payment from Sharma Electronics",
        "reference": "PAY-0018",
        "referenceId": "pay_def456",
        "partyName": "Sharma Electronics",
        "amount": 5000.00,
        "mode": "upi"
      }
    ],
    "navigation": {
      "prevDate": "2026-03-13",
      "nextDate": null
    }
  },
  "meta": { "cursor": "...", "hasMore": false, "total": 26 }
}
```

### 4.6 Payment History Report

```
GET /api/v1/reports/payments
```

**Query Parameters:**

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `from` | ISO date | No | First day of current month | Start date |
| `to` | ISO date | No | Today | End date |
| `partyId` | string | No | — | Filter by party |
| `mode` | enum | No | — | `cash` \| `upi` \| `bank_transfer` \| `cheque` |
| `type` | enum | No | — | `in` \| `out` |
| `groupBy` | enum | No | `none` | `none` \| `day` \| `party` \| `mode` |
| `sortBy` | enum | No | `date_desc` | `date_asc` \| `date_desc` \| `amount_asc` \| `amount_desc` |
| `cursor` | string | No | — | Pagination cursor |
| `limit` | number | No | 20 | Items per page (max 100) |

**Response (groupBy = none):**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalReceived": 245000.00,
      "totalPaid": 98000.00,
      "net": 147000.00,
      "countIn": 45,
      "countOut": 12
    },
    "items": [
      {
        "id": "pay_abc123",
        "date": "2026-03-14",
        "partyId": "p_abc123",
        "partyName": "Rahul Traders",
        "type": "in",
        "mode": "upi",
        "amount": 5000.00,
        "reference": "UPI-TXN-123456",
        "invoiceId": "inv_abc123",
        "invoiceNumber": "INV-0042",
        "notes": ""
      }
    ]
  },
  "meta": { "cursor": "...", "hasMore": true, "total": 57 }
}
```

**Response (groupBy = mode):**

```json
{
  "success": true,
  "data": {
    "summary": { "...same as above..." },
    "groups": [
      {
        "key": "cash",
        "label": "Cash",
        "totalReceived": 120000.00,
        "totalPaid": 45000.00,
        "count": 32,
        "items": [ "...same row shape..." ]
      },
      {
        "key": "upi",
        "label": "UPI",
        "totalReceived": 85000.00,
        "totalPaid": 23000.00,
        "count": 18,
        "items": [ "...same row shape..." ]
      }
    ]
  },
  "meta": { "cursor": "...", "hasMore": false, "total": 57 }
}
```

### 4.7 Export Endpoint (shared across all reports)

```
POST /api/v1/reports/export
```

**Request Body:**

```json
{
  "reportType": "invoices" | "party-statement" | "stock-summary" | "day-book" | "payments",
  "format": "pdf" | "xlsx" | "csv",
  "filters": {
    "...same query params as the corresponding GET endpoint..."
  },
  "options": {
    "includeHeader": true,
    "businessName": "Sharma Electronics",
    "logo": true,
    "dateFormat": "DD/MM/YYYY"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "fileUrl": "/api/v1/reports/export/download/exp_abc123",
    "fileName": "Sales_Report_March_2026.pdf",
    "fileSize": 45678,
    "expiresAt": "2026-03-14T23:59:59Z"
  }
}
```

**Offline export:** When offline, the frontend generates the PDF/Excel/CSV locally using client-side libraries (jsPDF for PDF, SheetJS for Excel/CSV). The export endpoint is only used when online for server-rendered exports with business logo/branding.

---

## 5. Data Model

No new database tables. Performance optimizations only.

### 5.1 PostgreSQL Indexes (for server-side report queries)

```sql
-- Invoices: date range + type queries
CREATE INDEX idx_invoices_type_date ON invoices (type, date DESC);
CREATE INDEX idx_invoices_party_date ON invoices (party_id, date DESC);
CREATE INDEX idx_invoices_status_date ON invoices (status, date DESC);
CREATE INDEX idx_invoices_date_type_status ON invoices (date DESC, type, status);

-- Payments: date range + mode + type queries
CREATE INDEX idx_payments_date ON payments (date DESC);
CREATE INDEX idx_payments_party_date ON payments (party_id, date DESC);
CREATE INDEX idx_payments_mode_date ON payments (mode, date DESC);
CREATE INDEX idx_payments_type_date ON payments (type, date DESC);

-- Line items: product-level aggregation
CREATE INDEX idx_line_items_product_id ON invoice_line_items (product_id);
CREATE INDEX idx_line_items_invoice_id ON invoice_line_items (invoice_id);

-- Products: category + stock filters
CREATE INDEX idx_products_category ON products (category_id);
CREATE INDEX idx_products_stock ON products (current_stock);
```

### 5.2 IndexedDB Indexes (Dexie — for offline report queries)

```typescript
// db.ts — Dexie schema additions for report performance
const db = new Dexie('HisaabApp');

db.version(X).stores({
  invoices: '++id, number, type, date, partyId, status, [type+date], [partyId+date], [status+date]',
  payments: '++id, date, partyId, type, mode, invoiceId, [partyId+date], [mode+date], [type+date]',
  invoiceLineItems: '++id, invoiceId, productId, [productId+invoiceId]',
  products: '++id, name, categoryId, currentStock, [categoryId+currentStock]',
  stockMovements: '++id, productId, type, date, [productId+date]',
});
```

### 5.3 Materialized Summary Cache (optional, for large datasets)

For businesses with 50,000+ invoices, pre-compute daily summaries:

```typescript
interface DailySummaryCache {
  date: string;             // YYYY-MM-DD
  salesCount: number;
  salesAmount: number;
  purchasesCount: number;
  purchasesAmount: number;
  paymentsInAmount: number;
  paymentsOutAmount: number;
  updatedAt: string;        // ISO timestamp
}
```

Stored in a `dailySummaries` IndexedDB table. Updated on every invoice/payment write. Dashboard reads from cache first, falls back to live query.

---

## 6. UI States

Every screen has exactly 4 states: Loading, Error, Empty, Success.

### 6.1 Dashboard

| State | Behavior |
|-------|----------|
| **Loading** | Skeleton shimmer: 4 summary cards (grey rectangles), 5 list items shimmer. No spinner. Duration < 2s. |
| **Error** | Red banner at top: "Couldn't load dashboard. Pull down to retry." Cards show "—" for amounts. Quick actions still work (they don't depend on data). |
| **Empty** | All cards show Rs 0. Top customers shows empty illustration: "No transactions yet." CTA: "Create Your First Invoice." Quick actions visible. |
| **Success** | All widgets populated. Amounts animate from 0 to final value (200ms ease-out). Pull-to-refresh indicator at top. |

### 6.2 Sale/Purchase Reports

| State | Behavior |
|-------|----------|
| **Loading** | Skeleton: summary bar (3 shimmer blocks) + 5 row skeletons. Filters are interactive during load. |
| **Error** | Inline error below filters: "Couldn't load report. Tap to retry." Filters still interactive. |
| **Empty (no data at all)** | Illustration + "No sales invoices yet. Create your first invoice to see reports here." |
| **Empty (filters yield no results)** | "No invoices match your filters." + "Clear Filters" button. |
| **Success** | Summary bar + scrollable list. "Load more" button at bottom when paginated. |

### 6.3 Party Statement

| State | Behavior |
|-------|----------|
| **Loading** | Party header visible (from cache), transaction list shows 5 shimmer rows. |
| **Error** | "Couldn't load statement. Tap to retry." Party header still visible. |
| **Empty** | "No transactions with [Party Name] yet." + "Create Invoice" CTA. Opening/closing balance show Rs 0 or opening balance only. |
| **Success** | Full transaction list with running balance. Actions bar visible. |

### 6.4 Stock Summary

| State | Behavior |
|-------|----------|
| **Loading** | Summary bar shimmer + 8 product row skeletons. |
| **Error** | "Couldn't load stock report. Tap to retry." |
| **Empty** | "No products added yet. Add your first product to track stock." + "Add Product" CTA. |
| **Empty (filter yields nothing)** | "No products match your filters." + "Clear Filters" button. |
| **Success** | Summary totals + scrollable product list with status badges. |

### 6.5 Day Book

| State | Behavior |
|-------|----------|
| **Loading** | Date header visible, summary footer shimmer, 5 transaction row skeletons. |
| **Error** | "Couldn't load day book. Tap to retry." Date navigation still works. |
| **Empty** | "No transactions on [Date]." + illustration. Prev/next navigation still works. Summary shows all Rs 0. |
| **Success** | Chronological list + sticky summary footer. |

### 6.6 Payment History

| State | Behavior |
|-------|----------|
| **Loading** | Summary bar shimmer + 5 payment row skeletons. |
| **Error** | "Couldn't load payment history. Tap to retry." |
| **Empty** | "No payments recorded yet." + "Record Payment" CTA. |
| **Empty (filter)** | "No payments match your filters." + "Clear Filters" button. |
| **Success** | Summary bar + grouped or flat list. |

### 6.7 Export States

| State | Behavior |
|-------|----------|
| **Generating** | Bottom sheet: "Generating PDF..." with progress indicator. Dismissible (generates in background). |
| **Success** | Bottom sheet: preview thumbnail + "Share" / "Save to Device" / "Open" buttons. |
| **Error** | "Couldn't generate report. Try again." + "Retry" button. |
| **Offline** | Uses client-side generation (jsPDF/SheetJS). Same UX, no "generating" delay — instant. |

---

## 7. Mobile

### 7.1 Dashboard Layout (375px — iPhone SE / budget Android)

```
┌─────────────────────────────┐
│  HisaabApp          🔔  👤  │  ← Top bar: app name, notifications, profile
├─────────────────────────────┤
│ [Today ▼] [Week] [Month]   │  ← Date range pills (horizontal scroll)
├──────────────┬──────────────┤
│  📈 Sales    │  📦 Purchases│  ← 2×2 grid, each card ~170px wide
│  12 invoices │  3 invoices  │
│  Rs 45,600   │  Rs 22,000   │
├──────────────┼──────────────┤
│  💰 Receivable│ 💸 Payable  │
│  Rs 1,87,500 │  Rs 56,000   │
│  34 parties  │  8 parties   │
├──────────────┴──────────────┤
│  Top Outstanding             │  ← Section header
│  ┌─────────────────────────┐│
│  │ Rahul Traders   Rs 45K  ││  ← Each row: name, amount, days badge
│  │                 32 days ││
│  ├─────────────────────────┤│
│  │ Sharma Elec.   Rs 32K   ││
│  │                 15 days ││
│  ├─────────────────────────┤│
│  │ ...3 more rows...       ││
│  └─────────────────────────┘│
│  [View All Outstanding →]   │
├─────────────────────────────┤
│ Quick Actions (scroll →)    │
│ [+ Invoice] [+ Payment]    │
│ [+ Product] [+ Party]      │
├─────────────────────────────┤
│ 🏠  📄  ➕  📊  ⚙️         │  ← Bottom nav: Home, Invoices, New, Reports, Settings
└─────────────────────────────┘
```

**Touch targets:** All tappable elements minimum 44×44px. Cards have 12px padding. Spacing between cards: 8px.

### 7.2 Report Tables on Mobile

Tables do not work well on 375px screens. Mobile reports use **card layout** instead:

**Invoice Report — Card Layout (mobile):**

```
┌─────────────────────────────┐
│ INV-0042          14/03/2026│
│ Rahul Traders       5 items │
│─────────────────────────────│
│ Amount: Rs 12,500           │
│ Paid: Rs 10,000  Due: Rs 2,500 │
│ [Partial ●]                 │
└─────────────────────────────┘
```

**Party Statement — Card Layout (mobile):**

```
┌─────────────────────────────┐
│ 📄 Sale Invoice #INV-0042  │
│ 14/03/2026                  │
│─────────────────────────────│
│ Debit: Rs 12,500            │
│ Balance: Rs 17,500          │
└─────────────────────────────┘
```

**Stock Summary — Card Layout (mobile):**

```
┌─────────────────────────────┐
│ Tata Salt 1kg      Groceries│
│─────────────────────────────│
│ Stock: 45 pcs    [🟢 OK]   │
│ Purchase: Rs 990             │
│ Sale: Rs 1,260              │
└─────────────────────────────┘
```

### 7.3 Tablet / Desktop (768px+)

On wider screens, switch from card layout to proper data tables:

| Date | Invoice # | Party | Items | Amount | Paid | Balance | Status |
|------|-----------|-------|-------|--------|------|---------|--------|

With horizontal scroll if columns exceed viewport. Sticky first column (date or party name).

### 7.4 Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| < 640px (mobile) | Card layout for all lists. 2×2 dashboard grid. Bottom sheet for filters. Single column. |
| 640–1024px (tablet) | Table layout with horizontal scroll. Dashboard cards in a row. Side sheet for filters. |
| > 1024px (desktop) | Full table layout. Dashboard widgets in single row. Filter sidebar always visible. |

### 7.5 Pull-to-Refresh

- Dashboard: pull-to-refresh re-queries all data from IndexedDB (or server if online)
- Reports: pull-to-refresh re-runs current query with current filters
- Haptic feedback on pull (Capacitor Haptics plugin)
- Custom refresh indicator (brand-colored spinner, not browser default)

---

## 8. Edge Cases

### 8.1 No Data Yet (new user)

| Screen | Behavior |
|--------|----------|
| Dashboard | All cards show Rs 0. Top customers section hidden. Quick actions prominently visible. Empty state illustration with "Create your first invoice to see your business summary here." |
| Reports | Each report shows its specific empty state with relevant CTA (see Section 6). |

### 8.2 Large Date Ranges

| Scenario | Handling |
|----------|----------|
| "This FY" with 50,000+ invoices | Cursor-based pagination. First page loads in < 2s. Summary computed from cached daily summaries. |
| Custom range spanning 2+ years | Warning: "Large date range selected. Report may take a few seconds." Still allowed. Pagination ensures no single response exceeds 100 items. |
| Export of 50,000+ rows | PDF: max 10,000 rows per export. Show "Export is limited to 10,000 rows. Use filters to narrow down." Excel/CSV: no limit (streamed). |

### 8.3 Timezone Handling

- All dates stored as **IST (Asia/Kolkata, UTC+5:30)** — HisaabApp is India-only
- No timezone conversion needed
- Date boundaries: midnight IST (00:00:00+05:30)
- "Today" = current date in IST regardless of device timezone (enforce via `Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata' })`)
- Server always returns dates as ISO strings in IST

### 8.4 Currency and Number Formatting

- All amounts in INR
- Indian number system: Rs 1,00,000 (not Rs 100,000)
- Formatter: `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`
- Negative amounts: shown as "- Rs 5,000" (red text)
- Zero amounts: "Rs 0" (not "Rs 0.00" on dashboard cards; "Rs 0.00" in report rows)

### 8.5 Offline Report Generation

| Scenario | Handling |
|----------|----------|
| User opens report offline | Queries IndexedDB directly. Same filters/pagination. Green "Offline" badge. |
| User exports PDF offline | Client-side generation using jsPDF. No business logo (unless cached). |
| User exports Excel offline | Client-side generation using SheetJS (xlsx). |
| Data not synced yet | Banner: "Some data may not be synced. Last sync: X mins ago." Still shows available local data. |

### 8.6 Concurrent Data Changes

| Scenario | Handling |
|----------|----------|
| New invoice created while viewing report | Report does NOT auto-refresh. Pull-to-refresh or "Refresh" button updates. Toast: "New transactions available. Pull to refresh." |
| Payment recorded while viewing party statement | Same as above — manual refresh required. |
| Dashboard auto-refresh | Dashboard does NOT auto-refresh while user is on screen. Only refreshes on: pull-to-refresh, tab switch back, app resume from background. |

### 8.7 Partial / Missing Data

| Scenario | Handling |
|----------|----------|
| Invoice with no party (deleted party) | Show "Unknown Party" in reports. Don't crash. |
| Payment not linked to invoice | Show in payment history with "—" for invoice column. |
| Product deleted but has historical invoices | Product name preserved in line items (denormalized at invoice creation time). Stock report excludes deleted products. |
| Opening balance without opening balance date | Default to business creation date. |

### 8.8 Export Edge Cases

| Scenario | Handling |
|----------|----------|
| No data to export | Disable export buttons. Tooltip: "No data to export." |
| Export fails mid-generation | "Export failed. Try again." + "Retry" button. Partial file is not saved. |
| Very long party/product names | Truncate in PDF at 40 chars with "...". Full names in Excel/CSV. |
| Unicode / Hindi characters in export | jsPDF with embedded Noto Sans font. SheetJS handles UTF-8 natively. |

---

## 9. Constraints

### 9.1 Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dashboard initial load | < 2 seconds | From tab tap to all widgets rendered (on Snapdragon 665, 4G) |
| Dashboard with cached data | < 500ms | Subsequent loads from daily summary cache |
| Report query (any report, any filter) | < 3 seconds | First page of 20 items. Measured on 50,000 invoice dataset. |
| Report pagination (load more) | < 1 second | Next 20 items from cursor |
| Party statement (full history) | < 2 seconds | First page of 50 transactions |
| Export PDF (up to 500 rows) | < 5 seconds | Client-side generation |
| Export PDF (500–10,000 rows) | < 15 seconds | Server-side generation |
| Export Excel/CSV (any size) | < 10 seconds | Client-side or server-side |

### 9.2 Data Limits

| Limit | Value | Reason |
|-------|-------|--------|
| Max rows per page (default) | 20 | Performance on low-end devices |
| Max rows per page (configurable) | 100 | API hard limit |
| Max party statement rows per page | 50 (default), 200 (max) | Statements tend to be longer |
| Max rows in PDF export | 10,000 | PDF size would exceed 50MB beyond this |
| Max rows in Excel/CSV export | No limit | Streamed, not buffered |
| Dashboard top customers | 5 | Fixed, not configurable |
| Daily summary cache retention | 365 days | Older summaries recomputed on demand |

### 9.3 Refresh Rates

| Trigger | Action |
|---------|--------|
| App launch / resume from background | Dashboard auto-refreshes |
| Tab switch to Dashboard | Dashboard auto-refreshes |
| Pull-to-refresh | Current screen refreshes |
| New invoice/payment saved | Dashboard does NOT auto-refresh (avoids jank). Toast notifies. |
| Real-time push | Not in Phase 1. Manual refresh only. |

### 9.4 Offline Storage Budget

| Data Type | Estimated Size (1 year, active business) | Notes |
|-----------|------------------------------------------|-------|
| 10,000 invoices | ~15 MB | With line items |
| 5,000 payments | ~3 MB | |
| 500 products | ~0.5 MB | |
| 1,000 parties | ~1 MB | |
| Daily summary cache | ~0.5 MB | 365 days |
| **Total** | **~20 MB** | Well within IndexedDB limits (typically 50-80% of disk) |

---

## 10. Out of Scope

These are explicitly NOT part of this PRD. They will be built in later phases.

| Feature | Phase | Why Not Now |
|---------|-------|-------------|
| Profit & Loss Statement | Phase 3 | Requires double-entry accounting ledger |
| Balance Sheet | Phase 3 | Requires double-entry accounting ledger |
| Cash Flow Report | Phase 3 | Requires bank account tracking |
| GST Reports (GSTR-1, GSTR-3B, GSTR-9) | Phase 2 | Requires GST invoice engine |
| Tax Reports (HSN summary, tax collected/paid) | Phase 2 | Requires tax categories |
| Aging Reports (30/60/90/120 days) | Phase 3 | Accounting-level feature |
| Profitability Reports (margin analysis) | Phase 3 | Requires COGS tracking |
| Tally Export | Phase 3 | Requires accounting data model |
| Bank Reconciliation | Phase 3 | Requires bank account integration |
| Batch/Serial wise stock report | Phase 4 | Requires batch/serial tracking |
| Multi-godown stock report | Phase 4 | Requires multi-godown feature |
| Staff performance / sales reports | Phase 5 | Requires staff management |
| Real-time dashboard (WebSocket push) | Phase 5+ | Manual refresh sufficient for Phase 1 |
| Custom report builder | Phase 5+ | Fixed reports cover 90% of needs |
| Scheduled report delivery (email/WhatsApp) | Phase 5+ | Nice-to-have, not MVP |
| Dashboard widgets customization (drag/reorder) | Phase 5+ | Fixed layout sufficient for MVP |

---

## 11. Build Plan

### Phase Structure

Total estimated effort: **8-10 days** (1 developer)

| Step | Task | Days | Depends On | Deliverable |
|------|------|------|------------|-------------|
| **1** | Report engine core (shared query builder, pagination, offline query layer) | 1.5 | Dexie schema, existing models | `useReportQuery` hook, `ReportQueryBuilder` class |
| **2** | Dashboard screen (stats computation, layout, widgets, quick actions) | 1.5 | Step 1 | Dashboard screen with all 4 states |
| **3** | Sale/Purchase Report (filters, grouping, table/card, pagination) | 1.5 | Step 1 | Report screen with all filter combos working |
| **4** | Party Statement (transaction aggregation, running balance, share) | 1 | Step 1 | Statement screen + PDF share |
| **5** | Stock Summary Report (stock queries, filters, status badges) | 0.5 | Step 1 | Stock report screen |
| **6** | Day Book (date navigation, type filter, summary footer) | 0.5 | Step 1 | Day book screen |
| **7** | Payment History Report (mode/type filters, grouping) | 0.5 | Step 1 | Payment report screen |
| **8** | Export engine (PDF via jsPDF, Excel via SheetJS, CSV) | 1 | Steps 2–7 | Export working for all reports, offline + online |
| **9** | Server-side API endpoints (all 6 + export) | 1 | Prisma models exist | All API endpoints passing tests |
| **10** | Polish, testing, edge cases | 0.5 | Steps 1–9 | All edge cases handled, perf targets met |

### File Structure

```
src/
├── features/
│   ├── dashboard/
│   │   ├── DashboardScreen.tsx          # Main dashboard page
│   │   ├── DashboardSummaryCards.tsx     # 2×2 grid of stat cards
│   │   ├── TopOutstandingList.tsx        # Top 5 customers widget
│   │   ├── QuickActions.tsx             # Horizontal action pills
│   │   ├── DateRangeToggle.tsx          # Today/Week/Month/Custom pills
│   │   └── useDashboardStats.ts         # Hook: queries IndexedDB or API
│   │
│   ├── reports/
│   │   ├── ReportsScreen.tsx            # Report category list
│   │   ├── InvoiceReport.tsx            # Sale/Purchase report screen
│   │   ├── PartyStatement.tsx           # Per-party statement screen
│   │   ├── StockSummaryReport.tsx       # Stock report screen
│   │   ├── DayBook.tsx                  # Day book screen
│   │   ├── PaymentHistoryReport.tsx     # Payment report screen
│   │   │
│   │   ├── components/
│   │   │   ├── ReportFilterBar.tsx      # Shared filter bar component
│   │   │   ├── ReportSummaryBar.tsx     # Shared summary totals bar
│   │   │   ├── ReportCardList.tsx       # Mobile card layout
│   │   │   ├── ReportTable.tsx          # Desktop table layout
│   │   │   ├── GroupHeader.tsx          # Collapsible group header
│   │   │   ├── ExportBar.tsx            # PDF/Excel/CSV action bar
│   │   │   ├── DateNavigator.tsx        # Prev/Next day for day book
│   │   │   ├── EmptyReportState.tsx     # Shared empty state
│   │   │   └── LoadMoreButton.tsx       # Cursor pagination trigger
│   │   │
│   │   ├── hooks/
│   │   │   ├── useReportQuery.ts        # Core: offline/online query dispatcher
│   │   │   ├── useInvoiceReport.ts      # Invoice-specific query logic
│   │   │   ├── usePartyStatement.ts     # Statement-specific query logic
│   │   │   ├── useStockSummary.ts       # Stock-specific query logic
│   │   │   ├── useDayBook.ts            # Day book query logic
│   │   │   └── usePaymentHistory.ts     # Payment-specific query logic
│   │   │
│   │   └── utils/
│   │       ├── ReportQueryBuilder.ts    # Builds Dexie queries from filter params
│   │       ├── reportExporter.ts        # PDF/Excel/CSV generation (client-side)
│   │       ├── pdfTemplate.ts           # jsPDF layout for each report type
│   │       ├── formatCurrency.ts        # INR Indian number system formatter
│   │       └── dateRangePresets.ts      # Today/Week/Month/FY date ranges
│   │
│   └── shared/
│       ├── SkeletonCard.tsx             # Shimmer loading card
│       ├── SkeletonRow.tsx              # Shimmer loading row
│       └── PullToRefresh.tsx            # PTR wrapper component

server/
├── routes/
│   └── reports.ts                       # All 7 report endpoints
├── services/
│   ├── dashboardService.ts              # Dashboard stats aggregation
│   ├── invoiceReportService.ts          # Invoice report queries
│   ├── partyStatementService.ts         # Statement generation
│   ├── stockSummaryService.ts           # Stock aggregation
│   ├── dayBookService.ts                # Day book queries
│   ├── paymentReportService.ts          # Payment report queries
│   └── reportExportService.ts           # Server-side PDF/Excel generation
└── utils/
    └── cursorPagination.ts              # Shared cursor encode/decode
```

### Dependencies (npm packages)

| Package | Purpose | Size (gzipped) |
|---------|---------|----------------|
| `jspdf` | Client-side PDF generation | ~90 KB |
| `jspdf-autotable` | Table layout in PDF | ~15 KB |
| `xlsx` (SheetJS CE) | Client-side Excel/CSV generation | ~90 KB |
| `date-fns` | Date manipulation, formatting | ~7 KB (tree-shaken) |

All are lazy-loaded — only downloaded when user taps "Export". Not in main bundle.

---

## 12. Acceptance Criteria

### Dashboard (#50)

- [ ] Dashboard loads in < 2 seconds on first open (cold start, 10,000 invoices in IndexedDB)
- [ ] Summary cards show correct sales count + amount, purchases count + amount, total receivable, total payable for selected date range
- [ ] Date range toggle switches between Today / This Week / This Month / Custom and all cards update
- [ ] Custom date range picker allows selecting from/to dates and applies correctly
- [ ] Top 5 Outstanding Customers list shows correct names, amounts, days overdue, sorted by amount descending
- [ ] Tapping a summary card navigates to the corresponding pre-filtered report
- [ ] Tapping a customer in Top 5 navigates to their Party Statement
- [ ] Quick actions (New Invoice, Record Payment, Add Product, Add Party) all navigate to correct screens
- [ ] Pull-to-refresh works on mobile (haptic feedback, re-queries data)
- [ ] Dashboard refreshes automatically on app resume from background
- [ ] Empty state shows correctly for new users with zero transactions
- [ ] All amounts formatted in Indian number system (Rs 1,00,000)
- [ ] Works fully offline (data from IndexedDB)

### Sale/Purchase Reports (#51)

- [ ] Sale report and Purchase report accessible from Reports tab
- [ ] Filter by date range works (preset and custom)
- [ ] Filter by party works (searchable dropdown)
- [ ] Filter by product works (searchable dropdown, matches invoices containing that product)
- [ ] Filter by payment status works (paid/unpaid/partial)
- [ ] Multiple filters combine correctly (AND logic)
- [ ] Group by None / Day / Week / Month / Party / Product / Category all produce correct groupings
- [ ] Summary bar shows correct totals for current filter set
- [ ] Pagination works: first 20 items load, "Load more" fetches next 20 via cursor
- [ ] Card layout on mobile (< 640px), table layout on desktop (> 1024px)
- [ ] Tapping a row navigates to invoice detail
- [ ] Export as PDF generates correct file with all filtered data (up to 10,000 rows)
- [ ] Export as Excel generates correct .xlsx file
- [ ] Export as CSV generates correct .csv file
- [ ] All exports work offline (client-side generation)
- [ ] Report loads in < 3 seconds with 50,000 invoices and no filters

### Party Statements (#52)

- [ ] Accessible from party detail screen and Reports tab
- [ ] Shows opening balance with correct amount, type (receivable/payable), and date
- [ ] Shows closing balance matching current outstanding
- [ ] All transaction types appear: sale invoices, purchase invoices, payments received, payments made, credit notes, debit notes
- [ ] Running balance column is mathematically correct for every row
- [ ] Date range filter works
- [ ] Tapping a transaction navigates to the source document
- [ ] "Share Statement" generates PDF and opens WhatsApp/Email share sheet
- [ ] "Download PDF" saves PDF to device
- [ ] "Record Payment" shortcut pre-fills party
- [ ] Works offline

### Stock Summary Report (#53)

- [ ] Shows all products with current stock quantity, purchase value, sale value
- [ ] Filter by category works
- [ ] Filter by stock status works: Low Stock (currentStock > 0 AND currentStock <= minStockLevel), Out of Stock (currentStock = 0), In Stock (currentStock > minStockLevel)
- [ ] Search by product name works (case-insensitive, partial match)
- [ ] Sort by name / stock quantity / value works
- [ ] Summary bar shows total products, total value at purchase price, total value at sale price, low stock count, out of stock count
- [ ] Status badges show correctly (red for out of stock, yellow for low, green for in stock)
- [ ] Export as PDF/Excel/CSV works
- [ ] Pagination works (20 per page)
- [ ] Works offline

### Day Book (#54)

- [ ] Shows all transactions for selected date in chronological order (by time)
- [ ] Transaction types shown: sale, purchase, payment in, payment out, expense, stock adjustment
- [ ] Each type has distinct color-coded badge
- [ ] Filter by transaction type works
- [ ] Prev/Next day navigation works (arrows)
- [ ] Tapping date opens calendar picker for jump-to-date
- [ ] Summary footer (sticky) shows correct totals: total sales, total purchases, payments in, payments out, expenses, net cash flow
- [ ] "Next Day" disabled/hidden for future dates
- [ ] Tapping a transaction navigates to source document
- [ ] Export as PDF works (single day summary)
- [ ] Works offline

### Payment History Report (#55)

- [ ] Shows all payments (in and out) for selected date range
- [ ] Filter by date range works
- [ ] Filter by party works
- [ ] Filter by mode works (cash/UPI/bank transfer/cheque)
- [ ] Filter by type works (payment in / payment out)
- [ ] Group by None / Day / Party / Mode all produce correct groupings with subtotals
- [ ] Summary bar shows total received, total paid, net
- [ ] Payment amounts color-coded: green for in, red for out
- [ ] Linked invoice shown and tappable
- [ ] Export as PDF/Excel/CSV works
- [ ] Pagination works (20 per page)
- [ ] Works offline

### Cross-Cutting

- [ ] All reports work 100% offline (query IndexedDB, generate exports client-side)
- [ ] Offline indicator banner shown when offline: "You're offline — showing local data"
- [ ] All 4 UI states (Loading/Error/Empty/Success) implemented for every screen
- [ ] Skeleton loading (no spinners) on all screens
- [ ] Indian number formatting (Rs XX,XX,XXX) everywhere
- [ ] Date format follows user setting (default DD/MM/YYYY)
- [ ] All screens accessible via bottom nav → Reports tab
- [ ] Back navigation works correctly from every screen
- [ ] No memory leaks: unmounting a report screen cancels pending queries
- [ ] Accessibility: all interactive elements have aria-labels, minimum touch target 44×44px
- [ ] Hindi translations for all report labels, filter options, empty states, and export headers

---

## Approval

- [ ] Sawan reviewed and approved
- [ ] API contracts validated against existing data models
- [ ] Mobile layouts validated on 375px (iPhone SE) and 412px (budget Android)
- [ ] Export formats validated (PDF renders in Hindi, Excel opens in MS Excel / Google Sheets)
- [ ] Performance targets reviewed and accepted
- [ ] Out-of-scope items agreed
