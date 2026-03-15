# User Journeys — HisaabPro

> **Status:** Draft — Awaiting Approval
> **Date:** 2026-03-14
> **Depends on:** PRODUCT_BRIEF.md (approved)

Each journey maps: **Entry → Steps → Branches (what if?) → Exit → Error paths**

---

## Journey 1: First-Time Setup (Download → First Invoice)

**Persona:** Raju (new user, paper-based, low tech)
**Goal:** Go from download to sending first invoice in < 5 minutes
**Trigger:** Sees ad / friend referral / Play Store search "billing app"

```
Download app from Play Store / App Store
    │
    ├─→ Open app → Onboarding carousel (3 slides: bill, track, collect)
    │       │
    │       └─→ "Get Started" button
    │
    ├─→ Sign Up
    │       │
    │       ├─→ Enter phone number
    │       ├─→ Receive OTP (WhatsApp preferred, SMS fallback)
    │       ├─→ Enter OTP → verified
    │       ├─→ Set password (min 8 chars, show strength)
    │       │
    │       ├─→ [BRANCH] OTP not received?
    │       │       ├─→ "Resend OTP" (30 sec cooldown)
    │       │       └─→ "Try SMS instead" (if WhatsApp failed)
    │       │
    │       └─→ [BRANCH] Already have account?
    │               └─→ "Login" link → Login flow
    │
    ├─→ Business Profile Setup
    │       │
    │       ├─→ Business name (required)
    │       ├─→ Business type dropdown (Retail/Wholesale/Service/Manufacturing/Other)
    │       ├─→ Business address (optional — can add later)
    │       ├─→ GSTIN (optional — "Add later" link. If added, enable GST invoicing)
    │       ├─→ Logo upload (optional — camera or gallery)
    │       ├─→ Phone number (pre-filled from signup)
    │       │
    │       └─→ [BRANCH] Has referral code?
    │               └─→ "Have a referral code?" → Enter code → "Rs X will be credited after first invoice"
    │
    ├─→ Quick Start Guide (overlay, dismissible)
    │       │
    │       ├─→ "Add your first customer" → highlight Add Customer button
    │       ├─→ "Create your first invoice" → highlight New Invoice button
    │       └─→ "Skip tour" → go to Dashboard
    │
    ├─→ [OPTIONAL] Opening Balances
    │       │
    │       ├─→ "Migrating from another app or paper?" → Yes/No
    │       ├─→ If Yes: "Add opening balances for customers/suppliers"
    │       │       ├─→ Bulk entry: Customer name | Amount they owe | Amount we owe
    │       │       └─→ "Skip — I'll add these later"
    │       └─→ If No: Skip → Dashboard
    │
    └─→ Dashboard (empty state)
            │
            ├─→ Shows: "Welcome, [Name]! Let's create your first invoice"
            ├─→ CTA: "Create Invoice" button (prominent)
            ├─→ Quick links: Add Customer, Add Product, View Reports
            └─→ Tip: "Your data is automatically backed up. You'll never lose it."
```

**Error paths:**
- Network fails during signup → "You're offline. Connect to internet to sign up." (signup requires internet, everything after works offline)
- OTP expires → "OTP expired. Tap to resend."
- Phone already registered → "This number already has an account. Login instead?"
- GSTIN invalid format → Inline validation: "Enter 15-character GSTIN (e.g., 22AAAAA0000A1Z5)"

**Success metric:** 80% of signups complete business profile. 50% create first invoice same day.

---

## Journey 2: Daily Billing (Create Invoice → Share → Payment)

**Persona:** Priya (growing wholesaler, 50+ invoices/day)
**Goal:** Create and share invoice in < 10 seconds
**Trigger:** Customer is at counter / calls to place order

