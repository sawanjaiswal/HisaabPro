# Mission Plan: Party Management | Status: Awaiting Approval

> **PRD #:** 2
> **Module:** 1B — Party Management (Features #11-#17)
> **Date:** 2026-03-14
> **Owner:** Sawan Jaiswal
> **Depends on:** Auth (#1), Offline-first (#6), Onboarding (#10) — all from Phase 1A
> **Complexity:** LOW-MEDIUM (7 features, ~2 weeks)

---

## 1. What

Party Management is the customer/supplier backbone of HisaabPro. Every invoice, payment, report, and statement connects to a Party. This module lets business owners:

1. **Add and manage customers & suppliers** (with contact import from phone)
2. **Track balances** — who owes how much, for how long
3. **Store multiple addresses** — billing + shipping, auto-fill during invoicing
4. **Set credit limits** — warn or block invoicing beyond a threshold
5. **Define custom fields** — user-created fields (text, number, date, dropdown) visible on party profile
6. **Configure party-wise pricing** — different rates per party per product (retail/wholesale/dealer)
7. **Enter opening balances** — migrate existing outstanding from paper/other apps (CRITICAL for adoption)

**Why this matters:** Without parties, there are no invoices, no payments, no reports. Without opening balances, zero users migrate from Vyapar/MyBillBook/paper. This is the #1 migration blocker.

**Persona impact:**
- **Raju** (micro): Uses Party CRUD + balances + opening balances. Ignores custom fields, credit limits.
- **Priya** (growing): Uses everything. Party-wise pricing is her #1 requested feature (MyBillBook gap).
- **Amit** (distributor): Uses everything + strict credit limits (hard-block mode) + custom fields for route/zone tracking.

---

## 2. Domain Model

```
┌─────────────┐       1:N        ┌──────────────────┐
│   Business   │────────────────→│      Party        │
└─────────────┘                  └──────────────────┘
                                   │           │
                           1:N     │           │  1:N
                    ┌──────────────┘           └──────────────┐
                    ▼                                          ▼
          ┌──────────────────┐                      ┌──────────────────┐
          │   PartyAddress   │                      │  PartyPricing    │
          └──────────────────┘                      └──────────────────┘
                                                           │
                                                           │ N:1
                                                           ▼
                                                    ┌──────────────┐
                                                    │   Product    │
                                                    └──────────────┘

          ┌──────────────────┐   1:N    ┌──────────────────────────┐
          │      Party       │─────────→│  PartyCustomFieldValue   │
          └──────────────────┘          └──────────────────────────┘
                                                    │ N:1
                                                    ▼
                                        ┌──────────────────────────┐
          ┌──────────────┐   1:N        │    CustomFieldDefinition │
          │   Business   │─────────────→└──────────────────────────┘
          └──────────────┘

          ┌──────────────┐   1:N    ┌──────────────────┐
          │   Business   │─────────→│   PartyGroup     │
          └──────────────┘          └──────────────────┘
                                           │ 1:N
                                           ▼
                                    ┌──────────────┐
                                    │    Party     │
                                    └──────────────┘

          ┌──────────────┐   1:N    ┌──────────────────┐
          │    Party     │─────────→│  OpeningBalance  │
          └──────────────┘          └──────────────────┘
```

### Entity Definitions

**Party** — A customer, supplier, or both. Core entity.
- Fields: name, phone, email, gstin, pan, type, groupId, tags, creditLimit, creditLimitMode, notes
- Relations: belongs to Business, has many Addresses, has many PricingOverrides, has many CustomFieldValues, has one OpeningBalance

**PartyAddress** — Billing or shipping address for a party.
- Fields: label, line1, line2, city, state, pincode, isDefault, type (billing/shipping)
- Relations: belongs to Party

**PartyGroup** — User-defined grouping (Retailers, Wholesale, VIP, etc.).
- Fields: name, description, color
- Relations: belongs to Business, has many Parties

**CustomFieldDefinition** — Business-level custom field schema.
- Fields: name, fieldType, options (for dropdown), required, showOnInvoice, sortOrder, entityType
- Relations: belongs to Business, has many PartyCustomFieldValues

**PartyCustomFieldValue** — Value of a custom field for a specific party.
- Fields: value (stored as text, parsed by fieldType)
- Relations: belongs to Party, belongs to CustomFieldDefinition

**PartyPricing** — Per-party price override for a product.
- Fields: price, minQty (price applies above this qty)
- Relations: belongs to Party, belongs to Product

**OpeningBalance** — Migration balance entry.
- Fields: amount, type (receivable/payable), asOfDate, notes
- Relations: belongs to Party (or standalone for stock/bank)

---

## 3. User Flows

### 3.1 Create Party (Quick Add)

```
Parties tab → "+" FAB
    │
    ├─→ Bottom sheet: "Customer" / "Supplier" / "Both"
    │
    ├─→ Quick Add Form
    │       ├─→ Name* (text, auto-capitalize first letter)
    │       ├─→ Phone* (10-digit, numeric keyboard)
    │       └─→ [Save] button
    │
    ├─→ HAPPY: Toast "Rahul added as Customer" → return to Parties list
    │
    ├─→ ERROR: Phone exists → "A customer with this phone already exists. View profile?"
    │       ├─→ [View Profile] → navigate to existing party
    │       └─→ [Add Anyway] → create with duplicate phone (some businesses need this)
    │
    ├─→ ERROR: Name empty → inline "Name is required"
    ├─→ ERROR: Phone invalid → inline "Enter a valid 10-digit phone number"
    └─→ ERROR: Offline → saved locally, syncs later. Toast "Saved offline — will sync when connected"
```

### 3.2 Create Party (Full Details)

```
Parties tab → "+" FAB → "Customer" → "Add Full Details" link (or from Quick Add → Edit)
    │
    ├─→ Section 1: Basic Info
    │       ├─→ Name* (required)
    │       ├─→ Phone* (required, 10-digit)
    │       ├─→ Email (optional, validate format)
    │       ├─→ Company Name (optional)
    │       ├─→ Type: Customer / Supplier / Both (radio)
    │       ├─→ Group: dropdown (Retailers / Wholesale / VIP / + Create New)
    │       ├─→ Tags: multi-select chips (free text, comma-separated)
    │       └─→ Notes: textarea
    │
    ├─→ Section 2: Tax Info
    │       ├─→ GSTIN (optional, 15-char format validation: ^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$)
    │       ├─→ PAN (optional, 10-char format: ^[A-Z]{5}[0-9]{4}[A-Z]{1}$)
    │       └─→ If GSTIN entered → auto-extract PAN (chars 3-12), auto-extract state code (chars 1-2)
    │
    ├─→ Section 3: Addresses (collapsible, default open)
    │       ├─→ Billing Address (fields below)
    │       │       ├─→ Address Line 1, Line 2, City, State (dropdown), PIN Code (6-digit)
    │       │       └─→ [Mark as default]
    │       ├─→ "+ Add Shipping Address" → same fields
    │       └─→ "Same as billing" toggle → copies billing to shipping
    │
    ├─→ Section 4: Credit & Pricing (collapsible, default closed)
    │       ├─→ Credit Limit: Rs [____] (0 = no limit)
    │       ├─→ When exceeded: "Warn only" / "Block invoicing" (radio, default: Warn only)
    │       └─→ Party-wise Pricing: "Set custom prices →" link → separate screen
    │
    ├─→ Section 5: Custom Fields (collapsible, default closed)
    │       └─→ Renders all CustomFieldDefinitions for this business
    │           ├─→ Text → text input
    │           ├─→ Number → numeric input
    │           ├─→ Date → date picker
    │           └─→ Dropdown → select from options
    │
    ├─→ Section 6: Opening Balance (collapsible, default closed)
    │       ├─→ "They owe us" / "We owe them" toggle
    │       ├─→ Amount: Rs [____]
    │       └─→ As of date: [date picker, default: today]
    │
    ├─→ [Save] → validate all → create party + address + custom fields + opening balance + pricing
    │
    ├─→ HAPPY: Toast "Priya Traders added as Supplier"
    │       └─→ Bottom sheet: "Create Invoice" / "Add Another Party" / "Done"
    │
    ├─→ ERROR: GSTIN invalid → "Enter a valid 15-character GSTIN (e.g., 22AAAAA0000A1Z5)"
    ├─→ ERROR: PIN code invalid → "Enter a valid 6-digit PIN code"
    ├─→ ERROR: Email invalid → "Enter a valid email address"
    └─→ ERROR: Required custom field empty → "Route Number is required" (field name dynamic)
```

### 3.3 Import Contacts from Phone

```
Parties tab → "⋮" menu → "Import from Contacts"
    │
    ├─→ Capacitor Contacts permission prompt (first time only)
    │       ├─→ Granted → show contact list
    │       └─→ Denied → "Allow contact access in Settings to import"
    │
    ├─→ Contact List (searchable)
    │       ├─→ Each row: Name · Phone · checkbox
    │       ├─→ "Select All" / "Deselect All"
    │       ├─→ Already-imported contacts greyed out with "Already added" label
    │       └─→ Search bar: filter by name or phone
    │
    ├─→ "Import X Contacts as [Customer ▼]" button
    │       ├─→ Dropdown: Customer / Supplier / Both
    │       └─→ Tap → import all selected
    │
    ├─→ HAPPY: "12 customers imported" → return to Parties list
    │
    ├─→ ERROR: Phone duplicate → auto-skip, show count: "3 contacts skipped (already exist)"
    └─→ ERROR: Contact has no phone → skip silently
```

### 3.4 View Party Profile

```
Parties list → Tap party row
    │
    ├─→ Party Profile Screen
    │       ├─→ Header: Name · Type badge (Customer/Supplier/Both) · Group badge
    │       ├─→ Quick stats: Outstanding Rs X · Total business Rs Y · Last transaction Z days ago
    │       ├─→ Action bar: [Call] [WhatsApp] [Create Invoice] [Record Payment]
    │       │
    │       ├─→ Tab 1: Transactions (default)
    │       │       ├─→ List: date · type (invoice/payment/return) · amount · balance
    │       │       ├─→ Filter: date range · type
    │       │       └─→ Running balance shown
    │       │
    │       ├─→ Tab 2: Details
    │       │       ├─→ All info from creation (editable)
    │       │       ├─→ Addresses
    │       │       ├─→ Custom fields
    │       │       └─→ Credit limit info
    │       │
    │       ├─→ Tab 3: Pricing
    │       │       ├─→ Product-wise price overrides
    │       │       └─→ "Edit Prices" → pricing editor
    │       │
    │       └─→ Actions (⋮ menu):
    │               ├─→ Share Statement (PDF/WhatsApp)
    │               ├─→ Edit Party
    │               ├─→ Change Type (Customer ↔ Supplier ↔ Both)
    │               └─→ Delete Party
    │
    ├─→ ERROR: Party has linked invoices → "Cannot delete. 23 invoices linked. Deactivate instead?"
    │       └─→ [Deactivate] → party hidden from lists, data preserved
    └─→ ERROR: Offline → all reads from IndexedDB, show "Offline — showing cached data"
```

### 3.5 Party Balances & Statement

```
Party Profile → Transactions tab (or Reports → Party Statement → select party)
    │
    ├─→ Statement View
    │       ├─→ Header: Party name · Period (default: current FY)
    │       ├─→ Summary: Opening Balance · Total Debit · Total Credit · Closing Balance
    │       │
    │       ├─→ Transaction rows:
    │       │       Date | Particulars | Voucher # | Debit | Credit | Balance
    │       │       ─────┼─────────────┼───────────┼───────┼────────┼────────
    │       │       01/04| Opening Bal |    —      | 5,000 |   —    | 5,000
    │       │       05/04| Sale Inv    | INV-001   | 2,500 |   —    | 7,500
    │       │       10/04| Payment In  | PAY-001   |   —   | 3,000  | 4,500
    │       │
    │       ├─→ Filters: Date range picker (Today/This Week/This Month/This FY/Custom)
    │       └─→ Sort: Date (newest first / oldest first)
    │
    ├─→ Actions:
    │       ├─→ "Share Statement" → generate PDF → WhatsApp / Email / Save
    │       │       PDF includes: Business header, party name, date range, all txns, closing balance
    │       ├─→ "Download PDF" → save to device
    │       └─→ "Send Reminder" → pre-filled WhatsApp:
    │               "Namaste [Party Name], your outstanding balance is Rs [X] as of [Date].
    │                Kindly clear at the earliest. — [Business Name], [Phone]"
    │
    └─→ EMPTY: "No transactions with [Party Name] yet. Create an invoice to get started."
```

### 3.6 Set Party-wise Pricing

```
Party Profile → Pricing tab → "Edit Prices"
    │
    ├─→ Product List (all business products)
    │       ├─→ Search bar
    │       ├─→ Each row: Product name · Default price · [Custom price input]
    │       ├─→ If custom price set: shown in blue with "Custom" badge
    │       ├─→ Min Qty field: "Applies when qty ≥ [X]" (optional, default: 1)
    │       │
    │       ├─→ Bulk actions:
    │       │       ├─→ "Apply % discount to all" → all products get X% off default price
    │       │       └─→ "Reset all to default" → clears all custom prices
    │       │
    │       └─→ [Save] → save all changes at once
    │
    ├─→ HAPPY: "Custom prices saved for Rahul Traders"
    │
    ├─→ ERROR: Price is 0 → "Price cannot be Rs 0. Enter a valid amount."
    ├─→ ERROR: Price is negative → "Price must be a positive number"
    └─→ INFO: During invoicing, shows "(Custom price)" next to rate when party-wise price applies
```

### 3.7 Credit Limit Enforcement

```
During Invoice Creation → Customer selected
    │
    ├─→ Current outstanding loaded → compared to credit limit
    │
    ├─→ CASE 1: Within limit → green text "Outstanding: Rs 2,000 / Rs 10,000 limit"
    │
    ├─→ CASE 2: At 80%+ of limit (approaching) →
    │       Yellow warning: "Credit limit warning: Rs 8,500 / Rs 10,000 (85% used)"
    │       → invoicing continues
    │
    ├─→ CASE 3: Exceeds limit, mode = "warn" →
    │       Orange banner: "Credit limit exceeded! Outstanding will be Rs 12,000 (limit: Rs 10,000)"
    │       → [Continue Anyway] [Cancel]
    │       → if Continue: invoice created, warning logged
    │
    ├─→ CASE 4: Exceeds limit, mode = "block" →
    │       Red banner: "Cannot create invoice. Outstanding Rs 10,500 exceeds credit limit Rs 10,000."
    │       → "Record payment to reduce outstanding" link
    │       → [Record Payment] → payment screen → returns → re-check limit
    │       → Invoice creation blocked until outstanding < limit
    │
    └─→ No credit limit set → no checks, no display
```

### 3.8 Custom Fields Setup

```
Settings → Custom Fields → "Party Fields"
    │
    ├─→ Existing fields list (drag to reorder)
    │       ├─→ Each: Name · Type · Required? · Show on Invoice? · [Edit] [Delete]
    │       └─→ Empty: "No custom fields yet. Add fields to capture extra info about your parties."
    │
    ├─→ "+ Add Field"
    │       ├─→ Field Name* (e.g., "Route Number", "Salesperson", "Delivery Day")
    │       ├─→ Field Type*: Text / Number / Date / Dropdown
    │       ├─→ [If Dropdown] Options: comma-separated (e.g., "Monday,Tuesday,Wednesday")
    │       ├─→ Required: toggle (default: off)
    │       ├─→ Show on Invoice: toggle (default: off)
    │       └─→ [Save]
    │
    ├─→ HAPPY: "Field 'Route Number' added"
    │
    ├─→ ERROR: Duplicate name → "A field named 'Route Number' already exists"
    ├─→ ERROR: Delete field with values → "This field has values for 15 parties. Delete field and all values?"
    │       └─→ [Delete] / [Cancel]
    └─→ LIMIT: Max 20 custom fields per business
```

### 3.9 Opening Balances Entry (Migration Flow)

```
Onboarding → "Migrating from another app?" → [Yes]
    │
    ├─→ Opening Balances Screen (also accessible: Settings → Opening Balances)
    │
    ├─→ Tab 1: Party Balances
    │       ├─→ "+ Add Party Balance"
    │       │       ├─→ Search/select party (or create new inline)
    │       │       ├─→ Type: "They owe us" (receivable) / "We owe them" (payable)
    │       │       ├─→ Amount: Rs [____]
    │       │       ├─→ As of date: [date picker]
    │       │       └─→ [Save]
    │       │
    │       ├─→ List: Party name · Type · Amount · Date
    │       ├─→ Summary: Total Receivable Rs X · Total Payable Rs Y · Net Rs Z
    │       └─→ "Import from Excel" option
    │
    ├─→ Tab 2: Stock Balances (→ handled in Inventory PRD, link here)
    │       └─→ "Set in Products → Opening Stock per product"
    │
    ├─→ Tab 3: Bank/Cash Balances
    │       ├─→ Cash in Hand: Rs [____]
    │       ├─→ Bank accounts: [+ Add Bank] → Name · Balance · As of date
    │       └─→ Summary: Total cash + bank
    │
    ├─→ [Done — Start Using App]
    │
    ├─→ HAPPY: "Opening balances saved. You're all set!"
    │
    ├─→ ERROR: Amount is 0 → "Enter an amount greater than 0"
    ├─→ ERROR: Date in future → "Date cannot be in the future"
    ├─→ INFO: "You can edit opening balances anytime from Settings"
    └─→ IMPORTANT: Opening balance creates a special transaction of type OPENING_BALANCE
            → visible in party statement as first entry
            → not editable after first real transaction is created (prevent tampering)
```

### 3.10 Party Search, Filter & Sort

```
Parties tab
    │
    ├─→ Search bar (always visible at top)
    │       ├─→ Searches: name, phone, email, GSTIN, company name, tags
    │       ├─→ Instant results (debounced 200ms)
    │       └─→ "No results for 'xyz'" → "Add 'xyz' as a new customer?"
    │
    ├─→ Filter chips (horizontal scroll below search)
    │       ├─→ Type: All / Customers / Suppliers
    │       ├─→ Group: All / [user-defined groups]
    │       ├─→ Balance: All / Has Outstanding / No Outstanding / Overdue
    │       └─→ Tags: multi-select
    │
    ├─→ Sort (⇅ icon)
    │       ├─→ Name (A-Z / Z-A)
    │       ├─→ Outstanding (High to Low / Low to High)
    │       ├─→ Recent (Last Transaction)
    │       └─→ Date Added (Newest / Oldest)
    │
    └─→ List view:
            ├─→ Each row: Avatar (initials) · Name · Phone · Outstanding (green receivable / red payable)
            ├─→ Swipe right: Quick call
            ├─→ Swipe left: Quick WhatsApp
            └─→ Long press: multi-select → Bulk actions (delete, change group, send reminder)
```

---

## 4. API Contract

All endpoints require `Authorization: Bearer <jwt>` header. Business context derived from JWT.

### 4.1 Party CRUD

#### POST /api/parties — Create Party

```
Auth: Bearer JWT (role: party.create)
Content-Type: application/json

Request Body (Zod):
z.object({
  name: z.string().min(1, "Name is required").max(200).trim(),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit phone number").optional(),
  email: z.string().email("Enter a valid email address").optional().or(z.literal("")),
  companyName: z.string().max(200).optional(),
  type: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
  groupId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Enter a valid 15-character GSTIN").optional().or(z.literal("")),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Enter a valid 10-character PAN").optional().or(z.literal("")),
  creditLimit: z.number().min(0).optional().default(0),
  creditLimitMode: z.enum(["WARN", "BLOCK"]).optional().default("WARN"),
  notes: z.string().max(1000).optional(),
  addresses: z.array(z.object({
    label: z.string().max(50).optional().default("Default"),
    line1: z.string().max(500),
    line2: z.string().max(500).optional(),
    city: z.string().max(100),
    state: z.string().max(100),
    pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code"),
    type: z.enum(["BILLING", "SHIPPING"]),
    isDefault: z.boolean().optional().default(false),
  })).optional().default([]),
  customFields: z.array(z.object({
    fieldId: z.string().uuid(),
    value: z.string().max(1000),
  })).optional().default([]),
  openingBalance: z.object({
    amount: z.number().positive("Amount must be greater than 0"),
    type: z.enum(["RECEIVABLE", "PAYABLE"]),
    asOfDate: z.string().datetime(),
    notes: z.string().max(500).optional(),
  }).optional(),
})

Response 201:
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Rahul Traders",
    "phone": "9876543210",
    "email": "rahul@example.com",
    "companyName": "Rahul Traders Pvt Ltd",
    "type": "CUSTOMER",
    "groupId": "uuid",
    "group": { "id": "uuid", "name": "Retailers" },
    "tags": ["regular", "indore"],
    "gstin": "23AABCT1234F1ZP",
    "pan": "AABCT1234F",
    "creditLimit": 50000,
    "creditLimitMode": "WARN",
    "outstandingBalance": 5000,  // from opening balance
    "notes": "",
    "addresses": [...],
    "customFields": [...],
    "openingBalance": { ... },
    "isActive": true,
    "createdAt": "2026-03-14T10:00:00Z",
    "updatedAt": "2026-03-14T10:00:00Z"
  }
}

Response 400: { "success": false, "error": "VALIDATION_ERROR", "message": "Enter a valid 10-digit phone number", "field": "phone" }
Response 401: { "success": false, "error": "UNAUTHORIZED", "message": "Login required" }
Response 403: { "success": false, "error": "FORBIDDEN", "message": "You don't have permission to add parties" }
Response 409: { "success": false, "error": "DUPLICATE_PHONE", "message": "A customer with phone 9876543210 already exists", "existingPartyId": "uuid" }
```

#### GET /api/parties — List Parties

```
Auth: Bearer JWT (role: party.view)
Query Params (Zod):
z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().max(200).optional(),  // searches name, phone, email, gstin, companyName, tags
  type: z.enum(["CUSTOMER", "SUPPLIER", "BOTH", "ALL"]).optional().default("ALL"),
  groupId: z.string().uuid().optional(),
  hasOutstanding: z.enum(["true", "false"]).optional(),
  isActive: z.enum(["true", "false"]).optional().default("true"),
  sortBy: z.enum(["name", "outstanding", "recentTransaction", "createdAt"]).optional().default("name"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
  tags: z.string().optional(),  // comma-separated
})

Response 200:
{
  "success": true,
  "data": {
    "parties": [
      {
        "id": "uuid",
        "name": "Rahul Traders",
        "phone": "9876543210",
        "type": "CUSTOMER",
        "group": { "id": "uuid", "name": "Retailers" },
        "tags": ["regular"],
        "outstandingBalance": 5000,   // positive = receivable, negative = payable
        "creditLimit": 50000,
        "lastTransactionAt": "2026-03-10T14:30:00Z",
        "isActive": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 145,
      "totalPages": 8
    },
    "summary": {
      "totalReceivable": 250000,
      "totalPayable": 80000,
      "netOutstanding": 170000,
      "totalParties": 145,
      "customersCount": 100,
      "suppliersCount": 35,
      "bothCount": 10
    }
  }
}
```

#### GET /api/parties/:id — Get Party Detail

```
Auth: Bearer JWT (role: party.view)

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Rahul Traders",
    "phone": "9876543210",
    "email": "rahul@example.com",
    "companyName": "Rahul Traders Pvt Ltd",
    "type": "CUSTOMER",
    "group": { "id": "uuid", "name": "Retailers", "color": "#4CAF50" },
    "tags": ["regular", "indore"],
    "gstin": "23AABCT1234F1ZP",
    "pan": "AABCT1234F",
    "creditLimit": 50000,
    "creditLimitMode": "WARN",
    "outstandingBalance": 5000,
    "totalBusiness": 150000,
    "lastTransactionAt": "2026-03-10T14:30:00Z",
    "notes": "",
    "addresses": [
      {
        "id": "uuid",
        "label": "Main Office",
        "line1": "123 MG Road",
        "line2": "Near Clock Tower",
        "city": "Indore",
        "state": "Madhya Pradesh",
        "pincode": "452001",
        "type": "BILLING",
        "isDefault": true
      }
    ],
    "customFields": [
      {
        "fieldId": "uuid",
        "fieldName": "Route Number",
        "fieldType": "TEXT",
        "value": "R-15"
      }
    ],
    "openingBalance": {
      "amount": 5000,
      "type": "RECEIVABLE",
      "asOfDate": "2026-04-01T00:00:00Z"
    },
    "pricing": [
      {
        "productId": "uuid",
        "productName": "Amul Butter 500g",
        "defaultPrice": 280,
        "customPrice": 265,
        "minQty": 1
      }
    ],
    "isActive": true,
    "createdAt": "2026-03-14T10:00:00Z",
    "updatedAt": "2026-03-14T10:00:00Z"
  }
}

Response 404: { "success": false, "error": "NOT_FOUND", "message": "Party not found" }
```

#### PUT /api/parties/:id — Update Party

```
Auth: Bearer JWT (role: party.edit)
Content-Type: application/json

Request Body: Same as POST (all fields optional, partial update)

Response 200: { "success": true, "data": { ...updated party } }
Response 404: { "success": false, "error": "NOT_FOUND", "message": "Party not found" }
```

#### DELETE /api/parties/:id — Delete/Deactivate Party

```
Auth: Bearer JWT (role: party.delete)

Query Params:
z.object({
  force: z.enum(["true", "false"]).optional().default("false"),
  // force=false: deactivate (soft delete). force=true: hard delete (only if no linked transactions)
})

Response 200 (soft delete):
{ "success": true, "data": { "id": "uuid", "isActive": false }, "message": "Rahul Traders deactivated" }

Response 200 (hard delete, no transactions):
{ "success": true, "message": "Rahul Traders permanently deleted" }

Response 409 (hard delete, has transactions):
{ "success": false, "error": "HAS_TRANSACTIONS", "message": "Cannot delete party with 23 linked transactions. Deactivate instead?", "transactionCount": 23 }
```

### 4.2 Party Addresses

#### POST /api/parties/:partyId/addresses — Add Address

```
Auth: Bearer JWT (role: party.edit)

Request Body (Zod):
z.object({
  label: z.string().max(50).optional().default("Default"),
  line1: z.string().min(1, "Address line 1 is required").max(500),
  line2: z.string().max(500).optional(),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code"),
  type: z.enum(["BILLING", "SHIPPING"]),
  isDefault: z.boolean().optional().default(false),
})

Response 201: { "success": true, "data": { ...address } }
// If isDefault=true, previous default of same type is set to isDefault=false
```

#### PUT /api/parties/:partyId/addresses/:addressId — Update Address

```
Auth: Bearer JWT (role: party.edit)
Request Body: Same as POST (partial update)
Response 200: { "success": true, "data": { ...updated address } }
```

#### DELETE /api/parties/:partyId/addresses/:addressId — Delete Address

```
Auth: Bearer JWT (role: party.edit)
Response 200: { "success": true, "message": "Address deleted" }
Response 409: { "success": false, "error": "LAST_BILLING_ADDRESS", "message": "Cannot delete the only billing address" }
```

### 4.3 Party Groups

#### POST /api/party-groups — Create Group

```
Auth: Bearer JWT (role: party.edit)

Request Body (Zod):
z.object({
  name: z.string().min(1, "Group name is required").max(100).trim(),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default("#6B7280"),
})

Response 201: { "success": true, "data": { "id": "uuid", "name": "Retailers", "description": "", "color": "#4CAF50", "partyCount": 0 } }
Response 409: { "success": false, "error": "DUPLICATE_NAME", "message": "Group 'Retailers' already exists" }
```

#### GET /api/party-groups — List Groups

```
Auth: Bearer JWT (role: party.view)

Response 200:
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "Retailers", "description": "", "color": "#4CAF50", "partyCount": 25 },
    { "id": "uuid", "name": "Wholesale", "description": "", "color": "#2196F3", "partyCount": 10 }
  ]
}
```

#### PUT /api/party-groups/:id — Update Group

```
Auth: Bearer JWT (role: party.edit)
Request Body: Same as POST (partial)
Response 200: { "success": true, "data": { ...updated group } }
```

#### DELETE /api/party-groups/:id — Delete Group

```
Auth: Bearer JWT (role: party.edit)
Query: z.object({ reassignTo: z.string().uuid().optional() })
// reassignTo: move parties to another group. If omitted, parties become ungrouped.

Response 200: { "success": true, "message": "Group deleted. 25 parties moved to 'Ungrouped'." }
```

### 4.4 Custom Field Definitions

#### POST /api/custom-fields — Create Custom Field

```
Auth: Bearer JWT (role: settings.manage)

Request Body (Zod):
z.object({
  name: z.string().min(1, "Field name is required").max(100).trim(),
  fieldType: z.enum(["TEXT", "NUMBER", "DATE", "DROPDOWN"]),
  options: z.array(z.string().max(100)).min(1, "At least one option is required").max(50).optional(),
  // options required only when fieldType=DROPDOWN
  required: z.boolean().optional().default(false),
  showOnInvoice: z.boolean().optional().default(false),
  entityType: z.enum(["PARTY", "PRODUCT", "INVOICE"]).default("PARTY"),
  sortOrder: z.number().int().min(0).optional(),
})
.refine(
  (data) => data.fieldType !== "DROPDOWN" || (data.options && data.options.length > 0),
  { message: "Dropdown fields must have at least one option", path: ["options"] }
)

Response 201: { "success": true, "data": { "id": "uuid", "name": "Route Number", "fieldType": "TEXT", ... } }
Response 409: { "success": false, "error": "DUPLICATE_NAME", "message": "A field named 'Route Number' already exists" }
Response 400: { "success": false, "error": "LIMIT_REACHED", "message": "Maximum 20 custom fields per entity type" }
```

#### GET /api/custom-fields?entityType=PARTY — List Custom Fields

```
Auth: Bearer JWT (role: party.view)

Response 200:
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "Route Number", "fieldType": "TEXT", "options": null, "required": false, "showOnInvoice": false, "sortOrder": 0 },
    { "id": "uuid", "name": "Delivery Day", "fieldType": "DROPDOWN", "options": ["Monday","Wednesday","Friday"], "required": true, "showOnInvoice": true, "sortOrder": 1 }
  ]
}
```

#### PUT /api/custom-fields/:id — Update Custom Field

```
Auth: Bearer JWT (role: settings.manage)
Request Body: Same as POST (partial). Cannot change fieldType after values exist.

Response 200: { "success": true, "data": { ...updated field } }
Response 400: { "success": false, "error": "TYPE_CHANGE_BLOCKED", "message": "Cannot change field type — 15 parties have values for this field" }
```

#### DELETE /api/custom-fields/:id — Delete Custom Field

```
Auth: Bearer JWT (role: settings.manage)

Response 200: { "success": true, "message": "Field 'Route Number' and 15 values deleted" }
// Cascade deletes all PartyCustomFieldValue rows for this field
```

### 4.5 Party-wise Pricing

#### PUT /api/parties/:partyId/pricing — Set/Update Pricing (Bulk)

```
Auth: Bearer JWT (role: party.edit)

Request Body (Zod):
z.object({
  pricing: z.array(z.object({
    productId: z.string().uuid(),
    price: z.number().positive("Price must be positive"),
    minQty: z.number().int().min(1).optional().default(1),
  })).min(1).max(500),
})

Response 200:
{
  "success": true,
  "data": {
    "updated": 5,
    "created": 3,
    "message": "8 product prices updated for Rahul Traders"
  }
}
```

#### GET /api/parties/:partyId/pricing — Get Party Pricing

```
Auth: Bearer JWT (role: party.view)
Query: z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
})

Response 200:
{
  "success": true,
  "data": {
    "pricing": [
      {
        "productId": "uuid",
        "productName": "Amul Butter 500g",
        "productSku": "AB500",
        "defaultPrice": 280,
        "customPrice": 265,
        "minQty": 1,
        "discount": "5.36%"   // calculated: (280-265)/280 * 100
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 12, "totalPages": 1 }
  }
}
```

#### DELETE /api/parties/:partyId/pricing/:productId — Remove Price Override

```
Auth: Bearer JWT (role: party.edit)
Response 200: { "success": true, "message": "Custom price removed for Amul Butter 500g. Default price will apply." }
```

#### GET /api/parties/:partyId/pricing/resolve?productId=uuid&qty=10 — Resolve Price for Invoicing

```
Auth: Bearer JWT (role: party.view)
// Used by invoice screen to get the correct price for a product+party+qty combo

Response 200:
{
  "success": true,
  "data": {
    "productId": "uuid",
    "price": 265,
    "source": "PARTY_PRICING",  // or "DEFAULT_PRICE"
    "minQty": 1
  }
}
```

### 4.6 Opening Balances

#### POST /api/opening-balances — Create Opening Balance

```
Auth: Bearer JWT (role: party.edit)

Request Body (Zod):
z.object({
  partyId: z.string().uuid().optional(),  // null for bank/cash
  balanceType: z.enum(["PARTY", "BANK", "CASH"]),
  amount: z.number().positive("Amount must be greater than 0"),
  type: z.enum(["RECEIVABLE", "PAYABLE"]).optional(),  // required for PARTY type
  asOfDate: z.string().datetime().refine(
    (date) => new Date(date) <= new Date(),
    "Date cannot be in the future"
  ),
  bankName: z.string().max(200).optional(),  // for BANK type
  accountNumber: z.string().max(50).optional(),  // for BANK type
  notes: z.string().max(500).optional(),
})
.refine(
  (data) => data.balanceType !== "PARTY" || data.partyId,
  { message: "Party is required for party balance", path: ["partyId"] }
)
.refine(
  (data) => data.balanceType !== "PARTY" || data.type,
  { message: "Type (receivable/payable) is required for party balance", path: ["type"] }
)

Response 201: { "success": true, "data": { ...opening balance } }
Response 409: { "success": false, "error": "ALREADY_EXISTS", "message": "Opening balance already set for Rahul Traders. Edit existing balance instead." }
```

#### GET /api/opening-balances — List All Opening Balances

```
Auth: Bearer JWT (role: party.view)
Query: z.object({
  balanceType: z.enum(["PARTY", "BANK", "CASH", "ALL"]).optional().default("ALL"),
})

Response 200:
{
  "success": true,
  "data": {
    "partyBalances": [
      { "id": "uuid", "partyId": "uuid", "partyName": "Rahul Traders", "amount": 5000, "type": "RECEIVABLE", "asOfDate": "2026-04-01", "isLocked": false }
    ],
    "bankBalances": [
      { "id": "uuid", "bankName": "SBI Main", "accountNumber": "****1234", "amount": 150000, "asOfDate": "2026-04-01" }
    ],
    "cashBalance": { "id": "uuid", "amount": 25000, "asOfDate": "2026-04-01" },
    "summary": {
      "totalReceivable": 250000,
      "totalPayable": 80000,
      "totalBank": 150000,
      "totalCash": 25000
    }
  }
}
```

#### PUT /api/opening-balances/:id — Update Opening Balance

```
Auth: Bearer JWT (role: party.edit)
Request Body: Partial of POST body

Response 200: { "success": true, "data": { ...updated balance } }
Response 403: { "success": false, "error": "BALANCE_LOCKED", "message": "Cannot edit opening balance — transactions exist after this date. Delete those transactions first." }
// Opening balance locks after first real transaction is recorded for that party
```

#### DELETE /api/opening-balances/:id — Delete Opening Balance

```
Auth: Bearer JWT (role: party.delete)
Response 200: { "success": true, "message": "Opening balance deleted for Rahul Traders" }
Response 403: { "success": false, "error": "BALANCE_LOCKED", "message": "Cannot delete — transactions exist after the opening balance date" }
```

### 4.7 Party Statement

#### GET /api/parties/:partyId/statement — Get Party Statement

```
Auth: Bearer JWT (role: party.view)
Query Params (Zod):
z.object({
  fromDate: z.string().datetime().optional(),  // default: start of current FY
  toDate: z.string().datetime().optional(),    // default: today
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
})

Response 200:
{
  "success": true,
  "data": {
    "party": { "id": "uuid", "name": "Rahul Traders", "phone": "9876543210" },
    "period": { "from": "2026-04-01", "to": "2026-03-14" },
    "openingBalance": 5000,
    "closingBalance": 4500,
    "totalDebit": 12500,
    "totalCredit": 13000,
    "transactions": [
      {
        "id": "uuid",
        "date": "2026-04-01T00:00:00Z",
        "type": "OPENING_BALANCE",
        "particulars": "Opening Balance",
        "voucherNumber": null,
        "debit": 5000,
        "credit": null,
        "runningBalance": 5000
      },
      {
        "id": "uuid",
        "date": "2026-04-05T14:30:00Z",
        "type": "SALE_INVOICE",
        "particulars": "Sale Invoice",
        "voucherNumber": "INV-001",
        "debit": 2500,
        "credit": null,
        "runningBalance": 7500
      },
      {
        "id": "uuid",
        "date": "2026-04-10T11:00:00Z",
        "type": "PAYMENT_IN",
        "particulars": "Payment Received (UPI)",
        "voucherNumber": "PAY-001",
        "debit": null,
        "credit": 3000,
        "runningBalance": 4500
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 3, "totalPages": 1 }
  }
}
```

#### GET /api/parties/:partyId/statement/pdf — Download Statement PDF

```
Auth: Bearer JWT (role: party.view)
Query: z.object({
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
})

Response 200:
Content-Type: application/pdf
Content-Disposition: attachment; filename="Statement_Rahul_Traders_Apr2026.pdf"
[PDF binary]
```

### 4.8 Bulk Import

#### POST /api/parties/import — Bulk Import Parties

```
Auth: Bearer JWT (role: party.create)
Content-Type: multipart/form-data

Form fields:
  file: .xlsx or .csv file (max 5MB)
  type: "CUSTOMER" | "SUPPLIER" | "BOTH"
  onDuplicate: "SKIP" | "UPDATE" | "CREATE"   // what to do when phone already exists

Response 200:
{
  "success": true,
  "data": {
    "imported": 45,
    "skipped": 3,
    "updated": 2,
    "errors": [
      { "row": 12, "field": "phone", "value": "12345", "error": "Invalid phone number" },
      { "row": 28, "field": "gstin", "value": "INVALID", "error": "Invalid GSTIN format" }
    ],
    "message": "45 parties imported, 3 skipped, 2 errors"
  }
}

Response 400: { "success": false, "error": "INVALID_FILE", "message": "File must be .xlsx or .csv" }
Response 400: { "success": false, "error": "FILE_TOO_LARGE", "message": "File size exceeds 5MB limit" }
Response 400: { "success": false, "error": "LIMIT_EXCEEDED", "message": "File contains 5001 rows. Maximum 5000 parties per import." }
```

#### POST /api/parties/import-contacts — Import from Phone Contacts

```
Auth: Bearer JWT (role: party.create)

Request Body (Zod):
z.object({
  contacts: z.array(z.object({
    name: z.string().min(1).max(200),
    phone: z.string().regex(/^[6-9]\d{9}$/),
  })).min(1).max(500),
  type: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
})

Response 200:
{
  "success": true,
  "data": {
    "imported": 12,
    "skipped": 3,
    "message": "12 customers imported. 3 skipped (already exist)."
  }
}
```

---

## 5. Data Model (Prisma Schema)

```prisma
// ─── Enums ──────────────────────────────────────────

enum PartyType {
  CUSTOMER
  SUPPLIER
  BOTH
}

enum AddressType {
  BILLING
  SHIPPING
}

enum CreditLimitMode {
  WARN
  BLOCK
}

enum CustomFieldType {
  TEXT
  NUMBER
  DATE
  DROPDOWN
}

enum CustomFieldEntityType {
  PARTY
  PRODUCT
  INVOICE
}

enum OpeningBalanceType {
  RECEIVABLE
  PAYABLE
}

enum OpeningBalanceCategory {
  PARTY
  BANK
  CASH
}

// ─── Models ─────────────────────────────────────────

model Party {
  id               String          @id @default(uuid()) @db.Uuid
  businessId       String          @db.Uuid
  name             String          @db.VarChar(200)
  phone            String?         @db.VarChar(15)
  email            String?         @db.VarChar(255)
  companyName      String?         @db.VarChar(200)
  type             PartyType       @default(CUSTOMER)
  groupId          String?         @db.Uuid
  tags             String[]        @default([])
  gstin            String?         @db.VarChar(15)
  pan              String?         @db.VarChar(10)
  creditLimit      Decimal         @default(0) @db.Decimal(12, 2)
  creditLimitMode  CreditLimitMode @default(WARN)
  notes            String?         @db.Text
  isActive         Boolean         @default(true)

  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
  deletedAt        DateTime?       // soft delete timestamp

  // Relations
  business         Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)
  group            PartyGroup?     @relation(fields: [groupId], references: [id], onDelete: SetNull)
  addresses        PartyAddress[]
  customFieldValues PartyCustomFieldValue[]
  pricing          PartyPricing[]
  openingBalance   OpeningBalance?

  // Future relations (defined in other PRDs)
  // invoices       Invoice[]
  // payments       Payment[]

  @@unique([businessId, phone], name: "unique_business_phone")
  @@index([businessId, type])
  @@index([businessId, name])
  @@index([businessId, isActive])
  @@index([businessId, groupId])
  @@index([businessId, tags], type: Gin)
  @@map("parties")
}

model PartyAddress {
  id          String      @id @default(uuid()) @db.Uuid
  partyId     String      @db.Uuid
  label       String      @default("Default") @db.VarChar(50)
  line1       String      @db.VarChar(500)
  line2       String?     @db.VarChar(500)
  city        String      @db.VarChar(100)
  state       String      @db.VarChar(100)
  pincode     String      @db.VarChar(6)
  type        AddressType @default(BILLING)
  isDefault   Boolean     @default(false)

  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  // Relations
  party       Party       @relation(fields: [partyId], references: [id], onDelete: Cascade)

  @@index([partyId, type])
  @@map("party_addresses")
}

model PartyGroup {
  id          String   @id @default(uuid()) @db.Uuid
  businessId  String   @db.Uuid
  name        String   @db.VarChar(100)
  description String?  @db.VarChar(500)
  color       String   @default("#6B7280") @db.VarChar(7)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  business    Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  parties     Party[]

  @@unique([businessId, name], name: "unique_business_group_name")
  @@map("party_groups")
}

model CustomFieldDefinition {
  id            String               @id @default(uuid()) @db.Uuid
  businessId    String               @db.Uuid
  name          String               @db.VarChar(100)
  fieldType     CustomFieldType
  options       String[]             @default([])    // for DROPDOWN type
  required      Boolean              @default(false)
  showOnInvoice Boolean              @default(false)
  entityType    CustomFieldEntityType @default(PARTY)
  sortOrder     Int                  @default(0)

  createdAt     DateTime             @default(now())
  updatedAt     DateTime             @updatedAt

  // Relations
  business      Business             @relation(fields: [businessId], references: [id], onDelete: Cascade)
  values        PartyCustomFieldValue[]

  @@unique([businessId, name, entityType], name: "unique_business_field_name_entity")
  @@index([businessId, entityType])
  @@map("custom_field_definitions")
}

model PartyCustomFieldValue {
  id          String   @id @default(uuid()) @db.Uuid
  partyId     String   @db.Uuid
  fieldId     String   @db.Uuid
  value       String   @db.Text  // stored as string, parsed by fieldType

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  party       Party                @relation(fields: [partyId], references: [id], onDelete: Cascade)
  field       CustomFieldDefinition @relation(fields: [fieldId], references: [id], onDelete: Cascade)

  @@unique([partyId, fieldId], name: "unique_party_field")
  @@map("party_custom_field_values")
}

model PartyPricing {
  id          String   @id @default(uuid()) @db.Uuid
  partyId     String   @db.Uuid
  productId   String   @db.Uuid
  price       Decimal  @db.Decimal(12, 2)
  minQty      Int      @default(1)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  party       Party    @relation(fields: [partyId], references: [id], onDelete: Cascade)
  // product  Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  // ^ Uncomment when Product model exists (Inventory PRD)

  @@unique([partyId, productId, minQty], name: "unique_party_product_qty")
  @@index([partyId])
  @@index([productId])
  @@map("party_pricing")
}

model OpeningBalance {
  id             String                 @id @default(uuid()) @db.Uuid
  businessId     String                 @db.Uuid
  partyId        String?                @unique @db.Uuid  // null for BANK/CASH
  balanceType    OpeningBalanceCategory
  amount         Decimal                @db.Decimal(14, 2)
  type           OpeningBalanceType?    // RECEIVABLE/PAYABLE — only for PARTY
  asOfDate       DateTime               @db.Date
  bankName       String?                @db.VarChar(200)
  accountNumber  String?                @db.VarChar(50)
  notes          String?                @db.VarChar(500)
  isLocked       Boolean                @default(false) // locked after first real transaction

  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt

  // Relations
  business       Business               @relation(fields: [businessId], references: [id], onDelete: Cascade)
  party          Party?                 @relation(fields: [partyId], references: [id], onDelete: Cascade)

  @@index([businessId, balanceType])
  @@index([businessId, partyId])
  @@map("opening_balances")
}
```

### IndexedDB Schema (Dexie — Offline)

```typescript
// db.ts — Dexie offline schema (mirrors Prisma, syncs via queue)

import Dexie, { type Table } from 'dexie';

interface PartyLocal {
  id: string;
  businessId: string;
  name: string;
  phone?: string;
  email?: string;
  companyName?: string;
  type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
  groupId?: string;
  tags: string[];
  gstin?: string;
  pan?: string;
  creditLimit: number;
  creditLimitMode: 'WARN' | 'BLOCK';
  outstandingBalance: number;  // denormalized for offline reads
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _syncStatus: 'synced' | 'pending' | 'conflict';
}

interface PartyAddressLocal {
  id: string;
  partyId: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  type: 'BILLING' | 'SHIPPING';
  isDefault: boolean;
  _syncStatus: 'synced' | 'pending' | 'conflict';
}

interface PartyPricingLocal {
  id: string;
  partyId: string;
  productId: string;
  price: number;
  minQty: number;
  _syncStatus: 'synced' | 'pending' | 'conflict';
}

interface OpeningBalanceLocal {
  id: string;
  businessId: string;
  partyId?: string;
  balanceType: 'PARTY' | 'BANK' | 'CASH';
  amount: number;
  type?: 'RECEIVABLE' | 'PAYABLE';
  asOfDate: string;
  bankName?: string;
  accountNumber?: string;
  notes?: string;
  isLocked: boolean;
  _syncStatus: 'synced' | 'pending' | 'conflict';
}

class HisaabDB extends Dexie {
  parties!: Table<PartyLocal>;
  partyAddresses!: Table<PartyAddressLocal>;
  partyPricing!: Table<PartyPricingLocal>;
  openingBalances!: Table<OpeningBalanceLocal>;

  constructor() {
    super('hisaab');
    this.version(1).stores({
      parties: 'id, businessId, [businessId+type], [businessId+name], [businessId+phone], [businessId+isActive], *tags, _syncStatus',
      partyAddresses: 'id, partyId, [partyId+type]',
      partyPricing: 'id, partyId, productId, [partyId+productId]',
      openingBalances: 'id, businessId, partyId, [businessId+balanceType]',
    });
  }
}
```

---

## 6. UI States

### 6.1 Parties List

**Loading:**
```
┌─────────────────────────────┐
│ ░░░░░░░░░░░░░ ░░░░░        │  ← skeleton shimmer
│ ░░░░░░░░░░ ░░░░░░░         │
│ ░░░░░░░░░░░░░░ ░░░░        │
│ ░░░░░░░░ ░░░░░░░░░░        │
└─────────────────────────────┘
```
3 skeleton rows with shimmer animation. No spinner.

**Empty (first time, no parties):**
```
┌─────────────────────────────┐
│                             │
│     [illustration: people]  │
│                             │
│   No customers or suppliers │
│   yet. Add your first party │
│   to get started.           │
│                             │
│   [+ Add Customer]          │
│   [Import from Contacts]    │
│                             │
└─────────────────────────────┘
```

**Empty (search no results):**
```
┌─────────────────────────────┐
│  🔍 "xyz"                   │
│                             │
│   No results for "xyz"      │
│   Add "xyz" as a new        │
│   customer?                 │
│                             │
│   [+ Add "xyz" as Customer] │
│                             │
└─────────────────────────────┘
```

**Success (populated list):**
```
┌─────────────────────────────┐
│  🔍 Search parties...       │
│  [All] [Customers] [Suppliers]│
│─────────────────────────────│
│  RT  Rahul Traders          │
│      9876543210      ₹5,000 │  ← green = receivable
│─────────────────────────────│
│  PS  Priya Suppliers        │
│      9123456789     -₹2,000 │  ← red = payable
│─────────────────────────────│
│  AK  Amit Kumar (Both)      │
│      9555555555      ₹0     │  ← grey = settled
│─────────────────────────────│
│                      [+ FAB]│
└─────────────────────────────┘
```

**Error (network error during fetch):**
```
┌─────────────────────────────┐
│                             │
│   Something went wrong      │
│   Couldn't load parties.    │
│   Check your internet and   │
│   try again.                │
│                             │
│   [Retry]                   │
│                             │
│   Showing offline data...   │  ← falls back to IndexedDB
└─────────────────────────────┘
```

### 6.2 Party Profile

**Loading:** Skeleton with header block + 3 tab placeholders

**Success:**
```
┌─────────────────────────────┐
│  ← Rahul Traders            │
│  Customer · Retailers       │
│                             │
│  Outstanding    Total Biz   │
│  ₹5,000        ₹1,50,000   │
│  Last txn: 3 days ago       │
│                             │
│  [📞 Call] [💬 WhatsApp]     │
│  [📄 Invoice] [💰 Payment]  │
│─────────────────────────────│
│  [Transactions] [Details] [Pricing]│
│─────────────────────────────│
│  01/04  Opening Bal  +₹5,000│
│  05/04  INV-001      +₹2,500│
│  10/04  PAY-001      -₹3,000│
│                   Bal: ₹4,500│
└─────────────────────────────┘
```

**Empty (no transactions):**
```
  No transactions yet.
  Create an invoice or record a payment to see activity here.
  [Create Invoice]
```

**Error (party not found / deleted):**
```
  Party not found
  This party may have been deleted or you don't have access.
  [Go Back]
```

### 6.3 Party Form (Create/Edit)

**Loading:** None (form renders instantly with empty fields)

**Validation errors:** Inline below each field, red text, field border turns red
```
  Name ─────────────────────
  |                         |  ← red border
  ───────────────────────────
  Name is required            ← red text

  Phone ────────────────────
  | 12345                   |  ← red border
  ───────────────────────────
  Enter a valid 10-digit phone number
```

**Saving:** Button shows spinner + "Saving..." (disabled)

**Success:** Toast notification at bottom, auto-dismiss 3 seconds
```
  ┌──────────────────────────┐
  │ ✓ Rahul Traders added    │
  └──────────────────────────┘
```

**Duplicate phone error:** Modal dialog
```
  ┌──────────────────────────────┐
  │ Phone already exists          │
  │                               │
  │ A customer with phone         │
  │ 9876543210 already exists.    │
  │                               │
  │ [View Profile] [Add Anyway]   │
  └──────────────────────────────┘
```

### 6.4 Opening Balances

**Empty:**
```
  No opening balances set.
  If you're migrating from another app or paper books,
  add your existing outstanding amounts here.
  [+ Add Party Balance]  [+ Add Bank Balance]
```

**Success:**
```
  Party Balances
  ─────────────────────────────
  Rahul Traders    ₹5,000 receivable   01/04/2026
  Priya Suppliers  ₹2,000 payable      01/04/2026
  ─────────────────────────────
  Total Receivable: ₹5,000
  Total Payable:    ₹2,000
  Net:              ₹3,000
```

**Locked balance (transactions exist):**
```
  ┌──────────────────────────────┐
  │ 🔒 Locked                     │
  │ Transactions exist after this │
  │ date. Cannot edit.            │
  └──────────────────────────────┘
```

### 6.5 Credit Limit States (During Invoicing)

**Within limit (green):**
```
  Outstanding: ₹2,000 / ₹10,000 limit
```

**Approaching (80%+, yellow):**
```
  ⚠ Credit warning: ₹8,500 / ₹10,000 (85% used)
```

**Exceeded — warn mode (orange banner):**
```
  ┌──────────────────────────────────────────┐
  │ ⚠ Credit limit exceeded                  │
  │ Outstanding will be ₹12,000              │
  │ (limit: ₹10,000)                         │
  │ [Continue Anyway]  [Cancel]              │
  └──────────────────────────────────────────┘
```

**Exceeded — block mode (red banner):**
```
  ┌──────────────────────────────────────────┐
  │ ✕ Invoice blocked                        │
  │ Outstanding ₹10,500 exceeds limit        │
  │ ₹10,000. Record a payment first.         │
  │ [Record Payment]                         │
  └──────────────────────────────────────────┘
```

### 6.6 Contact Import

**Permission denied:**
```
  Contact access required
  Allow HisaabPro to access your contacts
  to import customers quickly.
  [Open Settings]
```

**Importing progress:**
```
  Importing 12 contacts...
  [████████░░░░░░░░] 8 of 12
```

**Import complete:**
```
  ✓ 12 customers imported
  3 skipped (already exist)
  [View Imported]  [Done]
```

---

## 7. Mobile

### Layout Specifications

**Target:** 375px width (iPhone SE / standard Android). Minimum: 320px.

**Parties List:**
```
375px
├─ Search bar: full width, 48px height, 16px horizontal padding
├─ Filter chips: horizontal scroll, 36px height, 8px gaps
├─ Party row: 72px height
│   ├─ Avatar (initials): 40px circle, left 16px
│   ├─ Name: 16px semibold, truncate at 200px
│   ├─ Phone: 14px regular, grey
│   └─ Balance: 16px semibold, right-aligned, 16px right padding
├─ FAB: 56px circle, bottom-right 16px margin, z-index 50
└─ Bottom nav: 56px height (Parties is 2nd tab)
```

**Party Profile:**
```
375px
├─ Header: 160px height
│   ├─ Back arrow: 44px touch target (top-left)
│   ├─ Name: 20px bold, centered
│   ├─ Type + Group badges: 12px, pill shape
│   ├─ Stats row: 2 columns, 16px font
│   └─ Action buttons: 4 icons in row, 44px touch targets each
├─ Tab bar: 44px height, 3 tabs (equal width)
└─ Content: scrollable, full width
```

**Party Form:**
```
375px
├─ Section header: 14px uppercase, grey, 8px bottom margin
├─ Input fields: full width - 32px (16px each side)
│   ├─ Label: 14px, above input
│   ├─ Input: 48px height (44px minimum touch target)
│   ├─ Error text: 12px, red, 4px top margin
│   └─ Spacing between fields: 16px
├─ Collapsible sections: 48px header, tap to expand
└─ Save button: full width - 32px, 48px height, sticky bottom
    └─ 16px bottom padding (safe area for notch devices)
```

### Touch Targets
- Minimum touch target: 44x44px (Apple HIG)
- Button height: 48px
- List row height: 72px minimum (for swipe actions)
- FAB: 56px diameter
- Chip/tag: 36px height, 12px horizontal padding
- Icon buttons: 44x44px hit area (even if icon is 24px)

### 320px Adaptations
- Party row: name truncates earlier
- Stats row: stacks vertically instead of 2 columns
- Action buttons: scroll horizontally if > 4
- Filter chips: smaller text (12px instead of 14px)

### Performance
- Party list: virtualized (react-window or tanstack-virtual), only render visible rows
- Search: debounced 200ms, local IndexedDB first, then API
- Images: no party avatars in MVP (initials only, zero network cost)
- Statement PDF: generated on-device using react-pdf, no server round-trip needed

---

## 8. Edge Cases

| # | Scenario | Handling |
|---|----------|----------|
| 1 | Party with same name (different phone) | Allowed. Show "Another party named 'Rahul' exists" info (not blocker). |
| 2 | Party with same phone (same business) | Warn + offer "View Profile" or "Add Anyway". Unique constraint is soft (configurable). |
| 3 | Party with same phone (different business) | Allowed. Phone uniqueness is per-business, not global. |
| 4 | Delete party with outstanding balance | Block hard delete. Allow deactivation. Show: "This party has ₹5,000 outstanding. Settle balance before deleting." |
| 5 | Delete party with invoices | Block hard delete. Allow deactivation. Deactivated parties hidden from lists but data preserved for reports. |
| 6 | Change party type (Customer → Supplier) | Allowed if no type-specific transactions conflict. Invoices stay linked. |
| 7 | Change party type to "Both" | Always allowed. Adds capability without removing anything. |
| 8 | GSTIN entered, then removed | Allowed. Clear GSTIN field. No cascade effect on existing invoices (they retain the GSTIN used at time of creation). |
| 9 | Opening balance + first invoice on same day | Opening balance always appears first (sort by: asOfDate, then createdAt). |
| 10 | Edit opening balance after transactions exist | Blocked. Show: "Cannot edit — transactions exist after this date." User must delete subsequent transactions first (or contact support). |
| 11 | Credit limit set to 0 after previously being higher | 0 = no limit (not "zero credit allowed"). To block all credit: set limit to 1 with BLOCK mode. |
| 12 | Party-wise price lower than cost price | Allowed with warning: "Custom price ₹200 is below cost price ₹250. Profit will be negative." (role: view purchase prices required to see this). |
| 13 | Custom field deleted after values exist | Cascade delete all values. Confirm: "This field has values for 15 parties. Delete field and all values?" |
| 14 | Custom field type change after values exist | Blocked. "Cannot change field type — 15 parties have values. Delete and recreate instead." |
| 15 | Import 500 contacts at once | Batch process in chunks of 50. Show progress bar. Timeout: 60 seconds max. |
| 16 | Party phone is landline (starts with 0) | Accept but skip WhatsApp actions. Show: "Landline number — WhatsApp unavailable." |
| 17 | Offline: create party, then same phone created on another device | Conflict resolution on sync. Show both versions. Default: last-write-wins after 24h. |
| 18 | Party statement PDF for 1000+ transactions | Paginate PDF: 50 transactions per page. Show page numbers. Total at end. |
| 19 | Search with special characters | Escape special chars in SQL/IndexedDB queries. Search is case-insensitive. |
| 20 | Group deleted while parties still assigned | Parties become ungrouped (groupId → null). Not an error. |
| 21 | Multiple addresses: delete the default | Block: "Cannot delete the default address. Set another as default first." |
| 22 | Opening balance in foreign currency | Not supported in MVP. Amount is always INR. Show if attempted: "Only INR amounts supported." |
| 23 | Party name with only spaces | Trim → validation fails: "Name is required." |
| 24 | Concurrent edit: two users edit same party | Last-write-wins with conflict toast: "This party was updated by [User] just now. Refresh to see changes." |
| 25 | Bulk import with 50% bad rows | Import valid rows, skip invalid. Show detailed error report with row numbers. Never all-or-nothing. |

---

## 9. Constraints

### Rate Limits
| Endpoint | Limit | Window | Error |
|----------|-------|--------|-------|
| POST /api/parties | 60 req | 1 min | 429: "Too many requests. Try again in X seconds." |
| GET /api/parties (list) | 120 req | 1 min | 429 |
| POST /api/parties/import | 5 req | 1 hour | 429: "Maximum 5 imports per hour." |
| GET /api/parties/:id/statement/pdf | 20 req | 1 hour | 429: "PDF generation limited. Try again later." |
| All other endpoints | 120 req | 1 min | 429 |

### Business Limits (by Subscription Tier)

| Limit | Free | Pro (₹299/mo) | Business (₹599/mo) |
|-------|------|---------------|-------------------|
| Max parties | 50 | 1,000 | Unlimited (soft cap: 50,000) |
| Max addresses per party | 3 | 10 | 50 |
| Max custom fields (per entity type) | 5 | 15 | 20 |
| Max party-wise pricing entries | 100 | 5,000 | 50,000 |
| Max opening balances | 50 | 1,000 | Unlimited |
| Bulk import max rows | 100 | 2,000 | 5,000 |
| Statement PDF generation | 5/day | 50/day | Unlimited |

### Performance Requirements
| Operation | Target | Measurement |
|-----------|--------|-------------|
| Party list load (first 20) | < 200ms | API response time |
| Party search (type-ahead) | < 100ms | IndexedDB local query |
| Party profile load | < 300ms | API response time |
| Statement generation (100 txns) | < 500ms | API response time |
| Statement PDF render | < 3 seconds | Client-side generation |
| Bulk import (1000 rows) | < 30 seconds | End-to-end |
| Contact import (500 contacts) | < 10 seconds | End-to-end |
| Offline party list load | < 50ms | IndexedDB query |

### Data Constraints
- Party name: 1-200 characters
- Phone: 10 digits, starts with 6-9 (Indian mobile)
- Email: standard RFC 5322 validation
- GSTIN: 15 characters, regex validated
- PAN: 10 characters, regex validated
- PIN code: exactly 6 digits
- Tags per party: max 20
- Tag length: max 50 characters
- Notes: max 1,000 characters
- Credit limit: 0 to 99,99,99,999.99 (Decimal 12,2)
- Opening balance amount: 0.01 to 99,99,99,99,999.99 (Decimal 14,2)
- Custom field value: max 1,000 characters
- Dropdown options per field: max 50

---

## 10. Out of Scope

| Feature | Why Out of Scope | When |
|---------|-----------------|------|
| GSTIN verification against govt API | Phase 2 (GST module) | Feature #78 |
| Party ledger (accounting view) | Phase 4 (after double-entry accounting) | Feature #120 |
| Aging reports (30/60/90/120 day buckets) | Phase 3 (Accounting module) | Feature #101 |
| Multiple price lists (named: MRP, wholesale, dealer) | Phase 5 (Sales module) | Feature #132 |
| Party self-registration (invite link) | Phase 5 | Feature #131 |
| CRM features (follow-up dates, last contact) | Phase 5 | Feature #127 |
| Bulk import from Vyapar/MyBillBook format | Phase 7 (AI) | Feature #149 |
| Party images/logos | Phase 4 | Feature #116 (item images, extend to parties) |
| Multi-currency opening balances | Phase 2 | Feature #81 |
| Recurring party statements (auto-send monthly) | Phase 5 | Part of marketing module |
| Party merge (combine duplicate parties) | Post-MVP enhancement | Not in roadmap yet |
| Party-wise discount (% instead of fixed price) | Phase 5 | Feature #132 (price lists) |

---

## 11. Build Plan

### Batch 1: Foundation (Days 1-2)

**Goal:** Database schema, base models, Party CRUD API

| Action | File | Notes |
|--------|------|-------|
| CREATE | `prisma/migrations/XXXX_party_management/migration.sql` | All 7 tables |
| MODIFY | `prisma/schema.prisma` | Add all models from Section 5 |
| CREATE | `src/server/modules/party/party.schema.ts` | Zod validation schemas |
| CREATE | `src/server/modules/party/party.service.ts` | Business logic (CRUD, search, filter) |
| CREATE | `src/server/modules/party/party.controller.ts` | Route handlers |
| CREATE | `src/server/modules/party/party.routes.ts` | Express routes |
| MODIFY | `src/server/routes/index.ts` | Register party routes |
| CREATE | `src/server/modules/party/__tests__/party.service.test.ts` | Unit tests |
| CREATE | `src/server/modules/party/__tests__/party.controller.test.ts` | Integration tests |

### Batch 2: Addresses + Groups + Custom Fields API (Days 3-4)

**Goal:** Address CRUD, Group CRUD, Custom Field Definition + Value CRUD

| Action | File | Notes |
|--------|------|-------|
| CREATE | `src/server/modules/party/address.schema.ts` | Address Zod schemas |
| CREATE | `src/server/modules/party/address.service.ts` | Address CRUD logic |
| CREATE | `src/server/modules/party/address.controller.ts` | Address route handlers |
| CREATE | `src/server/modules/party-group/group.schema.ts` | Group Zod schemas |
| CREATE | `src/server/modules/party-group/group.service.ts` | Group CRUD |
| CREATE | `src/server/modules/party-group/group.controller.ts` | Group routes |
| CREATE | `src/server/modules/custom-field/custom-field.schema.ts` | Custom field Zod schemas |
| CREATE | `src/server/modules/custom-field/custom-field.service.ts` | Field definition + value CRUD |
| CREATE | `src/server/modules/custom-field/custom-field.controller.ts` | Field routes |

### Batch 3: Pricing + Opening Balances + Statement API (Days 5-6)

**Goal:** Party-wise pricing, opening balance CRUD, statement generation

| Action | File | Notes |
|--------|------|-------|
| CREATE | `src/server/modules/party/pricing.schema.ts` | Pricing Zod schemas |
| CREATE | `src/server/modules/party/pricing.service.ts` | Pricing CRUD + resolve |
| CREATE | `src/server/modules/party/pricing.controller.ts` | Pricing routes |
| CREATE | `src/server/modules/opening-balance/opening-balance.schema.ts` | OB Zod schemas |
| CREATE | `src/server/modules/opening-balance/opening-balance.service.ts` | OB CRUD + lock logic |
| CREATE | `src/server/modules/opening-balance/opening-balance.controller.ts` | OB routes |
| CREATE | `src/server/modules/party/statement.service.ts` | Statement generation + PDF |
| CREATE | `src/server/modules/party/statement.controller.ts` | Statement routes |

### Batch 4: Frontend — Parties List + CRUD (Days 7-9)

**Goal:** Parties list page, create/edit party forms, party profile

| Action | File | Notes |
|--------|------|-------|
| CREATE | `src/client/pages/parties/PartiesPage.tsx` | List with search, filter, sort |
| CREATE | `src/client/pages/parties/PartyProfilePage.tsx` | Profile with tabs |
| CREATE | `src/client/pages/parties/CreatePartyPage.tsx` | Full form with all sections |
| CREATE | `src/client/pages/parties/EditPartyPage.tsx` | Edit form (pre-filled) |
| CREATE | `src/client/components/party/PartyListItem.tsx` | Row component |
| CREATE | `src/client/components/party/PartyQuickAdd.tsx` | Bottom sheet quick add |
| CREATE | `src/client/components/party/PartyFilterChips.tsx` | Filter UI |
| CREATE | `src/client/components/party/PartySearchBar.tsx` | Search with debounce |
| CREATE | `src/client/components/party/AddressForm.tsx` | Reusable address form |
| CREATE | `src/client/components/party/CreditLimitBanner.tsx` | Credit limit status display |
| CREATE | `src/client/hooks/useParties.ts` | React Query hooks for party API |
| CREATE | `src/client/hooks/usePartyGroups.ts` | React Query hooks for groups |

### Batch 5: Frontend — Pricing, Custom Fields, Statements (Days 10-11)

**Goal:** Party-wise pricing editor, custom field management, statement view

| Action | File | Notes |
|--------|------|-------|
| CREATE | `src/client/pages/parties/PartyPricingPage.tsx` | Pricing editor |
| CREATE | `src/client/pages/parties/PartyStatementPage.tsx` | Statement view + share |
| CREATE | `src/client/components/party/PricingRow.tsx` | Product price row |
| CREATE | `src/client/components/party/StatementTable.tsx` | Statement table |
| CREATE | `src/client/components/party/StatementPDF.tsx` | PDF template (react-pdf) |
| CREATE | `src/client/pages/settings/CustomFieldsPage.tsx` | Custom field definitions CRUD |
| CREATE | `src/client/components/custom-field/CustomFieldForm.tsx` | Field definition form |
| CREATE | `src/client/components/custom-field/CustomFieldRenderer.tsx` | Render field by type |
| CREATE | `src/client/hooks/useCustomFields.ts` | React Query hooks |
| CREATE | `src/client/hooks/usePartyPricing.ts` | React Query hooks |
| CREATE | `src/client/hooks/usePartyStatement.ts` | React Query hooks |

### Batch 6: Opening Balances + Contact Import + Offline (Days 12-13)

**Goal:** Opening balance flow, contact import, IndexedDB sync

| Action | File | Notes |
|--------|------|-------|
| CREATE | `src/client/pages/opening-balances/OpeningBalancesPage.tsx` | 3-tab OB screen |
| CREATE | `src/client/components/opening-balance/PartyBalanceForm.tsx` | Party OB form |
| CREATE | `src/client/components/opening-balance/BankBalanceForm.tsx` | Bank OB form |
| CREATE | `src/client/pages/parties/ImportContactsPage.tsx` | Contact import flow |
| MODIFY | `src/client/db/schema.ts` | Add party tables to Dexie |
| CREATE | `src/client/db/party-sync.ts` | Sync logic for parties |
| CREATE | `src/client/hooks/usePartyOffline.ts` | Offline-first party queries |
| CREATE | `src/client/hooks/useContactImport.ts` | Capacitor contacts integration |
| MODIFY | `src/client/db/sync-queue.ts` | Register party sync handlers |

### Batch 7: Polish + Testing (Day 14)

**Goal:** Edge cases, error states, empty states, accessibility, e2e tests

| Action | File | Notes |
|--------|------|-------|
| CREATE | `src/client/components/party/PartyEmptyState.tsx` | Empty state illustrations + CTAs |
| CREATE | `src/client/components/party/PartyErrorState.tsx` | Error states |
| MODIFY | All party pages | Add loading skeletons |
| CREATE | `e2e/party-management.spec.ts` | Playwright e2e tests |
| CREATE | `e2e/opening-balances.spec.ts` | OB e2e tests |
| CREATE | `e2e/party-pricing.spec.ts` | Pricing e2e tests |
| MODIFY | `src/client/routes.tsx` | Add all party routes |

---

## 12. Acceptance Criteria

### Party CRUD
- [ ] Can create a customer with just name + phone (quick add) in < 3 taps
- [ ] Can create a customer/supplier with full details (all 6 sections)
- [ ] Phone duplicate shows warning with "View Profile" / "Add Anyway"
- [ ] GSTIN validates format and auto-extracts PAN + state code
- [ ] Party type can be Customer, Supplier, or Both
- [ ] Can assign party to a group and add tags
- [ ] Can edit all party fields after creation
- [ ] Delete party with transactions: soft-deletes (deactivates), preserves data
- [ ] Delete party without transactions: hard-deletes with confirmation
- [ ] Search finds parties by name, phone, email, GSTIN, company name, tags
- [ ] Search results appear within 200ms (local) / 500ms (API)
- [ ] Filter by type (customer/supplier), group, outstanding status
- [ ] Sort by name, outstanding, recent transaction, date added
- [ ] Parties list renders 1000+ parties without jank (virtualized)

### Party Balances & Statements
- [ ] Party profile shows outstanding balance (positive = receivable, negative = payable)
- [ ] Statement shows all transactions with running balance
- [ ] Statement date range filter works (preset + custom)
- [ ] Statement PDF generates correctly with business header
- [ ] Statement shareable via WhatsApp (PDF attachment)
- [ ] Statement shareable via email
- [ ] Reminder sends pre-formatted WhatsApp message with correct amount

### Multiple Addresses
- [ ] Can add billing address during party creation
- [ ] Can add multiple shipping addresses
- [ ] "Same as billing" toggle copies billing to shipping
- [ ] Default address is marked and auto-fills during invoicing
- [ ] Can change default address
- [ ] Cannot delete the only billing address

### Credit Limits
- [ ] Can set credit limit amount and mode (warn/block) per party
- [ ] At 80%+ utilization: yellow warning shown during invoicing
- [ ] Warn mode: orange banner, can continue with confirmation
- [ ] Block mode: red banner, invoice creation blocked until payment recorded
- [ ] No credit limit (0 or unset): no checks performed
- [ ] Credit limit status visible on party profile and during invoicing

### Custom Fields
- [ ] Can create TEXT, NUMBER, DATE, DROPDOWN custom fields
- [ ] Dropdown field requires at least 1 option
- [ ] Required fields enforce validation during party creation/edit
- [ ] Custom field values display on party profile
- [ ] "Show on Invoice" flag works (verified after Invoice PRD)
- [ ] Can reorder custom fields via drag
- [ ] Max 20 fields per entity type enforced
- [ ] Delete field cascades to all values (with confirmation)

### Party-wise Pricing
- [ ] Can set custom price per product per party
- [ ] Can set minimum quantity threshold for pricing
- [ ] Custom price auto-applies during invoice creation for that party
- [ ] Shows "Custom price" indicator on invoice line item
- [ ] Can bulk apply % discount to all products for a party
- [ ] Can reset all prices to default
- [ ] Price below cost shows warning (if role has purchase price access)

### Opening Balances
- [ ] Can enter party opening balance (receivable or payable) with date
- [ ] Opening balance appears as first entry in party statement
- [ ] Can enter bank opening balance with bank name + account number
- [ ] Can enter cash-in-hand opening balance
- [ ] Summary shows total receivable, payable, bank, cash
- [ ] Opening balance locks after first real transaction for that party
- [ ] Locked balance shows lock icon and "Cannot edit" message
- [ ] Opening balance accessible from onboarding flow AND settings
- [ ] Can import opening balances via Excel

### Offline
- [ ] All party data syncs to IndexedDB
- [ ] Can create/edit parties while offline
- [ ] Can view party list, profile, statement while offline
- [ ] Shows "Offline — showing cached data" indicator
- [ ] Changes sync when connection returns
- [ ] Conflict resolution works for concurrent edits

### Contact Import
- [ ] Capacitor contacts permission requested on first use
- [ ] Can search and multi-select contacts
- [ ] Already-imported contacts shown as greyed out
- [ ] Can choose type (customer/supplier) before import
- [ ] Duplicate phones auto-skipped with count shown
- [ ] Import 500 contacts completes within 10 seconds

### General
- [ ] All touch targets are 44px minimum
- [ ] Works on 320px minimum width
- [ ] All API endpoints have Zod validation
- [ ] All API endpoints return consistent error format
- [ ] Rate limits enforced per specification
- [ ] Subscription tier limits enforced (max parties, max fields, etc.)
- [ ] Loading states: skeleton shimmer (no spinners on lists)
- [ ] Empty states: illustration + CTA text + action button
- [ ] Error states: message + retry button + offline fallback

---

## Approval

- [ ] Sawan reviewed and approved
- [ ] Domain model validated
- [ ] API contract validated
- [ ] Prisma schema validated
- [ ] UI states and copy approved
- [ ] Edge cases reviewed
- [ ] Build plan estimated and feasible
