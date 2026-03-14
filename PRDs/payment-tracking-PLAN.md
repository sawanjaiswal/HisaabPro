# Mission Plan: Payment Tracking | Status: Awaiting Approval

> **PRD #5** | **Date:** 2026-03-14 | **Owner:** Sawan Jaiswal
> **Depends on:** Party Management (PRD #2), Invoicing (PRD #3)
> **Roadmap Features:** #40 (Payment In/Out), #41 (Outstanding Tracking), #42 (Payment Reminders), #43 (Discount During Payment)
> **Phase:** 1E — MVP

---

## 1. What

Payment Tracking lets Indian small business owners record money coming in and going out, see who owes them (and who they owe), send WhatsApp reminders for overdue amounts, and apply discounts at payment time. It is the bridge between invoicing and cash — without it, a billing app is just a PDF generator.

**Why it matters:**
- 80% of micro businesses have no record of who owes what (Product Brief)
- "See who owes you money, send reminder in one tap" is a primary switch trigger
- Payment reminders are a top-5 loved feature across competitors (Roadmap Review Intelligence)
- Must work fully offline — payments happen at counters, in markets, on delivery routes

**What this PRD covers:**
1. Recording payments received (Payment In) and payments made (Payment Out)
2. Linking payments to invoices (full, partial, or multi-invoice settlement)
3. Unlinked/advance payments
4. Real-time outstanding per party with aging buckets
5. Automated and manual payment reminders via WhatsApp/SMS/push
6. Discount application at payment time

**What this PRD does NOT cover:** See Section 11 (Out of Scope).

---

## 2. Domain Model

### Entities

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│   Party      │──1:N──│    Payment        │──1:N──│ PaymentAlloc│
│ (PRD #2)     │       │                  │       │  ation      │
└─────────────┘       └──────────────────┘       └──────┬──────┘
                              │                          │
                              │ 1:N                      │ N:1
                              ▼                          ▼
                       ┌──────────────┐          ┌─────────────┐
                       │PaymentDiscount│          │   Invoice   │
                       └──────────────┘          │  (PRD #3)   │
                                                  └─────────────┘
                       ┌──────────────────┐
                       │ PaymentReminder  │──N:1── Party
                       │                  │──N:1── Invoice (optional)
                       └──────────────────┘

                       ┌──────────────────┐
                       │ ReminderConfig   │──1:1── Business
                       └──────────────────┘
```

### Entity Definitions

**Payment** — A single money movement (in or out).
- Belongs to one Party
- Has zero or more PaymentAllocations (linking it to invoices)
- Has zero or one PaymentDiscount
- Unallocated amount = advance payment or to-be-allocated-later

**PaymentAllocation** — Junction between Payment and Invoice.
- Records how much of a payment was applied to a specific invoice
- Enables partial payments and multi-invoice settlements

**PaymentDiscount** — Discount given at payment time (not invoice-level).
- Attached to exactly one Payment
- Reduces the effective outstanding for that payment

**PaymentReminder** — A single reminder sent to a party.
- Can be linked to a specific invoice or be a general outstanding reminder
- Tracks channel, status, sent time, response

**ReminderConfig** — Business-level reminder settings.
- Frequency, max reminders, quiet hours, default channel, templates

---

## 3. State Machine

### Payment Lifecycle

```
                  ┌───────────┐
                  │  CREATED  │  (saved locally, offline-safe)
                  └─────┬─────┘
                        │ save
                        ▼
               ┌────────────────┐
               │   RECORDED     │  (active payment, affects balances)
               └───┬────────┬───┘
                   │        │
            edit   │        │ delete (soft)
                   ▼        ▼
          ┌──────────┐  ┌──────────┐
          │ RECORDED │  │ DELETED  │  (recycle bin, 30 days)
          │(updated) │  └────┬─────┘
          └──────────┘       │ restore
                             ▼
                       ┌──────────┐
                       │ RECORDED │
                       └──────────┘
```

Rules:
- Payments are immediately RECORDED on save (no draft/pending state)
- Editing a RECORDED payment recalculates all linked invoice balances
- Deleting soft-deletes: moves to recycle bin, reverses balance impact
- Restoring from recycle bin re-applies balance impact
- Locked payments (older than business lock period) cannot be edited/deleted without admin unlock

### Reminder Lifecycle

```
        ┌──────────┐
        │ SCHEDULED │  (queued for future send)
        └─────┬─────┘
              │ trigger time reached
              ▼
        ┌──────────┐
        │ SENDING  │  (in transit to WhatsApp/SMS/push)
        └─────┬─────┘
              │
         ┌────┴────┐
         ▼         ▼
   ┌──────────┐  ┌──────────┐
   │   SENT   │  │  FAILED  │
   └─────┬────┘  └─────┬────┘
         │              │ retry (max 2)
         │              ▼
         │        ┌──────────┐
         │        │ SENDING  │ → SENT or PERMANENTLY_FAILED
         │        └──────────┘
         ▼
   ┌───────────────┐
   │ ACKNOWLEDGED  │  (payment received after reminder)
   └───────────────┘
```

Rules:
- SCHEDULED reminders are cancelled if invoice is fully paid before trigger time
- Max 2 retries on FAILED, then PERMANENTLY_FAILED
- ACKNOWLEDGED is set automatically when linked invoice/party outstanding reaches zero
- Manual reminders skip SCHEDULED, go directly to SENDING

---

## 4. User Flows

### Flow 1: Record Payment In (Customer pays you)

```
Entry: Dashboard "+" FAB → "Payment In"
   OR: Party profile → "Record Payment"
   OR: Invoice detail → "Record Payment"
   OR: Outstanding list → tap party → "Record Payment"

Step 1: Select Party
   ├─→ Search by name/phone (instant, top 5 recent shown)
   ├─→ Shows: Current outstanding Rs XX,XXX
   ├─→ [BRANCH] Party not found → "Add New" quick add → auto-select
   └─→ [PRE-FILLED] If entered from invoice/party, party is pre-selected

Step 2: Enter Amount
   ├─→ Amount field (numeric keyboard, auto-focus)
   ├─→ Helper text: "Outstanding: Rs XX,XXX"
   ├─→ Quick-fill buttons: "Full Amount" (outstanding) / custom
   └─→ [VALIDATION] Amount must be > 0, max 99,99,99,999 (Rs 99.99 crore)

Step 3: Payment Details
   ├─→ Date (default: today, calendar picker, can backdate)
   ├─→ Payment Mode (required):
   │       Cash | UPI | Bank Transfer | Cheque | NEFT/RTGS/IMPS | Credit Card | Other
   ├─→ Reference Number (optional, shown for non-cash modes):
   │       Placeholder by mode:
   │         UPI → "UPI Transaction ID"
   │         Cheque → "Cheque Number"
   │         Bank Transfer → "Transaction Reference"
   │         NEFT/RTGS/IMPS → "UTR Number"
   │         Credit Card → "Approval Code"
   │         Other → "Reference"
   └─→ Notes (optional, multiline, max 500 chars)

Step 4: Link to Invoices (optional)
   ├─→ "Link to Invoices" expandable section
   ├─→ Shows unpaid/partially paid invoices for this party
   │       Each row: Invoice # | Date | Total | Due | Checkbox + Amount field
   ├─→ Default: auto-allocate oldest first (FIFO)
   ├─→ User can override: manually enter amount per invoice
   ├─→ Unallocated amount shown: "Rs X will be recorded as advance payment"
   ├─→ [BRANCH] No unpaid invoices → "This will be recorded as advance payment"
   └─→ [BRANCH] Entered from specific invoice → that invoice pre-linked with full due amount

Step 5: Apply Discount (optional)
   ├─→ "Apply Discount" toggle
   ├─→ If on:
   │       ├─→ Discount type: Percentage (%) | Fixed Amount (Rs)
   │       ├─→ Discount value (numeric)
   │       ├─→ Calculated discount amount shown
   │       ├─→ Reason (optional): "Early payment" / "Long-term customer" / custom text
   │       └─→ Effective settlement: "Rs [amount] payment + Rs [discount] discount = Rs [total] settled"
   └─→ [VALIDATION] Discount cannot exceed remaining outstanding

Step 6: Review & Save
   ├─→ Summary card:
   │       Party: [Name]
   │       Amount: Rs [X]
   │       Discount: Rs [Y] (if any)
   │       Total Settled: Rs [X+Y]
   │       Mode: [mode]
   │       Date: [date]
   │       Linked Invoices: [count] ([invoice numbers])
   │       Advance: Rs [Z] (if any unlinked amount)
   │
   ├─→ "Save Payment" button
   ├─→ On save:
   │       ├─→ Saved to IndexedDB immediately (offline-safe)
   │       ├─→ Party outstanding recalculated
   │       ├─→ Linked invoice statuses updated (Paid / Partially Paid)
   │       ├─→ Queued for server sync
   │       └─→ Toast: "Payment of Rs [X] from [Party] recorded"
   │
   └─→ Post-save actions:
           ├─→ "Share Receipt on WhatsApp" → pre-formatted message
           ├─→ "Record Another Payment"
           └─→ "Done" → back to previous screen
```

### Flow 2: Record Payment Out (You pay supplier)

Identical to Flow 1 except:
- Entry label: "Payment Out"
- Party type filter: Suppliers (can override to show all)
- Outstanding shown as "You owe: Rs XX,XXX"
- Links to Purchase Invoices
- Post-save toast: "Payment of Rs [X] to [Party] recorded"

### Flow 3: Link Existing Payment to Invoice

```
Entry: Payment detail → "Link to Invoices"

Step 1: Show current allocations
   ├─→ Already linked invoices with amounts
   ├─→ Unallocated balance: Rs [X]

Step 2: Add new links
   ├─→ Show eligible invoices (same party, unpaid/partially paid)
   ├─→ Enter amount per invoice
   └─→ Save → balances recalculated

Step 3: Remove links
   ├─→ Tap existing allocation → "Unlink" → amount returns to unallocated
   └─→ Save → balances recalculated
```

### Flow 4: Send Payment Reminder

```
Entry A: Outstanding list → tap party → "Send Reminder"
Entry B: Invoice detail → "Send Reminder"
Entry C: Automated (scheduled by ReminderConfig)

Step 1: Preview Message
   ├─→ Pre-formatted message (editable):
   │
   │   "Namaskar [Party Name],
   │
   │    This is a friendly reminder regarding your outstanding
   │    balance of Rs [amount] with [Business Name].
   │
   │    [If invoice-specific:]
   │    Invoice #[number] | Date: [date] | Amount Due: Rs [due]
   │
   │    [If general outstanding:]
   │    Total Outstanding: Rs [total]
   │    Oldest Due: [date] ([X] days overdue)
   │
   │    Please arrange payment at your earliest convenience.
   │
   │    Thank you,
   │    [Business Name]
   │    [Business Phone]"
   │
   ├─→ Channel selection: WhatsApp (default) | SMS | Push Notification
   └─→ [BRANCH] Party has no phone? → "Add phone number to send reminder"

Step 2: Send
   ├─→ WhatsApp: Opens WhatsApp with pre-filled message (Capacitor share)
   ├─→ SMS: Sends via Aisensy/SMS gateway (requires credits)
   ├─→ Push: Sends if party has app installed (future — currently N/A)
   └─→ Reminder logged in PaymentReminder table

Step 3: Bulk Reminder
   ├─→ Outstanding list → select multiple parties (checkbox mode)
   ├─→ "Send Reminders ([N] selected)" button
   ├─→ Confirmation: "Send [channel] reminder to [N] parties?"
   ├─→ Sent sequentially → progress: "Sent 3 of 7..."
   └─→ Summary: "7 reminders sent, 0 failed"
```

### Flow 5: Apply Discount During Payment

Covered in Flow 1, Step 5. Additional detail:

```
Discount impact on balances:

Before: Invoice #101 total = Rs 10,000 | Paid = Rs 0 | Due = Rs 10,000
Payment: Rs 9,000 + Discount Rs 1,000 (10%)
After:  Invoice #101 total = Rs 10,000 | Paid = Rs 9,000 | Discount = Rs 1,000 | Due = Rs 0

Party Statement shows:
   Date       | Type      | Debit    | Credit   | Balance
   01-Mar     | Invoice   | 10,000   |          | 10,000
   15-Mar     | Payment   |          | 9,000    | 1,000
   15-Mar     | Discount  |          | 1,000    | 0
```

---

## 5. API Contract

All endpoints prefixed with `/api/v1`. Authentication via JWT Bearer token. All request/response bodies are JSON. Indian Rupee amounts stored as integers in paise (1 Rs = 100 paise) to avoid floating point issues.

### 5.1 Payments

#### `POST /payments`
Record a new payment.

```typescript
// Request — CreatePaymentSchema
{
  type: "PAYMENT_IN" | "PAYMENT_OUT",           // required
  partyId: string,                               // required, UUID
  amount: number,                                // required, paise, > 0, max 9999999900
  date: string,                                  // required, ISO 8601 date "2026-03-14"
  mode: "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "NEFT_RTGS_IMPS" | "CREDIT_CARD" | "OTHER",
  referenceNumber?: string,                      // max 100 chars
  notes?: string,                                // max 500 chars
  allocations?: Array<{
    invoiceId: string,                           // UUID
    amount: number,                              // paise, > 0
  }>,
  discount?: {
    type: "PERCENTAGE" | "FIXED",
    value: number,                               // percentage (0-100, 2 decimal) or paise
    reason?: string,                             // max 200 chars
  },
  offlineId?: string,                            // client-generated UUID for offline dedup
}

// Response — 201 Created
{
  success: true,
  data: {
    id: string,
    offlineId: string,
    type: "PAYMENT_IN" | "PAYMENT_OUT",
    partyId: string,
    partyName: string,
    amount: number,
    date: string,
    mode: string,
    referenceNumber: string | null,
    notes: string | null,
    allocations: Array<{
      id: string,
      invoiceId: string,
      invoiceNumber: string,
      amount: number,
    }>,
    discount: {
      id: string,
      type: "PERCENTAGE" | "FIXED",
      value: number,
      calculatedAmount: number,
      reason: string | null,
    } | null,
    unallocatedAmount: number,
    partyOutstandingAfter: number,
    createdAt: string,
    syncStatus: "SYNCED",
  }
}
```

**Validation errors (422):**
| Code | Message | Condition |
|------|---------|-----------|
| `AMOUNT_REQUIRED` | "Amount is required" | amount missing or 0 |
| `AMOUNT_EXCEEDS_MAX` | "Amount cannot exceed Rs 99,99,99,999" | amount > 9999999900 |
| `INVALID_PARTY` | "Party not found" | partyId doesn't exist |
| `INVALID_INVOICE` | "Invoice [number] not found or does not belong to this party" | invoiceId invalid |
| `ALLOCATION_EXCEEDS_DUE` | "Allocation of Rs [X] exceeds invoice [number] due amount of Rs [Y]" | allocation > invoice due |
| `TOTAL_ALLOCATION_EXCEEDS_PAYMENT` | "Total allocations (Rs [X]) exceed payment amount (Rs [Y])" | sum of allocations > amount |
| `DISCOUNT_EXCEEDS_OUTSTANDING` | "Discount Rs [X] exceeds outstanding Rs [Y]" | discount > remaining outstanding |
| `DUPLICATE_OFFLINE_ID` | "Payment already recorded" | offlineId exists (idempotent — returns existing) |

#### `GET /payments`
List payments with filters.

```typescript
// Query params
{
  page?: number,                    // default 1
  limit?: number,                   // default 20, max 100
  type?: "PAYMENT_IN" | "PAYMENT_OUT",
  partyId?: string,
  mode?: string,
  dateFrom?: string,                // ISO date
  dateTo?: string,                  // ISO date
  sortBy?: "date" | "amount" | "createdAt",  // default "date"
  sortOrder?: "asc" | "desc",       // default "desc"
  search?: string,                  // searches party name, reference, notes
}

// Response — 200 OK
{
  success: true,
  data: {
    payments: Array<PaymentSummary>,
    pagination: {
      page: number,
      limit: number,
      total: number,
      totalPages: number,
    },
    summary: {
      totalIn: number,              // paise
      totalOut: number,             // paise
      net: number,                  // paise (in - out)
    }
  }
}
```

#### `GET /payments/:id`
Get single payment with full details.

```typescript
// Response — 200 OK
{
  success: true,
  data: Payment   // full Payment object as in POST response
}
```

#### `PUT /payments/:id`
Update a payment. Same schema as POST. Recalculates all balances.

```typescript
// Additional validation errors:
| Code | Message | Condition |
|------|---------|-----------|
| `PAYMENT_LOCKED` | "This payment is locked. Ask admin to unlock." | older than lock period |
| `PAYMENT_DELETED` | "Cannot edit a deleted payment" | payment is soft-deleted |
```

```typescript
// Response — 200 OK
{
  success: true,
  data: Payment   // updated Payment object
}
```

#### `DELETE /payments/:id`
Soft-delete a payment. Moves to recycle bin.

```typescript
// Response — 200 OK
{
  success: true,
  data: {
    id: string,
    deletedAt: string,
    message: "Payment deleted. You can restore it from Recycle Bin within 30 days."
  }
}

// Validation errors:
| Code | Message | Condition |
|------|---------|-----------|
| `PAYMENT_LOCKED` | "This payment is locked. Ask admin to unlock." | older than lock period |
```

#### `POST /payments/:id/restore`
Restore a soft-deleted payment from recycle bin.

```typescript
// Response — 200 OK
{
  success: true,
  data: Payment   // restored Payment object, balances recalculated
}
```

### 5.2 Outstanding

#### `GET /outstanding`
Get outstanding summary for all parties.

```typescript
// Query params
{
  type?: "RECEIVABLE" | "PAYABLE" | "ALL",  // default "ALL"
  overdue?: boolean,                         // true = only overdue
  sortBy?: "amount" | "name" | "daysOverdue",  // default "amount"
  sortOrder?: "asc" | "desc",               // default "desc"
  search?: string,                           // party name/phone
  page?: number,
  limit?: number,                            // default 20, max 100
}

// Response — 200 OK
{
  success: true,
  data: {
    parties: Array<{
      partyId: string,
      partyName: string,
      partyPhone: string,
      partyType: "CUSTOMER" | "SUPPLIER" | "BOTH",
      outstanding: number,                   // paise (positive = they owe, negative = we owe)
      type: "RECEIVABLE" | "PAYABLE",
      invoiceCount: number,
      oldestDueDate: string | null,
      daysOverdue: number,                   // 0 if not overdue
      lastPaymentDate: string | null,
      lastReminderDate: string | null,
      aging: {
        current: number,                     // not yet due, paise
        days1to30: number,
        days31to60: number,
        days61to90: number,
        days90plus: number,
      }
    }>,
    pagination: { page, limit, total, totalPages },
    totals: {
      totalReceivable: number,               // paise
      totalPayable: number,                  // paise
      net: number,                           // paise
      overdueReceivable: number,             // paise
      overduePayable: number,               // paise
    },
    aging: {
      current: number,
      days1to30: number,
      days31to60: number,
      days61to90: number,
      days90plus: number,
    }
  }
}
```

#### `GET /outstanding/:partyId`
Get detailed outstanding for a single party.

```typescript
// Response — 200 OK
{
  success: true,
  data: {
    partyId: string,
    partyName: string,
    outstanding: number,
    invoices: Array<{
      id: string,
      number: string,
      date: string,
      dueDate: string | null,
      total: number,
      paid: number,
      discount: number,
      due: number,
      daysOverdue: number,
      status: "UNPAID" | "PARTIALLY_PAID" | "OVERDUE",
      payments: Array<{
        id: string,
        date: string,
        amount: number,
        mode: string,
      }>,
    }>,
    advanceBalance: number,                  // unallocated payment amount
    aging: { current, days1to30, days31to60, days61to90, days90plus },
  }
}
```

### 5.3 Reminders

#### `POST /reminders/send`
Send a reminder (manual trigger).

```typescript
// Request
{
  partyId: string,                           // required
  invoiceId?: string,                        // optional — specific invoice
  channel: "WHATSAPP" | "SMS" | "PUSH",     // required
  message?: string,                          // optional — custom message overrides template
}

// Response — 200 OK
{
  success: true,
  data: {
    id: string,
    partyId: string,
    invoiceId: string | null,
    channel: string,
    status: "SENT" | "FAILED",
    sentAt: string,
    message: string,
    failureReason: string | null,
  }
}
```

#### `POST /reminders/send-bulk`
Send reminders to multiple parties.

```typescript
// Request
{
  partyIds: string[],                        // required, max 50
  channel: "WHATSAPP" | "SMS" | "PUSH",
  message?: string,
}

// Response — 200 OK
{
  success: true,
  data: {
    sent: number,
    failed: number,
    results: Array<{
      partyId: string,
      partyName: string,
      status: "SENT" | "FAILED",
      failureReason: string | null,
    }>
  }
}
```

#### `GET /reminders`
List reminders sent.

```typescript
// Query params
{
  partyId?: string,
  invoiceId?: string,
  status?: "SCHEDULED" | "SENT" | "FAILED" | "ACKNOWLEDGED",
  channel?: "WHATSAPP" | "SMS" | "PUSH",
  dateFrom?: string,
  dateTo?: string,
  page?: number,
  limit?: number,
}

// Response — 200 OK
{
  success: true,
  data: {
    reminders: Array<PaymentReminder>,
    pagination: { page, limit, total, totalPages },
  }
}
```

#### `GET /reminders/config`
Get business reminder configuration.

```typescript
// Response — 200 OK
{
  success: true,
  data: {
    enabled: boolean,
    autoRemindEnabled: boolean,
    frequencyDays: number[],               // e.g. [1, 3, 7] — days after due date
    maxRemindersPerInvoice: number,        // default 5
    defaultChannel: "WHATSAPP" | "SMS" | "PUSH",
    quietHoursStart: string,               // "21:00" (9 PM)
    quietHoursEnd: string,                 // "09:00" (9 AM)
    whatsappTemplate: string,
    smsTemplate: string,
  }
}
```

#### `PUT /reminders/config`
Update reminder configuration.

```typescript
// Request — same shape as GET response data
// Response — 200 OK with updated config
```

### 5.4 Payment Allocations

#### `PUT /payments/:paymentId/allocations`
Update invoice allocations for an existing payment.

```typescript
// Request
{
  allocations: Array<{
    invoiceId: string,
    amount: number,                          // paise
  }>
}

// Response — 200 OK
{
  success: true,
  data: {
    paymentId: string,
    allocations: Array<{ id, invoiceId, invoiceNumber, amount }>,
    unallocatedAmount: number,
    updatedInvoices: Array<{ invoiceId, invoiceNumber, newDue: number, newStatus: string }>,
  }
}
```

---

## 6. Data Model

### Prisma Schema

```prisma
// ─── Payment ───────────────────────────────────────────

enum PaymentType {
  PAYMENT_IN
  PAYMENT_OUT
}

enum PaymentMode {
  CASH
  UPI
  BANK_TRANSFER
  CHEQUE
  NEFT_RTGS_IMPS
  CREDIT_CARD
  OTHER
}

enum DiscountType {
  PERCENTAGE
  FIXED
}

enum ReminderStatus {
  SCHEDULED
  SENDING
  SENT
  FAILED
  PERMANENTLY_FAILED
  ACKNOWLEDGED
}

enum ReminderChannel {
  WHATSAPP
  SMS
  PUSH
}

model Payment {
  id               String             @id @default(uuid()) @db.Uuid
  offlineId        String?            @unique                         // client-generated UUID for dedup
  businessId       String             @db.Uuid
  type             PaymentType
  partyId          String             @db.Uuid
  amount           Int                                                // paise
  date             DateTime           @db.Date
  mode             PaymentMode
  referenceNumber  String?            @db.VarChar(100)
  notes            String?            @db.VarChar(500)

  // Soft delete
  isDeleted        Boolean            @default(false)
  deletedAt        DateTime?

  // Audit
  createdBy        String             @db.Uuid
  updatedBy        String?            @db.Uuid
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  // Relations
  business         Business           @relation(fields: [businessId], references: [id])
  party            Party              @relation(fields: [partyId], references: [id])
  createdByUser    User               @relation("PaymentCreatedBy", fields: [createdBy], references: [id])
  updatedByUser    User?              @relation("PaymentUpdatedBy", fields: [updatedBy], references: [id])
  allocations      PaymentAllocation[]
  discount         PaymentDiscount?

  @@index([businessId, date])
  @@index([businessId, partyId])
  @@index([businessId, type])
  @@index([businessId, mode])
  @@index([offlineId])
  @@index([businessId, isDeleted])
  @@map("payments")
}

model PaymentAllocation {
  id          String   @id @default(uuid()) @db.Uuid
  paymentId   String   @db.Uuid
  invoiceId   String   @db.Uuid
  amount      Int                                        // paise allocated to this invoice

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  payment     Payment  @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  invoice     Invoice  @relation(fields: [invoiceId], references: [id])

  @@unique([paymentId, invoiceId])
  @@index([invoiceId])
  @@map("payment_allocations")
}

model PaymentDiscount {
  id               String       @id @default(uuid()) @db.Uuid
  paymentId        String       @unique @db.Uuid
  type             DiscountType
  value            Decimal      @db.Decimal(10, 2)       // percentage or paise
  calculatedAmount Int                                   // actual discount in paise
  reason           String?      @db.VarChar(200)

  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  // Relations
  payment          Payment      @relation(fields: [paymentId], references: [id], onDelete: Cascade)

  @@map("payment_discounts")
}

model PaymentReminder {
  id             String          @id @default(uuid()) @db.Uuid
  businessId     String          @db.Uuid
  partyId        String          @db.Uuid
  invoiceId      String?         @db.Uuid               // null = general outstanding reminder
  channel        ReminderChannel
  status         ReminderStatus  @default(SCHEDULED)
  message        String          @db.Text
  scheduledAt    DateTime?
  sentAt         DateTime?
  failureReason  String?         @db.VarChar(500)
  retryCount     Int             @default(0)
  isAutomatic    Boolean         @default(false)         // true = system-scheduled

  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  // Relations
  business       Business        @relation(fields: [businessId], references: [id])
  party          Party           @relation(fields: [partyId], references: [id])
  invoice        Invoice?        @relation(fields: [invoiceId], references: [id])

  @@index([businessId, status])
  @@index([businessId, partyId])
  @@index([scheduledAt, status])
  @@map("payment_reminders")
}

model ReminderConfig {
  id                      String          @id @default(uuid()) @db.Uuid
  businessId              String          @unique @db.Uuid
  enabled                 Boolean         @default(true)
  autoRemindEnabled       Boolean         @default(false)
  frequencyDays           Int[]           @default([1, 3, 7])    // days after due date
  maxRemindersPerInvoice  Int             @default(5)
  defaultChannel          ReminderChannel @default(WHATSAPP)
  quietHoursStart         String          @default("21:00")      // HH:mm
  quietHoursEnd           String          @default("09:00")      // HH:mm
  whatsappTemplate        String          @db.Text @default("")
  smsTemplate             String          @db.Text @default("")

  createdAt               DateTime        @default(now())
  updatedAt               DateTime        @updatedAt

  // Relations
  business                Business        @relation(fields: [businessId], references: [id])

  @@map("reminder_configs")
}
```

### IndexedDB (Dexie) Schema — Offline Storage

```typescript
// db.ts — Dexie table definitions for payment tracking

interface OfflinePayment {
  id: string;                       // client UUID
  offlineId: string;                // same as id for offline-created
  serverId?: string;                // set after sync
  type: "PAYMENT_IN" | "PAYMENT_OUT";
  partyId: string;
  amount: number;                   // paise
  date: string;                     // ISO date
  mode: PaymentMode;
  referenceNumber?: string;
  notes?: string;
  allocations: Array<{ invoiceId: string; amount: number }>;
  discount?: { type: DiscountType; value: number; calculatedAmount: number; reason?: string };
  syncStatus: "PENDING" | "SYNCED" | "CONFLICT" | "FAILED";
  syncError?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
}

interface OfflinePartyBalance {
  partyId: string;
  outstanding: number;              // paise (positive = receivable, negative = payable)
  lastUpdated: string;
}

// Dexie stores
db.version(1).stores({
  payments: "id, offlineId, serverId, partyId, type, date, mode, syncStatus, isDeleted",
  partyBalances: "partyId",
  paymentReminders: "id, partyId, invoiceId, status, scheduledAt",
  syncQueue: "++id, table, recordId, operation, createdAt",
});
```

---

## 7. UI States

### 7.1 Payment List Screen

**Route:** `/payments`

**Header:**
- Title: "Payments"
- Tabs: "All" | "Payment In" | "Payment Out"
- Filter icon → date range, payment mode, party
- Search icon → search by party name, reference number

**Summary Bar (sticky below header):**
```
┌─────────────────────────────────────┐
│  Received        Paid         Net   │
│  Rs 2,45,000    Rs 1,80,000  +65K  │
│  (green)        (red)      (green)  │
└─────────────────────────────────────┘
```

**Empty State:**
```
┌─────────────────────────────────────┐
│         [illustration]              │
│                                     │
│    No payments recorded yet         │
│                                     │
│    Record your first payment to     │
│    start tracking money in & out    │
│                                     │
│    [ Record Payment In ]            │
│    [ Record Payment Out ]           │
└─────────────────────────────────────┘
```

**List Item:**
```
┌─────────────────────────────────────┐
│ ↓ Rajesh Electronics        Rs 5,000│
│   Cash · 14 Mar 2026 · INV-0042    │
│   [Payment In badge]               │
├─────────────────────────────────────┤
│ ↑ Gupta Traders            Rs 12,000│
│   UPI · 14 Mar 2026 · 3 invoices   │
│   [Payment Out badge]              │
└─────────────────────────────────────┘
↓ = Money received (green arrow down)
↑ = Money paid (red arrow up)
```

**Loading State:** Skeleton cards (3 rows), pulsing animation.

**Error State:**
```
"Couldn't load payments. Pull down to retry."
[Retry button]
```

**Offline State:** Yellow banner: "You're offline. Showing locally saved payments."

### 7.2 Record Payment Form

**Route:** `/payments/new?type=PAYMENT_IN` or `/payments/new?type=PAYMENT_OUT`

**Layout — single scrollable form, 375px optimized:**

```
┌─────────────────────────────────────┐
│ ← Record Payment In                │
├─────────────────────────────────────┤
│                                     │
│ Party *                             │
│ ┌─────────────────────────────────┐ │
│ │ 🔍 Search customer...           │ │
│ └─────────────────────────────────┘ │
│ Outstanding: Rs 45,000              │
│                                     │
│ Amount *                Rs          │
│ ┌─────────────────────────────────┐ │
│ │                           0.00  │ │
│ └─────────────────────────────────┘ │
│ [ Full Amount: Rs 45,000 ]         │
│                                     │
│ Date *              Payment Mode *  │
│ ┌──────────────┐   ┌─────────────┐ │
│ │ 14 Mar 2026  │   │ Cash     ▾  │ │
│ └──────────────┘   └─────────────┘ │
│                                     │
│ Reference Number                    │
│ ┌─────────────────────────────────┐ │
│ │ e.g. UPI Transaction ID        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Notes                               │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ▸ Link to Invoices (3 unpaid)      │
│                                     │
│ ▸ Apply Discount                    │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │       Save Payment              │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Expanded "Link to Invoices":**
```
┌─────────────────────────────────────┐
│ ▾ Link to Invoices                  │
│                                     │
│ Auto-allocate: oldest first (FIFO)  │
│                                     │
│ ☑ INV-0038 · 01 Mar · Due 5,000    │
│   Amount: [    5,000 ]              │
│                                     │
│ ☑ INV-0042 · 10 Mar · Due 15,000   │
│   Amount: [   10,000 ]             │
│                                     │
│ ☐ INV-0045 · 13 Mar · Due 25,000   │
│   Amount: [         ]              │
│                                     │
│ Advance (unlinked): Rs 0           │
└─────────────────────────────────────┘
```

**Expanded "Apply Discount":**
```
┌─────────────────────────────────────┐
│ ▾ Apply Discount                    │
│                                     │
│ Type:  (●) Percentage  (○) Fixed   │
│                                     │
│ Value:  [  10  ] %                  │
│ Discount: Rs 1,500                 │
│                                     │
│ Reason (optional):                  │
│ ┌─────────────────────────────────┐ │
│ │ Early payment discount          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Settlement: Rs 15,000 payment       │
│           + Rs 1,500 discount       │
│           = Rs 16,500 settled       │
└─────────────────────────────────────┘
```

### 7.3 Outstanding Dashboard

**Route:** `/outstanding`

**Summary Cards (horizontal scroll on mobile):**
```
┌────────────┐ ┌────────────┐ ┌────────────┐
│ Receivable │ │  Payable   │ │    Net     │
│Rs 3,45,000 │ │Rs 1,20,000 │ │+Rs 2,25,000│
│ 12 parties │ │  5 parties │ │            │
└────────────┘ └────────────┘ └────────────┘
```

**Aging Chart (horizontal stacked bar):**
```
┌─────────────────────────────────────┐
│ Aging Breakdown (Receivable)        │
│                                     │
│ Current   ████████░░░░  Rs 1,20,000│
│ 1-30 days ██████░░░░░░  Rs 90,000  │
│ 31-60     ████░░░░░░░░  Rs 60,000  │
│ 61-90     ██░░░░░░░░░░  Rs 45,000  │
│ 90+       ███░░░░░░░░░  Rs 30,000  │
└─────────────────────────────────────┘
```

**Filter Bar:**
```
[ All ▾ ]  [ Sort: Amount ▾ ]  [ 🔍 ]
  All parties / Customers / Suppliers / Overdue only
  Sort: Amount / Name / Days overdue
```

**Party Row:**
```
┌─────────────────────────────────────┐
│ Rajesh Electronics                  │
│ Rs 45,000 receivable · 23 days     │
│ [█████░░░] 3 invoices              │
│            ↳ last paid: 21 Feb     │
│                                     │
│ [ Remind ]  [ Record Payment ]     │
└─────────────────────────────────────┘
Progress bar: green portion = paid, grey = due
```

**Empty State:**
```
┌─────────────────────────────────────┐
│         [illustration]              │
│                                     │
│    All clear! No outstanding.       │
│                                     │
│    When you create invoices,        │
│    outstanding will show here.      │
└─────────────────────────────────────┘
```

### 7.4 Reminder Settings

**Route:** `/settings/reminders`

```
┌─────────────────────────────────────┐
│ ← Payment Reminders                │
├─────────────────────────────────────┤
│                                     │
│ Enable Reminders           [ON/OFF]│
│                                     │
│ ─── Automatic Reminders ─────────  │
│                                     │
│ Auto-send reminders        [ON/OFF]│
│                                     │
│ Send reminders after due date:     │
│ ☑ 1 day    ☑ 3 days    ☑ 7 days   │
│ ☐ 14 days  ☐ 30 days              │
│                                     │
│ Max reminders per invoice:    [ 5 ]│
│                                     │
│ Default channel:                    │
│ (●) WhatsApp  (○) SMS  (○) Push   │
│                                     │
│ ─── Quiet Hours ─────────────────  │
│                                     │
│ Don't send between:                │
│ [ 9:00 PM ] and [ 9:00 AM ]       │
│                                     │
│ ─── Message Templates ───────────  │
│                                     │
│ WhatsApp Template:                  │
│ ┌─────────────────────────────────┐ │
│ │ Namaskar {party_name},         │ │
│ │ You have an outstanding...     │ │
│ └─────────────────────────────────┘ │
│ [ Edit Template ]                   │
│                                     │
│ Available variables:                │
│ {party_name} {amount} {invoice_no} │
│ {due_date} {business_name}         │
│ {business_phone} {days_overdue}    │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │         Save Settings           │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## 8. Mobile

### 8.1 Payment Entry (375px)

**Priority:** Speed. A payment must be recordable in under 8 seconds for a repeat party.

**Touch targets:** All tappable elements minimum 44x44px.

**Keyboard behavior:**
- Amount field: numeric keyboard with decimal (`inputMode="decimal"`)
- Party search: text keyboard, auto-suggest after 1 character
- Date: native date picker (Capacitor)
- Reference: text keyboard

**Gestures:**
- Swipe left on payment list item → Quick actions: Edit | Delete
- Pull to refresh on payment list
- Swipe down on form → Dismiss keyboard

**Bottom sheet pattern:**
- Payment mode selector: bottom sheet with icon grid (Cash, UPI, Bank, etc.)
- Invoice link selector: bottom sheet with scrollable list
- Post-save actions: bottom sheet

**Quick entry shortcut (from Dashboard):**
```
Dashboard → FAB "+" →
  ├─→ "Payment In" (green, first option)
  ├─→ "Payment Out" (red, second option)
  ├─→ "Invoice" (blue)
  └─→ "More..."
```

**Offline indicator on form:**
```
┌─────────────────────────────────────┐
│ ⚡ Offline — payment will sync     │
│    when you're back online          │
└─────────────────────────────────────┘
(Yellow banner, shown only when offline)
```

### 8.2 Outstanding List (375px)

**Horizontal scroll cards** at top for summary (Receivable | Payable | Net).

**Sticky filter bar** below summary — single row, horizontally scrollable chips:
```
[ All ] [ Customers ] [ Suppliers ] [ Overdue ] | Sort ▾
```

**Party cards** — full width, stacked vertically:
- Party name (bold, 16px)
- Amount (bold, 18px, green for receivable, red for payable)
- Subtext: "X invoices · Y days overdue" (14px, muted)
- Two action buttons right-aligned: [ Remind ] [ Pay ]

**Infinite scroll** with loading spinner at bottom.

### 8.3 Reminder Flow (375px)

**From outstanding list:**
1. Tap "Remind" on party card
2. Bottom sheet slides up with message preview
3. Edit if needed
4. Tap "Send via WhatsApp" → opens WhatsApp share intent
5. Return to app → toast: "Reminder sent to [Party]"

**Bulk mode:**
1. Long-press any party card → enters selection mode
2. Tap to select/deselect parties
3. Bottom bar appears: "[N] selected · [ Send Reminders ]"
4. Tap → channel selection → send all

---

## 9. Edge Cases

### 9.1 Overpayment

**Scenario:** Customer owes Rs 10,000. Payment recorded: Rs 15,000.

**Behavior:**
- Payment is recorded for full Rs 15,000
- Rs 10,000 allocated to outstanding invoices
- Rs 5,000 recorded as advance (unallocated)
- Party outstanding becomes -Rs 5,000 (advance/credit)
- Outstanding dashboard shows: "Rs 5,000 advance balance"
- Future invoices can be auto-allocated from advance

**UI copy:**
- During entry: "Rs 5,000 exceeds outstanding. It will be recorded as advance payment."
- Party profile: "Advance Balance: Rs 5,000"

### 9.2 Partial Payment Across Multiple Invoices

**Scenario:** Customer has 3 invoices (Rs 5K, Rs 10K, Rs 20K). Pays Rs 12,000.

**Default FIFO behavior:**
- INV-001 (Rs 5K): Rs 5,000 allocated → Fully Paid
- INV-002 (Rs 10K): Rs 7,000 allocated → Partially Paid (Rs 3,000 remaining)
- INV-003 (Rs 20K): Rs 0 → Unpaid

**Manual override:** User can allocate any amount to any invoice.

### 9.3 Payment for Deleted Invoice

**Scenario:** Invoice is soft-deleted after payment was linked.

**Behavior:**
- When invoice is deleted: payment allocation is automatically unlinked
- Payment amount becomes unallocated (advance)
- Warning shown: "Invoice [number] was deleted. Rs [X] has been moved to advance balance."
- If invoice is restored from recycle bin, user must manually re-link

### 9.4 Offline Payment Recording

**Scenario:** User records 5 payments while offline for 3 days.

**Behavior:**
1. Each payment saved to IndexedDB with `syncStatus: "PENDING"`
2. `offlineId` generated client-side (UUID v4)
3. Party balances updated in local `partyBalances` store
4. Invoice statuses updated in local `invoices` store
5. All changes queued in `syncQueue`
6. On reconnect:
   - Sync queue processed FIFO
   - Each payment sent to `POST /payments` with `offlineId`
   - Server uses `offlineId` for idempotency (duplicate request returns existing payment)
   - On success: `syncStatus` → "SYNCED", `serverId` set
   - On conflict (e.g., invoice already fully paid by another device):
     - `syncStatus` → "CONFLICT"
     - Notification: "Payment to [Party] has a conflict — tap to resolve"
     - Resolution screen shows both versions

**Conflict resolution UI:**
```
┌─────────────────────────────────────┐
│ ⚠ Payment Conflict                  │
│                                     │
│ Your version:                       │
│   Rs 10,000 to Rajesh, linked to   │
│   INV-0042 (now fully paid)         │
│                                     │
│ Current state:                      │
│   INV-0042 was paid on another      │
│   device on 12 Mar.                 │
│                                     │
│ [ Keep as Advance ]                 │
│ [ Delete My Payment ]              │
│ [ Edit & Retry ]                   │
└─────────────────────────────────────┘
```

### 9.5 Payment Amount Exactly Zero

**Behavior:** Blocked. Validation error: "Amount must be greater than zero."

### 9.6 Payment in Future Date

**Behavior:** Allowed (post-dated cheques are common in Indian business). Warning shown: "This payment is dated in the future ([date]). Are you sure?"

### 9.7 Editing a Payment That Has Been Allocated

**Behavior:**
- If new amount >= total allocations: allowed, unallocated portion changes
- If new amount < total allocations: "New amount Rs [X] is less than allocated amount Rs [Y]. Remove some invoice links first."

### 9.8 Discount Greater Than Payment

**Scenario:** Payment Rs 5,000, user tries to apply Rs 6,000 discount.

**Behavior:** Blocked. "Discount (Rs 6,000) cannot exceed the outstanding balance."

### 9.9 Reminder to Party With No Phone Number

**Behavior:** "Send Reminder" button is disabled. Tooltip: "Add phone number to send reminder." Tapping shows: "No phone number found for [Party]. Add it now?" → Opens party edit.

### 9.10 Reminder During Quiet Hours

**Behavior:** Scheduled reminders are held until quiet hours end. Manual reminders show warning: "It's currently quiet hours (9 PM - 9 AM). Send anyway?" → Yes sends immediately, No schedules for next morning.

### 9.11 Currency Formatting

All amounts displayed in Indian numbering system: Rs 1,00,000 (not Rs 100,000). Paise shown only when non-zero: Rs 5,000 (not Rs 5,000.00), but Rs 5,000.50 when applicable.

### 9.12 Concurrent Payment Edits (Multi-Device)

**Scenario:** Two staff members edit the same payment on different devices.

**Behavior:** Last-write-wins with notification. The second sync overwrites the first, and first user gets notification: "Payment [ID] was updated by [staff name]. Your changes were overwritten."

---

## 10. Constraints

| Constraint | Value | Rationale |
|-----------|-------|-----------|
| Max payment amount | Rs 99,99,99,999 (99.99 crore) | Covers all MSME scenarios |
| Min payment amount | Rs 0.01 (1 paisa) | Minimum currency unit |
| Amount storage | Integer (paise) | Avoid floating-point rounding |
| Max allocations per payment | 50 invoices | UI/performance limit |
| Max bulk reminders | 50 parties per batch | WhatsApp rate limiting |
| Reminder retry | Max 2 retries | Prevent spam |
| Quiet hours | Configurable, default 9PM-9AM | Indian business norms |
| Offline queue max | 500 pending payments | IndexedDB storage budget |
| Recycle bin retention | 30 days | Match invoice recycle bin |
| Reference number max | 100 characters | UTR numbers are up to 22 chars |
| Notes max | 500 characters | Sufficient for context |
| Discount reason max | 200 characters | Short description |
| Sync timeout | 30 seconds per payment | Poor network tolerance |
| Payment list page size | 20 default, 100 max | Mobile scroll performance |
| Date range | Not before business creation date, up to 1 year in future | Post-dated cheque limit |
| Template variables | 7 ({party_name}, {amount}, {invoice_no}, {due_date}, {business_name}, {business_phone}, {days_overdue}) | Cover all reminder scenarios |

---

## 11. Out of Scope

| Feature | Why | When |
|---------|-----|------|
| UPI payment collection (QR on invoice, payment links) | Requires payment gateway integration (Razorpay) | Phase 5 (#129) |
| Bank reconciliation | Requires bank statement import/API | Phase 3 (#89) |
| Cheque management / register | Tracking clearance dates, bounced cheques | Phase 3 (#92) |
| Multiple bank accounts | Tracking balances per account | Phase 3 (#93) |
| Receipt vouchers / Payment vouchers (formal documents) | Accounting document format | Phase 3 (#90, #91) |
| Double-entry ledger entries for payments | Debit/credit journal posting | Phase 3 (#83) |
| Auto-reconciliation (AI matching) | Needs ML model and usage data | Phase 7 (#147) |
| Tally export of payments | Export format | Phase 3 (#100) |
| Payment via app (collect money in-app) | Payment gateway, compliance | Phase 5 |
| Recurring payments (auto-record) | Requires recurring invoice foundation | Phase 2 (#82) |
| Multi-currency payments | Exchange rate handling | Phase 2 (#81) |
| Cash-in-hand tracking | Explicit cash account ledger | Phase 3 (#94) |
| Payment approval workflow | Requires role-based approval chain | Phase 6 |
| Payment receipt PDF generation | Need PDF template engine first | After Invoice Templates (PRD #3) |

---

## 12. Build Plan

### Phase A: Data Layer + Offline Foundation (3 days)

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Prisma schema: Payment, PaymentAllocation, PaymentDiscount models. Migration. | Schema migrated, models generated |
| 1 | Dexie schema: payments, partyBalances, syncQueue stores | Offline DB ready |
| 2 | Backend: Payment CRUD service (create, read, update, soft-delete, restore) | Service with tests |
| 2 | Backend: Balance recalculation service (on payment create/update/delete) | Balance engine |
| 3 | Offline sync: payment sync queue processor, offlineId dedup, conflict detection | Sync working e2e |

### Phase B: Payment Recording (3 days)

| Day | Task | Deliverable |
|-----|------|-------------|
| 4 | API: POST/GET/PUT/DELETE /payments endpoints with Zod validation | Endpoints tested via Postman |
| 4 | API: PUT /payments/:id/allocations endpoint | Allocation management |
| 5 | Frontend: Record Payment form (party search, amount, mode, date, ref, notes) | Form working on 375px |
| 5 | Frontend: Invoice linking section (expandable, FIFO auto-allocate) | Linking working |
| 6 | Frontend: Payment list screen (tabs, filters, search, summary bar) | List with all states |
| 6 | Frontend: Payment detail/edit screen | Edit flow working |

### Phase C: Outstanding Tracking (2 days)

| Day | Task | Deliverable |
|-----|------|-------------|
| 7 | API: GET /outstanding, GET /outstanding/:partyId endpoints | Outstanding data |
| 7 | Backend: Aging calculation (current, 1-30, 31-60, 61-90, 90+) | Aging engine |
| 8 | Frontend: Outstanding dashboard (summary cards, aging chart, party list) | Dashboard on 375px |
| 8 | Frontend: Party outstanding detail (invoice breakdown, actions) | Detail view |

### Phase D: Payment Reminders (2 days)

| Day | Task | Deliverable |
|-----|------|-------------|
| 9 | Prisma schema: PaymentReminder, ReminderConfig. Migration. | Models ready |
| 9 | API: Reminder endpoints (send, send-bulk, list, config GET/PUT) | Endpoints tested |
| 9 | Backend: Reminder scheduler (cron job, quiet hours, max limit) | Auto-reminders |
| 10 | Frontend: Send reminder flow (preview, edit, send via WhatsApp) | Manual reminder working |
| 10 | Frontend: Bulk reminder flow (multi-select, batch send) | Bulk working |
| 10 | Frontend: Reminder settings screen | Config saved |

### Phase E: Discount + Polish (2 days)

| Day | Task | Deliverable |
|-----|------|-------------|
| 11 | Prisma schema: PaymentDiscount. Migration. | Model ready |
| 11 | Frontend: Discount section in payment form (%, fixed, reason, calculated display) | Discount flow |
| 11 | Backend: Discount in balance calculation (discount reduces outstanding) | Balances correct |
| 12 | Integration testing: offline payment → sync → balance → reminder | E2E path |
| 12 | Edge case testing: overpayment, partial across invoices, conflict resolution | Edge cases handled |
| 12 | Performance: payment list with 1000+ entries, outstanding with 500+ parties | Acceptable scroll perf |

**Total: 12 working days**

### Dependencies

```
Party Management (PRD #2)  ──→  Payment Recording (Phase A-B)
Invoicing (PRD #3)         ──→  Invoice Linking (Phase B)
Notification System (#4)   ──→  Reminders (Phase D)
Offline Framework (#6)     ──→  Sync Queue (Phase A)
```

---

## 13. Acceptance Criteria

### Must Pass (MVP gate)

| # | Criterion | Test |
|---|-----------|------|
| 1 | Record Payment In with all modes | Create payment with each of 7 modes → payment appears in list, party outstanding decreases |
| 2 | Record Payment Out with all modes | Create payment out → party outstanding (payable) decreases |
| 3 | Link payment to single invoice | Record payment linked to invoice → invoice status changes to Paid, outstanding = 0 |
| 4 | Link payment to multiple invoices | Record Rs 30K payment, allocate across 3 invoices → each invoice balance updated correctly |
| 5 | Partial payment | Record Rs 5K against Rs 10K invoice → invoice status = Partially Paid, due = Rs 5K |
| 6 | Advance payment (no invoices) | Record payment with no linked invoices → shows as advance, party has credit balance |
| 7 | Outstanding dashboard shows correct totals | Create 5 invoices for 3 parties, record partial payments → totals, aging, and per-party amounts all correct |
| 8 | Aging buckets correct | Create invoices with due dates in each aging bucket → aging breakdown matches |
| 9 | Filter outstanding by type | Toggle Customers/Suppliers/Overdue → list filters correctly |
| 10 | Sort outstanding | Sort by amount/name/days overdue → order correct in all cases |
| 11 | Send WhatsApp reminder | Tap Remind on party → WhatsApp opens with correct pre-filled message containing party name, amount, business name |
| 12 | Bulk reminders | Select 3 parties → send → all 3 get reminders, summary shows 3 sent |
| 13 | Discount (percentage) | Record Rs 9K payment + 10% discount on Rs 10K outstanding → outstanding = 0, discount logged |
| 14 | Discount (fixed amount) | Record Rs 8K payment + Rs 2K fixed discount on Rs 10K outstanding → outstanding = 0 |
| 15 | Discount appears in party statement | View party statement → discount line item visible with amount and reason |
| 16 | **Offline payment recording** | Turn off network → record 3 payments → all saved locally with correct balances → turn on network → all sync successfully |
| 17 | Offline deduplication | Record payment offline → sync → send same offlineId again → no duplicate created |
| 18 | Edit payment | Edit amount from Rs 5K to Rs 8K → all linked invoice balances and party outstanding recalculated |
| 19 | Delete payment (soft) | Delete payment → moves to recycle bin, outstanding reversed |
| 20 | Restore payment | Restore from recycle bin → outstanding re-applied |
| 21 | Payment form < 8 seconds | Record payment for known party with amount + mode + save in under 8 seconds (stopwatch test) |
| 22 | Works on 375px screen | All payment screens usable on 375px width, no horizontal scroll, no cut-off text |
| 23 | Indian currency formatting | All amounts show Rs X,XX,XXX format (Indian numbering) throughout |
| 24 | Reminder config saves | Set frequency to [1,7], max 3, quiet hours 10PM-8AM → save → reload → settings persisted |
| 25 | Locked payment protection | Set lock period to 7 days → try to edit 10-day-old payment → blocked with correct message |

### Should Pass (quality gate)

| # | Criterion | Test |
|---|-----------|------|
| 26 | Overpayment handled | Pay Rs 15K on Rs 10K outstanding → Rs 5K advance shown, party balance negative |
| 27 | Future-dated payment warning | Enter date tomorrow → warning shown, payment still saveable |
| 28 | Conflict resolution (offline) | Record payment on 2 devices for same invoice → conflict detected, resolution UI shown |
| 29 | Empty states correct | New business, no payments → empty state illustration and CTA shown on payments list and outstanding |
| 30 | Search payments | Search by party name, reference number → correct results |
| 31 | Payment summary accurate | Summary bar (received/paid/net) matches sum of filtered payments |
| 32 | Reminder during quiet hours | Trigger auto-reminder at 10 PM → held until 9 AM next day |
| 33 | No reminder after payment | Invoice paid in full → scheduled reminder auto-cancelled |
| 34 | Skeleton loading | Navigate to payments list → skeleton shown before data loads |
| 35 | Swipe to delete | Swipe left on payment → delete option, confirm → soft-deleted |

---

## Approval

- [ ] Sawan reviewed and approved
- [ ] Domain model validated against DudhHisaab patterns
- [ ] API contract reviewed for consistency with existing endpoints
- [ ] Offline sync approach validated against existing sync framework
- [ ] Reminder templates approved (language, tone)
- [ ] Edge cases reviewed for completeness