```
Open app (PIN/biometric unlock if set)
    │
    ├─→ Dashboard → Tap "+" or "New Invoice" (floating FAB button)
    │
    ├─→ Select Invoice Type
    │       ├─→ Sale Invoice (default)
    │       ├─→ Estimate / Quotation
    │       ├─→ Delivery Challan
    │       ├─→ Proforma Invoice
    │       └─→ Purchase Invoice
    │
    ├─→ Select Customer
    │       │
    │       ├─→ Search by name / phone (instant search, top 5 recent shown)
    │       ├─→ [BRANCH] Customer not found?
    │       │       └─→ "Add New" → Quick add (name + phone, rest optional) → auto-select
    │       └─→ Customer selected → show: outstanding balance, credit limit status
    │              │
    │              └─→ [BRANCH] Over credit limit?
    │                      └─→ Warning: "Credit limit exceeded (Rs X/Y). Continue anyway?" → Yes/No
    │
    ├─→ Add Line Items
    │       │
    │       ├─→ Search product by name (autocomplete, recent items first)
    │       ├─→ [FUTURE] Scan barcode → auto-fill product
    │       ├─→ Enter: Qty · Rate (auto-filled from party-wise pricing or default) · Discount
    │       ├─→ Shows: Line total · Running invoice total · Profit margin (if role allows)
    │       ├─→ "Add another item" → repeat
    │       │
    │       ├─→ [BRANCH] Item out of stock?
    │       │       └─→ Warning: "Only X in stock. Continue with X?" or "Create anyway (stock will go negative)"
    │       │              (based on stock validation setting)
    │       │
    │       └─→ [BRANCH] Need additional charges?
    │               └─→ "+ Add charges" → Shipping / Packaging / Freight / Custom → Amount
    │
    ├─→ Invoice Details
    │       ├─→ Invoice number (auto-generated, editable)
    │       ├─→ Invoice date (default today)
    │       ├─→ Due date (auto-calc from payment terms, editable)
    │       ├─→ Notes (optional)
    │       ├─→ Select shipping address (if multiple)
    │       │
    │       └─→ Invoice summary:
    │               ├─→ Subtotal
    │               ├─→ Discount (if any)
    │               ├─→ Additional charges
    │               ├─→ Tax (GST if enabled — Phase 2)
    │               ├─→ Round-off (per settings)
    │               └─→ TOTAL (large, bold)
    │
    ├─→ Save Invoice
    │       │
    │       ├─→ "Save" → saved locally + queued for sync
    │       ├─→ Stock automatically deducted (atomic)
    │       ├─→ Party outstanding updated
    │       │
    │       └─→ Post-save actions (bottom sheet):
    │               ├─→ "Share on WhatsApp" (PDF or image) → opens WhatsApp with pre-filled message
    │               ├─→ "Share via Email" (PDF attachment)
    │               ├─→ "Print" (thermal or A4 based on settings)
    │               ├─→ "Record Payment" (if paid now)
    │               └─→ "Done" → back to dashboard
    │
    └─→ [BRANCH] Record Payment immediately
            │
            ├─→ Payment mode: Cash / UPI / Bank Transfer / Cheque
            ├─→ Amount (default: full invoice amount, editable for partial)
            ├─→ Reference (UPI txn ID, cheque number — optional)
            ├─→ Save → outstanding updated → "Payment recorded ✓"
            │
            └─→ [BRANCH] Partial payment?
                    └─→ Remaining shows as outstanding on party statement
```

**Error paths:**
- Offline during save → Saved locally, green badge "Saved offline — will sync when connected"
- Duplicate invoice number → "Invoice #X already exists. Use #Y instead?" (auto-suggest next)
- Rate is Rs 0 → Warning: "Rate is Rs 0. Are you sure?"
- Quantity is negative → Block: "Quantity must be positive"

**Keyboard shortcuts (desktop/tablet):**
- `Ctrl+N` → New invoice
- `Tab` → Next field
- `Enter` on item search → Select first result
- `Ctrl+S` → Save invoice
- `Ctrl+P` → Print

**Success metric:** Average invoice creation < 10 seconds for returning users. 90% of invoices shared via WhatsApp.

---

## Journey 3: End of Day Review

**Persona:** Raju (retailer, checks at closing time)
**Goal:** Know how the day went, who owes money, send reminders
**Trigger:** Closing shop for the day

```
Open app → Dashboard
    │
    ├─→ Today's Summary (always visible at top)
    │       ├─→ Total Sales: Rs XX,XXX (tap → sale report)
    │       ├─→ Total Purchases: Rs XX,XXX (tap → purchase report)
    │       ├─→ Payments Received: Rs XX,XXX
    │       ├─→ Payments Made: Rs XX,XXX
    │       ├─→ Net Cash Flow: Rs ±XX,XXX
    │       └─→ Outstanding Receivable: Rs XX,XXX (tap → outstanding list)
    │
    ├─→ Tap "Outstanding" → Outstanding List
    │       │
    │       ├─→ Sorted by: amount (highest first) / age (oldest first) / name
    │       ├─→ Each row: Customer name · Amount · Days overdue · Last payment date
    │       │
    │       ├─→ Tap customer → Statement view
    │       │       ├─→ All transactions (invoices, payments, returns)
    │       │       ├─→ Running balance
    │       │       └─→ Actions: "Send Reminder" · "Record Payment" · "Share Statement"
    │       │
    │       ├─→ [ACTION] Send Reminder
    │       │       ├─→ Pre-formatted WhatsApp message:
    │       │       │   "Dear [Name], you have an outstanding balance of Rs [X].
    │       │       │    Please clear at your earliest. — [Business Name]"
    │       │       ├─→ Editable before sending
    │       │       └─→ Sent → logged as reminder in activity
    │       │
    │       └─→ [ACTION] Bulk Reminder
    │               ├─→ Select multiple customers (checkbox)
    │               └─→ "Send Reminders" → sends to all selected via WhatsApp
    │
    ├─→ Low Stock Alerts (if any)
    │       ├─→ "3 items are low on stock"
    │       ├─→ Tap → List: Item name · Current stock · Minimum level
    │       └─→ Each: "Create Purchase Order" shortcut
    │
    └─→ Backup Status
            ├─→ "Last backup: 2 hours ago ✓" (green)
            ├─→ [BRANCH] "Last backup: 3 days ago ⚠️" → "Backup Now" button
            └─→ [BRANCH] "Never backed up ❌" → "Set Up Backup" → Google Drive setup
```

**Success metric:** 70% of users check dashboard daily. 40% send at least 1 reminder per week.

---

## Journey 4: Monthly Review & Reports

**Persona:** Priya (wholesaler, reviews monthly, shares with CA)
**Goal:** Understand monthly performance, prepare for GST filing (Phase 2), track outstanding
**Trigger:** End of month / CA asks for data

```
Open app → Reports tab (bottom nav)
    │
    ├─→ Report categories:
    │       ├─→ Sales Reports (by date, party, product)
    │       ├─→ Purchase Reports (by date, supplier, product)
    │       ├─→ Party Statements (per customer/supplier)
    │       ├─→ Stock Summary (current stock, value, movement)
    │       ├─→ Payment History (all payments in/out)
    │       ├─→ Day Book (all transactions for any date)
    │       └─→ [Phase 2] GST Reports (GSTR-1, GSTR-3B)
    │
    ├─→ Select "Sales Report"
    │       ├─→ Filter: Date range (this month / last month / custom)
    │       ├─→ Filter: Party (all / specific customer)
    │       ├─→ Filter: Product (all / specific item)
    │       │
    │       ├─→ Summary view:
    │       │       ├─→ Total sales · Total discount · Net sales
    │       │       ├─→ Top 5 customers by revenue
    │       │       └─→ Top 5 products by quantity
    │       │
    │       ├─→ Detail view: Each invoice (date, party, amount, payment status)
    │       │
    │       └─→ Actions:
    │               ├─→ "Download PDF" → saved to device
    │               ├─→ "Share on WhatsApp" → PDF attachment
    │               ├─→ "Share via Email" → PDF attachment
    │               └─→ [Phase 3] "Export to Tally"
    │
    ├─→ Select "Party Statement" → Choose customer
    │       ├─→ All transactions (invoices, payments, returns)
    │       ├─→ Opening balance · Closing balance
    │       ├─→ "Share Statement" → WhatsApp / Email / PDF
    │       └─→ "Record Payment" shortcut
    │
    └─→ Select "Stock Summary"
            ├─→ All products with: current qty · value (qty × purchase price)
            ├─→ Filter: category / low stock only / all
            ├─→ Sort: name / qty / value
            └─→ "Download PDF" / "Share"
```

**Success metric:** 60% of active users view at least 1 report per month. 30% share reports with CA/partner.

---

## Journey 5: Staff Management

**Persona:** Priya (3 staff members, needs access control)
**Goal:** Add staff, set roles so they can bill but can't see purchase prices or delete invoices
**Trigger:** Hiring new person / existing staff doing something unauthorized

```
Settings → Staff & Roles
    │
    ├─→ Current staff list (name, role, last active, status)
    │
    ├─→ "Add Staff"
    │       ├─→ Name + Phone number
    │       ├─→ Select role:
    │       │       ├─→ Admin (full access — same as owner minus billing/subscription)
    │       │       ├─→ Manager (all operations, no settings/delete)
    │       │       ├─→ Salesperson (create invoices + payments only)
    │       │       ├─→ Viewer (read-only — reports and dashboard)
    │       │       └─→ Custom (pick individual permissions)
    │       │
    │       ├─→ [If Custom] Permission checkboxes:
    │       │       ├─→ Invoicing: Create / Edit / Delete / View
    │       │       ├─→ Payments: Record / Edit / Delete / View
    │       │       ├─→ Inventory: Add / Edit / Adjust / View
    │       │       ├─→ Parties: Add / Edit / Delete / View
    │       │       ├─→ Reports: View / Download / Share
    │       │       ├─→ Settings: Access / Modify
    │       │       ├─→ Special: View purchase prices / View profit margins
    │       │       └─→ Special: Edit old transactions (> X days)
    │       │
    │       ├─→ "Invite" → SMS/WhatsApp sent with download link + access code
    │       │
    │       └─→ Staff receives invite → downloads app → enters code → linked to business
    │
    ├─→ Edit Staff
    │       ├─→ Change role / permissions
    │       ├─→ Suspend access (temporary)
    │       └─→ Remove from business
    │
    └─→ Transaction Controls (Settings → Security)
            ├─→ "Lock transactions older than [X] days" (prevent editing old invoices)
            ├─→ "Require approval for deletes" (on/off)
            ├─→ "Require PIN for high-value invoices (> Rs [X])"
            └─→ "Activity log" → who did what, when (audit trail)
```

**Error paths:**
- Staff phone already linked to another business → "This number is already part of [Business]. Remove from there first."
- Owner tries to remove themselves → Block: "Owner cannot be removed"
- Last admin tries to downgrade → Block: "Business must have at least 1 admin"

**Success metric:** 80% of multi-staff businesses set up roles within first week.

---

## Journey 6: Add New Customer/Supplier

**Persona:** All personas
**Goal:** Add a new party with correct details, set pricing, enter opening balance
**Trigger:** New customer walks in / new supplier contacted

```
Parties tab → "+ Add Customer" or "+ Add Supplier"
    │
    ├─→ Quick Add (minimal — for speed)
    │       ├─→ Name (required)
    │       ├─→ Phone (required — used as unique identifier)
    │       ├─→ "Save" → done, add more details later
    │       │
    │       └─→ [BRANCH] Phone already exists?
    │               └─→ "Customer with this phone already exists. View profile?"
    │
    ├─→ Full Details (expandable sections)
    │       ├─→ Basic: Name · Phone · Email · Company name
    │       ├─→ Billing Address: Street · City · State · PIN
    │       ├─→ Shipping Address: Same as billing? If not, add separate (+ multiple shipping)
    │       ├─→ Tax: GSTIN (optional, validate format) · PAN
    │       ├─→ Group: Assign to group (Retailers / Wholesale / VIP / Custom)
    │       ├─→ Custom Fields: Any user-defined fields (set up in Settings)
    │       └─→ Notes: Free text
    │
    ├─→ Pricing
    │       ├─→ "Use default prices" (all products at standard rate)
    │       ├─→ "Assign price list" (Retail / Wholesale / Dealer — if set up)
    │       └─→ "Custom prices" → override specific products for this customer
    │
    ├─→ Credit Limit
    │       ├─→ "No limit" (default)
    │       └─→ "Set limit: Rs [X]" → warn/block when exceeded during invoicing
    │
    ├─→ Opening Balance (for migration)
    │       ├─→ "They owe us: Rs [X]" (receivable)
    │       ├─→ "We owe them: Rs [X]" (payable)
    │       └─→ "As of date: [date]"
    │
    └─→ Save → Customer/Supplier created
            ├─→ Toast: "Customer [Name] added ✓"
            └─→ Options: "Create Invoice for [Name]" / "Add Another" / "Done"
```

**Bulk import alternative:**
```
Parties tab → "Import from contacts"
    ├─→ Phone contacts list → multi-select
    ├─→ Import selected → created with name + phone
    └─→ "Add details later" for each

Parties tab → "Import from Excel"
    ├─→ Upload .xlsx / .csv
    ├─→ Column mapping (auto-detect + manual override)
    ├─→ Preview → "Import X customers"
    └─→ Conflicts: "Phone [X] already exists — skip / update / create duplicate?"
```

**Success metric:** Average time to add customer < 30 seconds (quick add). 50% of businesses import contacts in first week.

---

## Journey 7: Offline Usage

**Persona:** Raju (kirana store in area with poor network)
**Goal:** Continue billing normally when internet is gone
**Trigger:** Network drops / no WiFi / traveling

```
Normal usage → Network drops
    │
    ├─→ Small banner at top: "You're offline — data is saved locally" (non-intrusive)
    │
    ├─→ ALL these work offline:
    │       ├─→ Create/edit/delete invoices ✓
    │       ├─→ Record payments ✓
    │       ├─→ Add customers/suppliers ✓
    │       ├─→ Add/edit products ✓
    │       ├─→ View dashboard ✓
    │       ├─→ View reports (from cached data) ✓
    │       ├─→ Search anything ✓
    │       └─→ Print invoices ✓
    │
    ├─→ These DON'T work offline:
    │       ├─→ Signup/login (first time only) ✗
    │       ├─→ WhatsApp sharing (needs network) ✗
    │       ├─→ Google Drive backup (needs network) ✗
    │       ├─→ Staff invite (needs SMS/WhatsApp) ✗
    │       └─→ Subscription purchase ✗
    │
    ├─→ Network returns
    │       ├─→ Auto-sync begins (background)
    │       ├─→ Banner: "Syncing 12 changes..." → "All synced ✓" → banner disappears
    │       │
    │       └─→ [BRANCH] Conflict detected (same record edited on 2 devices)
    │               ├─→ Notification: "Conflict on Invoice #123"
    │               ├─→ Show both versions → "Keep mine" / "Keep theirs" / "Merge"
    │               └─→ Default: last-write-wins (if user doesn't respond in 24h)
    │
    └─→ Local backup still runs (save to device storage)
```

**Success metric:** 0 data loss when offline for up to 7 days. Sync completes within 30 seconds of reconnection.

---

## Journey 8: Recover from Mistake

**Persona:** All (everyone makes mistakes)
**Goal:** Undo accidental deletions, fix wrong entries
**Trigger:** Accidentally deleted invoice / entered wrong amount / staff made error

```
[Scenario A: Deleted invoice]
    │
    ├─→ After delete: Toast with "Invoice #X deleted. Undo?" (5 sec window)
    │       ├─→ Tap "Undo" → restored immediately
    │       └─→ Missed undo? → Settings → Recycle Bin
    │               ├─→ Deleted items (last 30 days)
    │               ├─→ Select → "Restore" → back to active
    │               └─→ "Empty Bin" (permanent delete — requires PIN/confirmation)
    │
[Scenario B: Wrong amount on invoice]
    │
    ├─→ Find invoice → Edit → Change amount → Save
    │       ├─→ Stock auto-adjusted (difference)
    │       ├─→ Outstanding auto-updated
    │       └─→ Audit log: "Invoice #X edited by [User] at [Time]: Amount Rs 500 → Rs 5000"
    │
    ├─→ [BRANCH] Transaction locked (older than lock period)?
    │       ├─→ "This transaction is locked. Ask admin to unlock."
    │       └─→ Admin: Settings → Unlock specific transaction → reason required
    │
[Scenario C: Staff entered wrong data]
    │
    ├─→ Admin → Activity Log → filter by staff member
    │       ├─→ See all actions: created, edited, deleted
    │       ├─→ Each entry shows: before → after values
    │       └─→ "Revert this change" → restores previous state
```

**Success metric:** 95% of accidental deletes recovered. All edits logged in audit trail.

---

## MVP Feature Validation Against Journeys

| Journey | Features Used | All Present in Phase 1? |
|---------|-------------|----------------------|
| 1. First-time setup | Auth (#1), Onboarding (#10), Opening Balances (#17), Dashboard (#50) | ✅ |
| 2. Daily billing | Invoicing (#18-34), Parties (#11-16), Inventory (#44-49), Payments (#40-43) | ✅ |
| 3. End of day | Dashboard (#50), Reports (#51-55), Reminders (#42), Backup (#5) | ✅ |
| 4. Monthly review | Reports (#51-55), PDF export (#31-32) | ✅ |
| 5. Staff management | Roles (#56), Transaction controls (#57), PIN (#58-59) | ✅ |
| 6. Add customer | Party mgmt (#11-17), Pricing (#16), Opening balances (#17) | ✅ |
| 7. Offline usage | Offline-first (#6), Backup (#5), Sync queue | ✅ |
| 8. Recover mistake | Invoice recovery (#33), Audit trail, Transaction controls (#57) | ✅ |

**All 8 journeys are fully covered by Phase 1 features.** No gaps.

---

## Approval

- [ ] Sawan reviewed and approved
- [ ] Journeys validated against real business workflows
- [ ] Edge cases reviewed
- [ ] Error messages approved
