---
status: draft
feature: payments-collections-hub
created: 2026-05-05T23:11:00Z
approver: pending
phase: mvp-extension
agents_required:
  - scope-writer (this document)
  - architect (TRD required before implementation)
  - security (UPI payment links + Razorpay collect flows)
  - task-manager (gate enforcement before code)
---

# Payments & Collections Hub — PRD (v1 Gold Draft)

## Executive Summary

HisaabPro already records what is owed; the Payments & Collections Hub converts
that information into a daily action system. This epic adds a receivables aging
dashboard, bulk WhatsApp reminder dispatch, automated reminder cadences, Razorpay
UPI Collect / payment links per invoice, customer statement PDFs, a 30-day
cash-flow forecast, and Promise-to-Pay (PTP) commitment tracking — all surfaced
in a single "Collections" tab built for the mobile-first MSME owner whose
outstanding receivables are the single largest risk to their business.

---

## 1. Problem Statement — By Persona

### Raju — Micro Retailer (Rs 1–5L / month, 0–1 staff)

> "Mujhe yaad nahi rehta kaun kitna baaki hai. Main invoice khol khol ke check
> karta hun, bahut time lagta hai."
> *(I can't remember who owes how much. I open invoice after invoice to check —
> it takes forever.)*

> "WhatsApp se reminder bhejta hun, but ek-ek karke. Dus customer hain toh dus
> baar karna padta hai."
> *(I send reminders on WhatsApp, but one by one. Ten customers means ten
> separate chats.)*

Raju's pain: **no aggregated view, no bulk action, no pattern to follow**.
He loses track after 30 days; by 90 days the money is effectively written off.
He has no staff to follow up and hates feeling awkward chasing small businesses
he knows personally.

---

### Priya — Growing Wholesaler (Rs 5–25L / month, 2–5 staff)

> "Mera Rs 3 lakh se zyada paisa 60 din se upar ka hai. Pata hi nahi chala kab
> itna ho gaya."
> *(More than Rs 3 lakh of my money is over 60 days old. I didn't even realise
> when it piled up.)*

> "Customer bol deta hai — 'shukravar ko de dunga' — phir shukravar ko phone
> nahi uthata."
> *(Customer says 'I'll pay Friday' — then doesn't pick up on Friday.)*

Priya's pain: **no aging visibility, no broken-promise tracking, no predictable
inflow**. She manages credit across 40–80 active parties with payment terms from
NET 7 to NET 60. Without aging buckets she cannot tell her accountant which
debtors to prioritise.

---

### Amit — Multi-Location Distributor (Rs 25L–2Cr / month, 5–20 staff)

> "Mera collections manager roze puchta hai — aaj kitna aaya, kitna baaki hai?
> Mujhe koi ek jagah se dekhna chahiye — expected, received, overdue."
> *(My collections manager asks every day — how much came in today, how much is
> still outstanding? I need one place to see expected, received, overdue.)*

> "Razorpay payment link bhejne mein time lagta hai — ek-ek invoice ke liye
> manually banana padta hai."
> *(Creating a Razorpay payment link takes time — I have to make one manually
> for each invoice.)*

Amit's pain: **no cash-flow forecast, no automated payment-link generation,
no collections workflow for staff**. He runs WhatsApp groups and spreadsheets in
parallel, which creates double entry and errors.

---

## 2. Goals

### P0 — Must Ship (MVP)

| # | Goal | Metric |
|---|------|--------|
| G1 | Give every user a single screen showing total receivables by aging bucket | % of DAU who open Collections tab ≥ 30% by week 4 |
| G2 | Reduce time-to-send bulk reminders from 10+ taps to 2 taps | Bulk reminder session < 60 seconds (p90) |
| G3 | Generate per-invoice Razorpay payment links from within the app | Payment link creation per week per active business ≥ 3 |
| G4 | Allow business owners to record customer payment promises and track if kept | PTP entry rate ≥ 1 per active business per week |
| G5 | Produce a customer account statement PDF shareable via WhatsApp in one tap | Statement share event per business per week ≥ 2 |

### P1 — Phase 2 (Next Iteration)

| # | Goal |
|---|------|
| G6 | Auto-cadence reminder rules (T+7, T+14, T+30) with quiet hours |
| G7 | 30-day cash-flow forecast from due dates + PTP dates |
| G8 | UPI Collect deep link (open UPI app directly — no Razorpay checkout) |
| G9 | Per-party reminder history timeline with delivery receipts |

---

## 3. Non-Goals (Explicit)

- **WhatsApp Cloud API / Meta BSP integration** — current delivery uses `wa.me`
  deep links, not template APIs. No change to this in this epic.
- **AI-drafted reminder messages** — templates are user-editable text only.
  No LLM-generated copy in this epic.
- **Legal escalation / demand notice generation** — out of scope entirely.
- **SMS delivery confirmation** — SMS goes through `notification.service.ts`;
  delivery receipts require DLT compliance infrastructure not in this epic.
- **Bank account auto-reconciliation** — matching inbound bank credits to
  outstanding invoices is a Phase 4 banking feature.
- **Bulk invoice PDF email blast** — email delivery is blocked on Resend
  credentials; not unblocked in this epic.
- **Customer-facing payment portal** — no web URL for customers to view all
  their dues. Only per-invoice Razorpay link.
- **Multi-currency collections** — all outstanding amounts shown in INR only,
  converted at the rate stored on the document.
- **Collections staff module** — no assignment of individual invoices to staff
  members; no role-based collections queue. Out of scope.
- **Automatic write-off of bad debt** — manual journal entry remains the path.
- **NACH / mandate-based auto-debit** — not in this epic.

---

## 4. User Stories (Job-to-Be-Done Format)

Stories are tagged `[MVP]` or `[P2]`. MVP stories are the build scope;
P2 stories are the design target that architects must keep in mind.

### Surface 1 — Receivables Aging Dashboard

**US-01 [MVP]**
When Raju opens the app, he wants to see his total receivable amount split by
0–30 / 31–60 / 61–90 / 90+ day buckets at a glance, so he instantly knows
where his money is stuck without opening any invoice.

**US-02 [MVP]**
When Priya taps the "61–90 days" bucket, she wants to see the list of parties
within that bucket with each party's overdue total, so she can call the highest
ones first.

**US-03 [MVP]**
When Amit opens the Collections tab, he wants to see the top-5 outstanding
parties by amount at the top of the aging dashboard, so his collections manager
can prioritise calls without filtering.

**US-04 [P2]**
When the aging dashboard is open, Priya wants to tap any party row and see a
mini-timeline of invoices, reminders sent, and payments received for that party,
so she has full context before calling.

---

### Surface 2 — Bulk Payment Reminders

**US-05 [MVP]**
When Raju is on the 0–30 day bucket list, he wants to select all parties and
send a single WhatsApp reminder in one tap, with a personalised message that
includes each customer's name and outstanding amount, so he does not have to
type individual messages.

**US-06 [MVP]**
When Priya selects 12 parties and taps "Send Reminder", she wants to see a
live result screen (sent: 10 / failed: 2 — no phone number found), so she knows
which parties could not be reached and can follow up manually.

**US-07 [MVP]**
When a reminder message is composed, Raju wants to preview the message for one
party before sending the batch, so he can confirm the tone is correct before
sending to all selected parties.

**US-08 [P2]**
When Priya reviews reminder history, she wants to see which party received a
reminder on which date via which channel, and whether the party paid within 7
days of the reminder, so she can measure if reminders are effective.

---

### Surface 3 — Auto-Cadence Reminders

**US-09 [P2]**
When Amit enables auto-cadence, he wants to set rules such as "send WhatsApp
reminder at T+7, T+14, T+30 after invoice due date", so his staff does not have
to manually track which invoices need reminders today.

**US-10 [P2]**
When a customer's invoice is already paid, Amit wants the auto-cadence to stop
silently without sending a reminder, so customers who have already paid do not
receive embarrassing messages.

---

### Surface 4 — UPI Collect / Razorpay Payment Links

**US-11 [MVP]**
When Raju is on an overdue invoice detail page, he wants to generate a Razorpay
payment link for exactly the outstanding amount and copy it to clipboard in one
tap, so he can paste it into a WhatsApp message to the customer.

**US-12 [MVP]**
When Priya sends a bulk reminder, she wants to optionally attach a payment link
to the message, so customers can pay directly from the WhatsApp message without
calling back.

**US-13 [MVP]**
When a Razorpay payment link is paid, Amit wants the payment to be automatically
recorded against the invoice and the outstanding balance to be updated, so he
does not have to manually enter the payment.

**US-14 [P2]**
When generating a payment link, Priya wants to set a link expiry date (e.g.
48 hours), so the link cannot be used for a delayed partial payment after she
has received cash.

---

### Surface 5 — Customer Statement PDF

**US-15 [MVP]**
When Raju's customer Gopal asks "bhai kitna baaki hai mera?" (bro, how much is
pending?), Raju wants to generate a PDF statement for Gopal showing opening
balance, all invoices, all payments, and closing balance for the last 3 months,
and share it directly on WhatsApp in 2 taps.

**US-16 [MVP]**
When Priya generates a statement for a party, she wants to choose the date
range (this month / last 3 months / this financial year / custom), so the
statement covers the period relevant to the dispute.

**US-17 [P2]**
When Amit generates a statement, he wants it to include each invoice's aging
days and a "Remarks" column where he can type a short note (e.g., "cheque
bounced on 12 Apr"), so the statement doubles as a collections summary.

---

### Surface 6 — Cash-Flow Forecast

**US-18 [P2]**
When Priya opens the Cash-Flow Forecast, she wants to see a 30-day bar chart
where each bar represents expected inflows for that date (from invoice due
dates), so she can plan her vendor payments accordingly.

**US-19 [P2]**
When a PTP date is recorded, Amit wants the forecast bar to show both
"contractual due" and "promised" amounts separately, so he can see what is
legally due vs. what customers have committed to.

---

### Surface 7 — Promise-to-Pay (PTP) Tracking

**US-20 [MVP]**
When Priya finishes a phone call where a customer promises to pay Rs 15,000 by
Friday, she wants to record this commitment against the party in 10 seconds
(amount + date + optional note), so she has a record in the app.

**US-21 [MVP]**
When the promised date passes without a payment being recorded, Priya wants the
PTP entry to automatically flip to "Broken" status and surface on the Collections
dashboard as an alert, so she knows which commitments were not kept.

**US-22 [MVP]**
When Raju views a party's profile, he wants to see all open and broken PTPs for
that party at the top of the page, so he knows the party's payment commitment
history before calling.

---

## 5. Functional Requirements (MoSCoW)

### 5.1 Receivables Aging Dashboard

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | The Collections tab MUST display total receivable paise in four buckets: 0–30 days, 31–60 days, 61–90 days, 90+ days, computed from `Document.dueDate` | Must |
| FR-02 | Each bucket tile MUST show: bucket label, party count, total amount in Rs X,XX,XXX format, and a colour indicator (green / amber / orange / red) | Must |
| FR-03 | Tapping any bucket MUST navigate to a filtered party list showing only parties with invoices falling in that aging range | Must |
| FR-04 | The party list within a bucket MUST show: party name, phone (masked), total outstanding in this bucket, last payment date, overdue invoice count | Must |
| FR-05 | The aging bucket computation MUST age from `Document.dueDate` if set; fall back to `Document.documentDate + 30 days` if `dueDate` is null | Must |
| FR-06 | The dashboard MUST also show a "Total Receivables" strip: aggregate receivable across all parties (sum of positive `Party.outstandingBalance`) | Must |
| FR-07 | The dashboard MUST show a "Top 5 Outstanding Parties" ranked by total overdue amount | Must |
| FR-08 | Amounts MUST display in Indian number format: Rs 1,00,000 — not Rs 100,000 | Must |
| FR-09 | The dashboard SHOULD load within 2 seconds on a 3G connection (200 kbps) | Should |
| FR-10 | The aging data MUST respect the offline-first pattern: last-fetched result shown from IDB cache; a "Last updated X min ago" label displayed | Must |
| FR-11 | The SHOULD have a party-level drill-down showing that party's invoices grouped by aging bucket | Should |
| FR-12 | Total payables (negative `outstandingBalance`) MUST be shown separately; Collections tab is receivables-only | Must |

---

### 5.2 Bulk Payment Reminders

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-13 | A "Select" mode MUST be available on the party list (aging bucket or full outstanding list) allowing multi-select with checkboxes | Must |
| FR-14 | A "Select All on page" control MUST be present; selecting all MUST exclude parties with no phone number | Must |
| FR-15 | Tapping "Send Reminder" on a selection MUST open a Reminder Composer bottom sheet | Must |
| FR-16 | The Reminder Composer MUST show: message template (editable), channel selector (WhatsApp / SMS), preview of one substituted message, party count | Must |
| FR-17 | The message template MUST support these substitution tokens: `{{name}}`, `{{amount}}`, `{{business_name}}`, `{{due_date}}`, `{{oldest_invoice_date}}` | Must |
| FR-18 | The app MUST ship with 3 default reminder templates: Polite (under 30 days), Firm (30–60 days), Urgent (60+ days) | Must |
| FR-19 | Tapping "Send" MUST call `POST /api/payments/reminders/bulk` and show a real-time progress indicator | Must |
| FR-20 | After sending, a result screen MUST show: sent count, failed count, failed party names with reason (no phone / delivery error) | Must |
| FR-21 | Parties with no phone number MUST be excluded from sending; a warning badge MUST be shown during party selection | Must |
| FR-22 | Each reminder MUST be stored as a `PaymentReminder` record (channel, status, sentAt, message, isAutomatic=false) | Must |
| FR-23 | WhatsApp delivery uses `wa.me/<phone>?text=<encoded_message>` — no Cloud API. The tap opens the OS WhatsApp app; delivery is not confirmed programmatically | Must |
| FR-24 | The bulk reminder SHOULD support a payment link attachment: if enabled, a Razorpay link is generated per party and appended to the message | Should |
| FR-25 | Bulk reminder batch MUST be rate-limited to 50 parties per action to prevent abuse | Must |

---

### 5.3 Auto-Cadence Reminders (Phase 2)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-26 | The `ReminderConfig` model already has `autoRemindEnabled` and `frequencyDays` fields — these MUST be surfaced in Settings > Collections | Could |
| FR-27 | When `autoRemindEnabled = true`, a background job MUST evaluate all overdue invoices daily and enqueue reminders for parties whose `dueDate + frequencyDays[n]` equals today | Could |
| FR-28 | The auto-cadence MUST respect `quietHoursStart` / `quietHoursEnd` from `ReminderConfig` | Could |
| FR-29 | Auto-reminders MUST be skipped for invoices with `balanceDue = 0` | Could |
| FR-30 | Auto-reminders MUST be capped at `maxRemindersPerInvoice` (default 5) per invoice | Could |
| FR-31 | A "Reminders sent today" count MUST be visible in the Collections tab header | Could |

---

### 5.4 UPI Collect / Razorpay Payment Links

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-32 | On any SALE_INVOICE detail page with `balanceDue > 0`, a "Get Payment Link" button MUST be visible | Must |
| FR-33 | Tapping "Get Payment Link" MUST call `POST /api/payments/payment-links` and return a `shortUrl` within 3 seconds | Must |
| FR-34 | The `amount` sent to Razorpay MUST equal the invoice's current `balanceDue` in paise (not grandTotal) | Must |
| FR-35 | The payment link record MUST be stored with: `invoiceId`, `partyId`, `amount`, `razorpayLinkId`, `shortUrl`, `status` (CREATED / PAID / EXPIRED / CANCELLED), `expiresAt` | Must |
| FR-36 | Once created, the shortUrl MUST be copyable to clipboard with one tap and shareable via WhatsApp with a second tap | Must |
| FR-37 | The invoice detail page MUST show: active link (if any), link status, link creation date, link expiry | Must |
| FR-38 | If the party has no email, the Razorpay link MUST still be created using the party's phone number | Must |
| FR-39 | Razorpay webhook `payment_link.paid` MUST trigger: record a Payment, allocate to invoice, update `balanceDue`, update link status to PAID | Must |
| FR-40 | Only one active (non-expired, non-paid) payment link per invoice is allowed — attempting to create a second MUST return the existing link | Must |
| FR-41 | If Razorpay is not configured (missing credentials), "Get Payment Link" MUST show a setup prompt: "Connect Razorpay to enable payment links" | Must |
| FR-42 | A payment link MAY be cancelled before payment — "Cancel Link" option on invoice detail | Should |
| FR-43 | Default link expiry MUST be 7 days; user MAY override to 1 / 3 / 7 / 14 / 30 days in Settings | Should |

---

### 5.5 Customer Statement PDF

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-44 | On any Party detail page, a "Statement" button MUST be visible | Must |
| FR-45 | Tapping "Statement" MUST open a date range picker with presets: This Month, Last 3 Months, This Financial Year, Custom | Must |
| FR-46 | The statement MUST show: business header (logo, name, GSTIN if present), party details, opening balance, line-by-line transactions (invoice numbers, dates, amounts, payments), closing balance | Must |
| FR-47 | Transactions MUST be ordered by date ascending within the selected period | Must |
| FR-48 | Invoice rows MUST show: invoice number, date, total amount, amount paid, balance due | Must |
| FR-49 | Payment rows MUST show: payment reference (if any), date, mode, amount received | Must |
| FR-50 | The statement MUST be generated client-side via React-PDF (no server roundtrip) — consistent with existing template engine | Must |
| FR-51 | "Share on WhatsApp" MUST trigger the Capacitor share sheet on mobile, passing the PDF file | Must |
| FR-52 | The statement MUST include a printed footer: "This is a computer-generated statement. As of [date]." | Must |
| FR-53 | The statement SHOULD show each invoice's aging days at the time of statement generation (e.g., "45 days overdue") | Should |
| FR-54 | Currency on the statement MUST be INR with Indian number formatting throughout | Must |
| FR-55 | The statement MUST be generatable offline using cached party + document data | Must |
| FR-56 | If no transactions exist in the selected period, the empty state MUST read: "No transactions between [date] and [date]" with a "Change Period" CTA | Must |

---

### 5.6 Cash-Flow Forecast (Phase 2)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-57 | A "Forecast" section in the Collections tab MUST show a 30-day rolling bar chart | Could |
| FR-58 | Each bar represents a calendar date; bar height = sum of `balanceDue` for invoices with `dueDate` on that date | Could |
| FR-59 | PTP entries MUST be overlaid as a second data series (distinct colour) showing committed amounts by promised date | Could |
| FR-60 | Tapping any bar MUST show a list of invoices due on that date with party name and amount | Could |
| FR-61 | The chart MUST label axes in Indian format (Rs X L = lakhs; Rs X K = thousands) | Could |
| FR-62 | If `dueDate` is null on invoices, those invoices MUST be excluded from the forecast (not defaulted) | Could |

---

### 5.7 Promise-to-Pay (PTP) Tracking

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-63 | A "Record Promise" action MUST be available from: party detail page, overdue invoice detail page, and aging bucket party list row | Must |
| FR-64 | The PTP form MUST capture: amount (pre-filled with `balanceDue`), promised date, optional note | Must |
| FR-65 | A PTP entry MUST be stored as a new `PromiseToPay` record linked to `businessId`, `partyId`, and optionally `invoiceId` | Must |
| FR-66 | PTP status lifecycle: `OPEN` → `KEPT` (when payment >= PTP amount recorded before/on date) or `BROKEN` (when date passes with no payment) | Must |
| FR-67 | Status evaluation MUST run server-side on a daily cron; the client reads the current status | Must |
| FR-68 | Broken PTPs MUST be shown as red alert rows in the Collections dashboard above the aging buckets | Must |
| FR-69 | Each party detail page MUST show a "Commitments" section listing all PTPs (open, kept, broken) in reverse chronological order | Must |
| FR-70 | Editing a PTP (change date, change amount) MUST be allowed only when status = OPEN | Must |
| FR-71 | Deleting a PTP MUST be allowed only when status = OPEN; broken PTPs are immutable (audit trail) | Must |
| FR-72 | When a payment is recorded manually and a PTP exists for that party with `promisedDate >= today`, the system MUST prompt: "Mark the promise from [party name] as kept?" | Should |
| FR-73 | PTP count (open + broken) MUST be shown as a badge on the party row in the outstanding list | Should |

---

## 6. UX Flows — 4 States Each

### 6.1 Collections Tab — Receivables Aging Dashboard

**Entry point:** Bottom navigation tab "Collections" (new tab, 5th position).

**Loading state:**
- Skeleton cards for 4 aging buckets with shimmer animation
- Skeleton strip for total receivables
- Skeleton list for top 5 parties
- No spinner; no blank white flash
- Duration: < 1s on wifi; 2–3s on 2G (data comes from IDB cache first)

**Error state:**
- Single error banner below the header: "Could not load collections data. Tap to retry."
- Retry fetches from server and updates IDB
- Previously cached data shown beneath banner (stale label: "As of [time]")
- No full-page error; never hide all data on a soft network error

**Empty state:**
- Shown only when `outstandingBalance = 0` across all parties
- Illustration: a tick mark over a ledger
- Heading: "All caught up!"
- Sub-copy: "You have no outstanding receivables right now."
- CTA: "View All Payments" → navigates to Payments list

**Success state:**
- Total Receivable strip: "Total Outstanding: Rs X,XX,XXX" in large teal text
- 4 bucket tiles in a 2x2 grid: 0–30 (green), 31–60 (amber), 61–90 (orange), 90+ (red)
- Each tile: bucket label top-left, party count badge top-right, amount large center
- Broken PTP alerts section (if any): red pill list "Gopal Traders promised Rs 5,000 by 28 Apr — not paid"
- Top 5 Outstanding Parties: horizontal scrollable cards or a 5-row list

---

### 6.2 Bulk Reminder — Composer Bottom Sheet

**Loading state (after "Send Reminder" tapped):**
- Bottom sheet appears; 3-step progress bar
- Step 1 (instant): template pre-filled, party count shown
- Step 2 (on Send tap): "Sending to X parties…" with a party-by-party counter
- Step 3: result screen

**Error state:**
- If the API call to create reminder records fails: "Could not prepare reminders. Try again."
- Retry available; does not partially send
- If WhatsApp is not installed on device: OS shows "No app found to handle this" — the app cannot intercept this; the error is at OS level

**Empty state (zero parties selected):**
- Send button is disabled (greyed out)
- Helper text below selection: "Select at least 1 party to send a reminder"

**Success state:**
- Result card:
  - "Reminders Sent" section: green check, "X reminders prepared"
  - Note: "WhatsApp will open for each message — the app cannot confirm delivery"
  - "Could Not Send" section (if any): red list — party name + reason
  - Primary CTA: "Done"
  - Secondary CTA: "View Reminder History"

---

### 6.3 Payment Link Generation

**Loading state:**
- "Get Payment Link" button shows spinner, label changes to "Generating…"
- Button disabled; no second tap processed

**Error state:**
- If Razorpay not configured: bottom sheet with "Connect Razorpay" prompt and link to Settings > Integrations
- If network error: toast "Could not create link — check connection" with Retry
- If invoice already has an active link (idempotency): existing link shown; toast "Link already active — copied to clipboard"

**Empty state (no invoices with balanceDue > 0):**
- Button hidden entirely; no visual confusion for paid invoices

**Success state:**
- Bottom sheet: "Payment Link Ready"
- Amount prominently: "Rs X,XX,XXX"
- Short URL in a pill with copy icon
- "Copy Link" button (primary)
- "Share on WhatsApp" button (secondary) — prefills `wa.me` with message including link
- Expiry note: "Link valid until [date]"
- Status: "Active — not yet paid"

---

### 6.4 Customer Statement PDF

**Loading state:**
- "Statement" button on party page shows spinner
- Generating PDF client-side; usually < 2s for 100 transactions
- For > 200 transactions: progress text "Generating statement… X of Y transactions"

**Error state:**
- If date range produces zero transactions: empty state (not error)
- If React-PDF generation throws: toast "Statement generation failed. Try a shorter date range."
- If Capacitor share fails (e.g., no share target on device): "Could not share — PDF saved to Downloads"

**Empty state:**
- PDF preview shows "No transactions between [date] and [date]"
- Below the PDF preview: "Change Period" CTA
- The period picker reopens

**Success state:**
- Full-screen PDF preview (React-PDF PDFViewer)
- Bottom action bar: "Download" | "Share on WhatsApp" | "Share…" (OS sheet)
- Share on WhatsApp opens `wa.me` with a pre-written message: "Hi [name], please find your account statement attached. Total outstanding: Rs X,XX,XXX. — [business name]"
- Note: WhatsApp does not support direct file attachment via wa.me links; on mobile Capacitor share sheet is used instead, which passes the PDF file to WhatsApp natively

---

### 6.5 Promise-to-Pay — Record Form

**Loading state:**
- "Record Promise" tapped; form sheet slides up
- Pre-fills amount from `balanceDue`; no server call needed to show the form
- Saving: button shows spinner "Saving…"

**Error state:**
- Amount = 0: "Amount must be greater than zero"
- Promised date in the past: "Promised date cannot be in the past — did you mean to record a broken promise?"
- Network offline: optimistic save via offline queue; toast "Saved — will sync when online"

**Empty state (no open PTPs for party):**
- "Commitments" section on party page shows: "No commitments recorded"
- Sub-text: "Record a promise when a customer gives you a payment date"
- CTA: "Record Promise"

**Success state:**
- Toast: "Promise recorded — you'll be alerted if not received by [date]"
- PTP card appears in "Commitments" section: amount, promised date, status = OPEN (teal badge)

---

## 7. API Contract

### 7.1 Aging Dashboard

```ts
// GET /api/collections/aging
// Query params: none (scoped to authenticated businessId)
// Response 200
interface AgingResponse {
  success: true
  data: {
    summary: {
      totalReceivable: number          // paise
      totalParties: number
      buckets: {
        current:   AgingBucket        // 0–30 days
        bucket_31: AgingBucket        // 31–60 days
        bucket_61: AgingBucket        // 61–90 days
        bucket_91: AgingBucket        // 90+ days
      }
      brokenPtpCount: number
    }
    topOutstanding: Array<{
      partyId: string
      partyName: string
      phone: string | null
      totalOutstanding: number         // paise
      overdueInvoiceCount: number
    }>                                 // max 5 items
    brokenPtps: Array<{
      ptpId: string
      partyId: string
      partyName: string
      amount: number                   // paise
      promisedDate: string             // ISO 8601
      daysBroken: number
    }>
  }
}

interface AgingBucket {
  label: string                        // "0–30 days"
  totalAmount: number                  // paise
  partyCount: number
}

// GET /api/collections/aging/parties?bucket=current|31|61|91&page=1&limit=20
interface AgingPartiesResponse {
  success: true
  data: {
    parties: Array<{
      partyId: string
      partyName: string
      phone: string | null
      bucketAmount: number             // paise owed in THIS bucket
      totalOutstanding: number         // paise across all buckets
      overdueInvoiceCount: number
      lastPaymentDate: string | null   // ISO 8601
      openPtpCount: number
      brokenPtpCount: number
    }>
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }
}
```

---

### 7.2 Bulk Reminders

```ts
// POST /api/payments/reminders/bulk
// (Existing endpoint — verify schema matches)
interface BulkReminderReq {
  partyIds: string[]         // max 50
  channel: 'WHATSAPP' | 'SMS'
  message: string            // resolved template text (substitutions done client-side)
  attachPaymentLink?: boolean // Phase 2 flag
}
// Response 200
interface BulkReminderRes {
  success: true
  data: {
    sent: number
    failed: number
    results: Array<{
      partyId: string
      status: 'sent' | 'failed'
      error?: string
      paymentLinkUrl?: string  // if attachPaymentLink = true
    }>
  }
}
// Error 400: { success: false, error: { code: 'PARTY_IDS_REQUIRED' | 'BATCH_LIMIT_EXCEEDED', message: string } }
// Error 401: { success: false, error: { code: 'UNAUTHORIZED' } }
```

---

### 7.3 Payment Links

```ts
// POST /api/payments/payment-links
interface CreatePaymentLinkReq {
  invoiceId: string
  expiryDays?: number        // 1 | 3 | 7 | 14 | 30 — default 7
}
// Response 201
interface CreatePaymentLinkRes {
  success: true
  data: {
    id: string
    invoiceId: string
    partyId: string
    amount: number             // paise — equals invoice.balanceDue at creation time
    shortUrl: string           // Razorpay shortUrl
    razorpayLinkId: string
    status: 'CREATED'
    expiresAt: string          // ISO 8601
    createdAt: string
  }
}
// If link already exists and is active: HTTP 200 (not 201), returns existing record

// GET /api/payments/payment-links?invoiceId=<id>
interface GetPaymentLinksRes {
  success: true
  data: Array<{
    id: string
    amount: number
    shortUrl: string
    status: 'CREATED' | 'PAID' | 'EXPIRED' | 'CANCELLED'
    expiresAt: string
    paidAt: string | null
    createdAt: string
  }>
}

// DELETE /api/payments/payment-links/:id
// Response 200 { success: true, data: { id: string, status: 'CANCELLED' } }
// Error 409 if status !== CREATED: { success: false, error: { code: 'LINK_NOT_CANCELLABLE', message: 'Only active links can be cancelled' } }

// Webhook: POST /api/webhooks/razorpay (existing route)
// Event: payment_link.paid
// Server action:
//   1. Verify Razorpay webhook signature
//   2. Find PaymentLink by razorpayLinkId
//   3. Create Payment record (type=PAYMENT_IN, mode=UPI, referenceNumber=razorpay_payment_id)
//   4. Allocate payment to invoice via PaymentAllocation
//   5. Update Document.balanceDue and Party.outstandingBalance
//   6. Update PaymentLink.status = PAID, paidAt = now()
//   7. Return 200 immediately
```

---

### 7.4 Customer Statement

```ts
// GET /api/collections/statement/:partyId?from=<ISO>&to=<ISO>
// (Used as a data endpoint if online; PDF generation is client-side React-PDF)
interface StatementDataRes {
  success: true
  data: {
    party: {
      id: string
      name: string
      phone: string | null
      email: string | null
      gstin: string | null
      billingAddress: string | null
    }
    business: {
      name: string
      gstin: string | null
      phone: string | null
      logoUrl: string | null
    }
    period: { from: string; to: string }   // ISO 8601
    openingBalance: number                  // paise; positive = party owes business
    transactions: Array<StatementTransaction>
    closingBalance: number                  // paise
    generatedAt: string                     // ISO 8601
  }
}

interface StatementTransaction {
  date: string                              // ISO 8601
  type: 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'OPENING'
  reference: string                         // invoice number or payment ref
  description: string
  debit: number                             // paise — amount the party owes (invoice)
  credit: number                            // paise — amount received (payment)
  balance: number                           // paise — running balance
  agingDays?: number                        // only for INVOICE rows with balanceDue > 0
}
```

---

### 7.5 Promise-to-Pay

```ts
// POST /api/collections/ptp
interface CreatePtpReq {
  partyId: string
  invoiceId?: string         // optional — link to specific invoice
  amount: number             // paise
  promisedDate: string       // ISO 8601 date (YYYY-MM-DD)
  note?: string              // max 300 chars
}
// Response 201
interface CreatePtpRes {
  success: true
  data: {
    id: string
    partyId: string
    invoiceId: string | null
    amount: number
    promisedDate: string
    note: string | null
    status: 'OPEN'
    createdAt: string
  }
}

// GET /api/collections/ptp?partyId=<id>&status=OPEN|BROKEN|KEPT&page=1&limit=20
interface ListPtpRes {
  success: true
  data: {
    ptps: Array<{
      id: string
      partyId: string
      partyName: string
      invoiceId: string | null
      invoiceNumber: string | null
      amount: number
      promisedDate: string
      note: string | null
      status: 'OPEN' | 'BROKEN' | 'KEPT'
      keptPaymentId: string | null   // set when KEPT
      createdAt: string
    }>
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }
}

// PATCH /api/collections/ptp/:id
interface UpdatePtpReq {
  amount?: number
  promisedDate?: string
  note?: string
}
// Error 409 if status !== OPEN: { success: false, error: { code: 'PTP_NOT_EDITABLE', message: 'Only open promises can be edited' } }

// DELETE /api/collections/ptp/:id
// Error 409 if status !== OPEN: { success: false, error: { code: 'PTP_NOT_DELETABLE', message: 'Broken promises cannot be deleted — they are part of your audit history' } }

// POST /api/collections/ptp/:id/mark-kept
interface MarkKeptReq {
  paymentId: string  // the payment that satisfies the PTP
}
// Response 200 { success: true, data: { id: string, status: 'KEPT', keptPaymentId: string } }
```

---

## 8. Data Model

### 8.1 Existing — No Change (Confirmed Present)

| Model | Relevant Fields | Used By |
|-------|----------------|---------|
| `Party` | `outstandingBalance`, `lastTransactionAt`, `phone` | Aging dashboard, bulk reminders |
| `Document` | `balanceDue`, `dueDate`, `documentDate`, `status`, `type` | Aging computation, statement |
| `Payment` | `type`, `amount`, `date`, `mode`, `referenceNumber` | Statement, PTP fulfilment check |
| `PaymentAllocation` | `paymentId`, `invoiceId`, `amount` | Razorpay webhook auto-allocation |
| `PaymentReminder` | `channel`, `status`, `message`, `sentAt`, `isAutomatic`, `invoiceId` | Bulk reminder tracking |
| `ReminderConfig` | `autoRemindEnabled`, `frequencyDays`, `quietHoursStart` | Auto-cadence (Phase 2) |

---

### 8.2 New Models Required

```prisma
// --- Promise-to-Pay ---
model PromiseToPay {
  id          String    @id @default(cuid())
  businessId  String
  partyId     String
  invoiceId   String?
  amount      Int                           // paise
  promisedDate DateTime
  note        String?   @db.VarChar(300)
  status      String    @default("OPEN")    // OPEN | BROKEN | KEPT
  keptPaymentId String? @unique             // set when status = KEPT
  createdBy   String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  business Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  party    Party     @relation(fields: [partyId], references: [id], onDelete: Restrict)
  invoice  Document? @relation(fields: [invoiceId], references: [id], onDelete: SetNull)
  payment  Payment?  @relation(fields: [keptPaymentId], references: [id], onDelete: SetNull)
  creator  User      @relation(fields: [createdBy], references: [id], onDelete: Restrict)

  @@index([businessId, status])
  @@index([businessId, partyId])
  @@index([promisedDate, status])           // daily cron uses this
}

// --- Razorpay Payment Link ---
model PaymentLink {
  id              String    @id @default(cuid())
  businessId      String
  invoiceId       String
  partyId         String
  amount          Int                        // paise — snapshot at creation
  razorpayLinkId  String    @unique
  shortUrl        String
  status          String    @default("CREATED") // CREATED | PAID | EXPIRED | CANCELLED
  expiresAt       DateTime
  paidAt          DateTime?
  razorpayPaymentId String?                  // filled on webhook
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  business Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  invoice  Document  @relation(fields: [invoiceId], references: [id], onDelete: Restrict)
  party    Party     @relation(fields: [partyId], references: [id], onDelete: Restrict)

  @@index([businessId, status])
  @@index([invoiceId])
  @@index([expiresAt, status])               // expiry sweep cron
}
```

---

### 8.3 New Fields on Existing Models

```prisma
// Party — add relation
model Party {
  // ... existing ...
  promisesToPay  PromiseToPay[]  // NEW
  paymentLinks   PaymentLink[]   // NEW
}

// Document — add relation
model Document {
  // ... existing ...
  paymentLinks   PaymentLink[]   // NEW
  promisesToPay  PromiseToPay[]  // NEW
}

// Payment — add relation
model Payment {
  // ... existing ...
  keptPtp  PromiseToPay?  // NEW — inverse of PromiseToPay.keptPaymentId
}
```

---

### 8.4 Lifecycle Diagrams

**PaymentLink lifecycle:**
```
CREATED → (Razorpay webhook payment_link.paid) → PAID
CREATED → (expiresAt < now, daily sweep) → EXPIRED
CREATED → (user cancels) → CANCELLED
```

**PromiseToPay lifecycle:**
```
OPEN → (payment recorded >= amount, on/before promisedDate) → KEPT
OPEN → (promisedDate < today, no qualifying payment) → BROKEN (daily cron)
OPEN → (user deletes) → [deleted]
```

**ReminderStatus lifecycle (existing model, confirming):**
```
PENDING → SENT (delivery attempt succeeded)
PENDING → FAILED (no phone / delivery error)
SCHEDULED → PENDING (auto-cadence trigger, Phase 2)
```

---

## 9. Edge Cases + Failure Modes

| Scenario | Handling |
|----------|----------|
| Party has no phone number | Excluded from WhatsApp bulk reminder selection; shown in failed list with reason "No phone number" |
| Party has phone but WhatsApp not registered on that number | `wa.me` link still opens WhatsApp; customer sees "number not on WhatsApp" — app cannot detect this |
| Business owner sends reminder twice within 24 hours | No server-side deduplication; app shows warning "You sent a reminder to X of these parties in the last 24 hours" before Send |
| Razorpay payment link paid twice (race condition) | Razorpay does not allow double payment on a link; webhook fires once; idempotency key on PaymentAllocation prevents double allocation |
| Invoice deleted after payment link is created | PaymentLink.invoiceId references a soft-deleted Document; GET endpoints filter by isDeleted=false; payment link remains valid; webhook still records payment; balanceDue update silently skipped if document is deleted |
| Network fails during bulk reminder send | Remind records are created as PENDING before delivery attempt; if the device goes offline mid-batch, already-attempted parties are logged; un-attempted parties remain PENDING — a retry picks them up |
| Party promise date changed after the fact | Only allowed when status = OPEN; server validates new date is in the future |
| PTP amount recorded for party with no open invoices | Allowed — PTP can be a general promise not tied to a specific invoice |
| Payment link created for invoice in DRAFT status | Blocked: `POST /api/payments/payment-links` validates `Document.status` must be SAVED or SHARED |
| Payment link expiry sweep runs while link is being paid | Race: Razorpay webhook marks PAID; sweep ignores PAID links; safe |
| Statement generated for party with zero transactions | Empty state PDF with opening balance = closing balance = 0; shows "No transactions" watermark |
| Statement opening balance calculation | Opening balance = sum of all transactions before `from` date: positive paise = party owes business |
| Indian phone number format variance | Normalize all phone numbers to E.164 (+91XXXXXXXXXX) before passing to `wa.me`; strip leading 0 or +91 on entry |
| WhatsApp link character limit | `wa.me` text limit ~4096 chars; payment link messages are < 300 chars; no truncation needed |
| Razorpay not configured (no credentials) | Payment link button shows setup prompt; bulk reminder still works without payment link attachment |
| Bulk reminder batch > 50 | Server returns 400 BATCH_LIMIT_EXCEEDED; client enforces max selection before send button is enabled |
| Auto-cadence fires for an invoice that was just paid (race with manual payment) | Cron checks `Document.balanceDue > 0` immediately before dispatching; if zero, reminder is skipped and auto-cancelled |
| Broken PTP when partial payment was made | PTP status: if party paid Rs 8,000 against a Rs 10,000 promise, the PTP remains OPEN (partial does not auto-keep); business owner manually marks kept or records a new PTP for the remainder |
| Currency on payment link vs invoice | Payment links always in INR paise — Razorpay India does not support foreign-currency links; multi-currency invoices show the INR equivalent amount on the link |
| Offline — PTP creation | PTP form submits via offline queue (entityType: 'ptp', entityLabel: party name + amount + date); local IDB record created optimistically; synced when online |
| Offline — statement generation | Statement data endpoint not available; React-PDF falls back to IDB-cached transactions; an "Offline — data may be incomplete" banner shown on the PDF |

---

## 10. Security Considerations

| Area | Requirement |
|------|-------------|
| Auth | All `/api/collections/*` and `/api/payments/payment-links` routes require `Authorization` cookie (existing middleware); 401 if missing |
| Business isolation | Every query scopes to `businessId` derived from JWT; no cross-tenant leakage |
| Razorpay webhook signature | `X-Razorpay-Signature` header MUST be verified with `crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)` before processing; existing `razorpay.ts` webhook route handles this — confirm `payment_link.paid` event is added |
| Phone number exposure | Phone numbers shown in bulk reminder UI are masked as `+91 XXXXX 67890` in the UI list; full number passed to `wa.me` link |
| Payment link amount | Server re-reads `Document.balanceDue` at payment-link creation time; does not trust client-provided amount |
| PTP amount | No financial consequence — PTP is a tracking record only; no funds are moved; no strict validation beyond > 0 |
| Rate limiting | Bulk reminder endpoint rate-limited to 1 batch per 10 minutes per business (use existing `rate-limit` middleware) |
| Razorpay credentials | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` via env only; never logged |

---

## 11. Success Metrics

### Primary (P0 — tracked from launch week)

| Metric | Target (30 days post-launch) | Measurement |
|--------|------------------------------|-------------|
| Collections tab DAU / total DAU | ≥ 30% | Event: `collections_tab_viewed` |
| % of businesses with ≥ 1 bulk reminder sent | ≥ 40% | Event: `bulk_reminder_sent` |
| Outstanding collected within 30 days of reminder | ≥ 25% improvement vs. control (businesses not using reminders) | Cohort analysis: `payment_recorded` within 30d of `reminder_sent` |
| Payment links generated per active business per week | ≥ 3 | Event: `payment_link_created` |
| % of payment links that result in a payment | ≥ 35% | `PaymentLink.status = PAID` / total created |
| Customer statements shared per active business per week | ≥ 2 | Event: `statement_shared` |
| PTP entries per active business per week | ≥ 1 | Event: `ptp_created` |
| PTP kept rate | ≥ 55% | `PromiseToPay.status = KEPT` / total created |

### Secondary (P1 — by end of month 2)

| Metric | Target |
|--------|--------|
| Average days-to-collect (invoice save to payment received) | Reduce from baseline by ≥ 10 days |
| 90+ day bucket as % of total receivable | Reduce by ≥ 15 percentage points vs pre-launch baseline |
| Support tickets about "how to chase overdue payments" | ≥ 50% reduction |
| Churn rate for businesses using Collections tab ≥ 3 times/week | ≤ 50% of baseline churn rate |

---

## 12. Out of Scope (Explicit)

The following are intentionally excluded from this epic. They are documented
here so that during implementation review the team does not inadvertently build
or commit to building them.

1. **WhatsApp Cloud API / Meta BSP integration** — `wa.me` deep links are the
   delivery mechanism; no template approval, no read receipts, no delivered
   status from Meta.
2. **AI-generated reminder message drafts** — all templates are user-editable
   plain text with token substitution only.
3. **SMS DLT compliance / sender ID registration** — SMS delivery exists in
   `notification.service.ts` as a stub; making it production-ready requires
   DLT registration with TRAI-approved vendors, which is a separate compliance
   project.
4. **Customer-facing web payment portal** — no shareable URL where the
   customer sees all their dues; Razorpay's own payment page is the customer
   view.
5. **NACH / e-mandate auto-debit** — mandate-based recurring collections are
   Phase 7 (AI & Differentiators).
6. **Collections staff assignment** — no workflow where the business owner
   assigns an invoice to a staff member for follow-up.
7. **Bank auto-reconciliation of inbound credits** — matching bank statement
   credits to outstanding invoices is Phase 4 (Advanced Inventory & Accounting).
8. **Bulk invoice PDF email blast** — email blocked on Resend credentials.
9. **Escalation workflows** — no legal notice generation, demand draft, or
   escalation to a lawyer.
10. **WhatsApp Business verified sender badge** — the `wa.me` link opens
    WhatsApp from the user's own number; no verified business profile needed.
11. **Forecasting for payables** — cash-flow forecast covers receivables only
    (what will come in); vendor payment scheduling is out of scope.
12. **Multi-currency payment links** — Razorpay India payment links are INR
    only; multi-currency invoices display the INR equivalent.
13. **Aging of payables on the Collections tab** — payables aging is accessible
    from the existing Outstanding page; Collections tab is receivables-first.
14. **UPI QR code on invoice** — static QR on PDF template is a separate
    template-engine feature, not part of this epic.
15. **PTP to legal notice escalation** — broken PTPs are flagged only; no
    automated legal action or template generation.

---

## 13. UX Copy — Complete Spec

### Navigation

| Element | Copy |
|---------|------|
| Tab label | Collections |
| Tab icon | Coins / wallet icon (distinct from Payments tab) |
| Page title (aging dashboard) | Collections |
| Page sub-header | Outstanding · Reminders · Promises |

### Aging Dashboard

| Element | Copy |
|---------|------|
| Total strip label | Total Outstanding |
| 0–30 days bucket label | Current (0–30 days) |
| 31–60 days bucket label | Overdue (31–60 days) |
| 61–90 days bucket label | Ageing (61–90 days) |
| 90+ days bucket label | Critical (90+ days) |
| Top 5 section label | Largest Outstanding Parties |
| Broken PTP alert label | Promises Broken |
| "Last updated" label | Updated [X min ago] · Tap to refresh |
| Empty state heading | All caught up! |
| Empty state sub-copy | No outstanding receivables right now. |
| Empty state CTA | View All Payments |

### Bulk Reminder Composer

| Element | Copy |
|---------|------|
| Sheet title | Send Reminder |
| Template label | Message |
| Template placeholder | e.g. Hi {{name}}, your payment of Rs {{amount}} is due. Please pay at the earliest. — {{business_name}} |
| Channel label | Send via |
| Channel options | WhatsApp · SMS |
| Party count label | Sending to {{count}} parties |
| Preview label | Preview (tap to expand) |
| Warning (no phone) | {{count}} parties skipped — no phone number |
| Send button | Send Reminder |
| Loading state button | Sending… |
| Result — sent section | Reminders Prepared |
| Result — note | WhatsApp will open to send each message. Delivery is not tracked. |
| Result — failed section | Could Not Send |
| Result — failed reason (no phone) | No phone number |
| Result — failed reason (not found) | Party not found |

### Payment Link

| Element | Copy |
|---------|------|
| Button (invoice detail) | Get Payment Link |
| Bottom sheet title | Payment Link |
| Amount label | Amount due |
| Link status — active | Active · expires [date] |
| Link status — paid | Paid on [date] |
| Link status — expired | Expired |
| Copy button | Copy Link |
| Share button | Share on WhatsApp |
| Whatsapp pre-fill | Hi [name], please pay Rs [amount] for invoice [number] using this secure link: [url] — [business name] |
| Setup prompt (Razorpay not configured) | Connect Razorpay to enable payment links |
| Setup prompt CTA | Go to Settings |
| Idempotency toast | Link already active — copied to clipboard |

### Customer Statement

| Element | Copy |
|---------|------|
| Button (party page) | Statement |
| Period picker title | Select Period |
| Period option 1 | This Month |
| Period option 2 | Last 3 Months |
| Period option 3 | This Financial Year |
| Period option 4 | Custom Range |
| Loading text | Generating statement… |
| PDF footer | This is a computer-generated statement. As of [date]. Amounts in INR. |
| Empty state (no transactions) | No transactions between [date] and [date] |
| Empty state CTA | Change Period |
| WhatsApp pre-fill | Hi [name], please find your account statement. Total outstanding: Rs [amount]. Reply to confirm receipt. — [business name] |
| Download button | Download PDF |
| Share button | Share on WhatsApp |

### Promise-to-Pay

| Element | Copy |
|---------|------|
| Action button | Record Promise |
| Form title | Record Payment Promise |
| Amount label | Promised amount (Rs) |
| Amount placeholder | e.g. 15000 |
| Date label | Expected by |
| Note label | Note (optional) |
| Note placeholder | e.g. Customer said will pay after Diwali |
| Save button | Save Promise |
| Success toast | Promise recorded — you'll be alerted if not received by [date] |
| Commitments section label | Commitments |
| Open PTP badge | Open |
| Kept PTP badge | Kept |
| Broken PTP badge | Broken |
| Broken PTP alert | [name] promised Rs [amount] by [date] — not received |
| Delete confirm | Delete this promise? This cannot be undone. |
| Delete confirm — broken PTP | Broken promises cannot be deleted. They are part of your collections history. |
| Edit not allowed (broken) | Broken promises cannot be edited. Record a new promise if needed. |

---

## 14. Mobile-Specific Considerations

### Layout

- **Collections tab**: 375px primary; 320px minimum. 4-bucket grid renders as 2×2
  (two tiles per row); at 320px each tile is ~140px wide — comfortably shows
  label + amount.
- **Bulk reminder sheet**: Bottom sheet, 85vh height. Party list scrollable.
  "Send" button fixed at bottom of sheet outside the scroll area — never scrolled
  out of reach.
- **Payment link sheet**: Fixed bottom sheet, 40vh height. "Copy Link" and
  "Share on WhatsApp" buttons are full-width stacked, minimum 48px touch target.
- **Statement PDF preview**: Full-screen on tap; bottom action bar always visible
  (not inside PDF scroll area).
- **PTP form**: Slide-up sheet, single-column, each input minimum 48px height.
  Date picker uses native mobile date input (not a custom calendar).

### Android-specific

- WhatsApp share: use `Capacitor.Plugins.Share.share()` with `files` prop for
  statement PDF; `url` prop for payment link. On Android, Share Sheet handles both.
- Payment link copy: `Clipboard.write()` from `@capacitor/clipboard`.
- Background cron (PTP status evaluation): Not a Capacitor background task —
  evaluated server-side. Client reads on next app open.

### iOS-specific

- Statement PDF share: `Share.share({ files: [localFileUri] })` — Capacitor
  writes PDF to temp file, passes URI to iOS share sheet. WhatsApp appears in
  the share targets if installed.
- `wa.me` links: open in Safari which hands off to WhatsApp app — behaviour
  identical on iOS.

### Network conditions (2G / 3G Rs 8K–15K phones)

- Aging dashboard: IDB cache shown first; server refresh is background; "Tap to
  refresh" visible.
- Bulk reminder: API call is < 5 KB request; 200-party batch is still small
  payload. No image uploads; no large responses.
- Statement PDF: Generated client-side; no large download. If party has > 500
  transactions, warn: "Large statement (>500 rows) — may take a few seconds."

---

## 15. Open Questions for Product Owner

These questions require a decision before the architect writes the TRD.

| # | Question | Impact | Default Assumption |
|---|----------|--------|-------------------|
| OQ-1 | Should the Collections tab replace the existing "Outstanding" page or sit alongside it? The Outstanding page exists at `/outstanding` today. | Navigation architecture | Keep Outstanding page; Collections tab is a new, richer surface. Outstanding page may be deprecated later. |
| OQ-2 | For aging computation: use `dueDate` or invoice date + payment terms? Not all invoices have `dueDate` set. | FR-05 — aging accuracy | Use `dueDate` if set; fall back to `documentDate + 30 days` as a safe default. |
| OQ-3 | Should broken PTPs ever be auto-deleted after N days, or kept forever? | Storage + UI clutter | Keep forever; filter by date range in list view. |
| OQ-4 | Razorpay payment link — should the `description` field on the link show the invoice number? Or the business name? | Customer UX on Razorpay's checkout page | Invoice number + business name: "Invoice INV-0045 from Priya Traders" |
| OQ-5 | Can a business create a payment link for a partial amount (less than balanceDue)? E.g., if customer agreed to pay 50% now. | FR-34 | Not in MVP; link amount = full balanceDue. Phase 2: add amount field. |
| OQ-6 | When Razorpay webhook records a payment for a closed invoice (balanceDue = 0), should it still record the payment (as overpayment) or reject? | Financial integrity | Record the payment, flag as overpayment on the invoice. Do not reject. |
| OQ-7 | What is the default reminder message template? Should it be in English, Hindi, or both? | Localisation | English by default; Hindi template available as the second default. User can edit both. |
| OQ-8 | Should the PTP "mark kept" prompt appear automatically when a manual payment is recorded? Or only when the business owner explicitly opens the PTP? | UX friction | Show prompt (FR-72) — it adds one tap but prevents orphaned PTPs. |
| OQ-9 | Statement PDF — should credit note rows show as negative debit or positive credit? | Accounting clarity | Positive credit entry (reduces the balance the customer owes). |
| OQ-10 | Auto-cadence (Phase 2) — should it send via the same WhatsApp `wa.me` approach (requires a human to confirm) or require WhatsApp Cloud API? | Automation feasibility | `wa.me` requires human interaction; true auto-send needs Cloud API. This is the core reason auto-cadence is P2. Document this explicitly in Phase 2 planning. |

---

## 16. Acceptance Criteria (Binary, Testable)

### Receivables Aging Dashboard

- [ ] `curl GET /api/collections/aging` with valid auth → `{ success: true, data: { summary: { buckets: { current, bucket_31, bucket_61, bucket_91 } } } }`
- [ ] `curl GET /api/collections/aging` without auth → 401
- [ ] `curl GET /api/collections/aging/parties?bucket=current` → `{ success: true, data: { parties: [...] } }`
- [ ] `curl GET /api/collections/aging/parties?bucket=invalid` → 400
- [ ] Dashboard renders 4 bucket tiles at 375px; no overflow at 320px
- [ ] Empty state shown when all `outstandingBalance = 0`
- [ ] Loading skeleton shown on first open; IDB cache shown on subsequent opens
- [ ] Bucket amounts in Indian format (1,00,000 not 100000)

### Bulk Reminders

- [ ] `curl POST /api/payments/reminders/bulk` with `partyIds: []` → 400 PARTY_IDS_REQUIRED
- [ ] `curl POST /api/payments/reminders/bulk` with `partyIds: [<51 ids>]` → 400 BATCH_LIMIT_EXCEEDED
- [ ] `curl POST /api/payments/reminders/bulk` with valid payload → 200 `{ sent: N, failed: M }`
- [ ] Reminder composer bottom sheet opens at 375px with Send button visible without scrolling
- [ ] Template preview substitutes `{{name}}` correctly
- [ ] Parties with no phone excluded from selection (warning badge visible)
- [ ] Result screen shows sent/failed breakdown

### Payment Links

- [ ] `curl POST /api/payments/payment-links` with valid `invoiceId` → 201 with `shortUrl`
- [ ] `curl POST /api/payments/payment-links` same `invoiceId` (duplicate) → 200 with same `shortUrl`
- [ ] `curl POST /api/payments/payment-links` for DRAFT invoice → 400
- [ ] `curl POST /api/payments/payment-links` without auth → 401
- [ ] `curl DELETE /api/payments/payment-links/:id` for PAID link → 409 LINK_NOT_CANCELLABLE
- [ ] Razorpay webhook `payment_link.paid` → Payment record created, `Document.balanceDue` updated, `PaymentLink.status = PAID`
- [ ] Razorpay webhook with invalid signature → 400 rejected
- [ ] "Get Payment Link" button hidden on fully-paid invoices

### Customer Statement

- [ ] `curl GET /api/collections/statement/:partyId?from=2026-04-01&to=2026-04-30` → 200 with transactions array
- [ ] `curl GET /api/collections/statement/:partyId` without auth → 401
- [ ] Statement PDF generated in < 3 seconds for < 100 transactions
- [ ] Statement PDF shows opening balance, closing balance, running balance per row
- [ ] "Share on WhatsApp" triggers Capacitor share sheet with PDF file on mobile
- [ ] Empty state PDF shown for zero-transaction periods
- [ ] Indian number format throughout statement

### Promise-to-Pay

- [ ] `curl POST /api/collections/ptp` with `amount: 0` → 400
- [ ] `curl POST /api/collections/ptp` with `promisedDate` in the past → 400
- [ ] `curl POST /api/collections/ptp` valid → 201 with `status: OPEN`
- [ ] `curl PATCH /api/collections/ptp/:id` for BROKEN PTP → 409 PTP_NOT_EDITABLE
- [ ] `curl DELETE /api/collections/ptp/:id` for BROKEN PTP → 409 PTP_NOT_DELETABLE
- [ ] PTP with `promisedDate` yesterday and no matching payment → status flips to BROKEN after daily cron
- [ ] Broken PTP appears in Collections dashboard alert section
- [ ] PTP count badge visible on party rows in outstanding list

### General

- [ ] Screenshot: loading state (skeleton) ✅
- [ ] Screenshot: error state (network banner) ✅
- [ ] Screenshot: empty state (all caught up) ✅
- [ ] Screenshot: success state (4 buckets populated) ✅
- [ ] 375px no layout issues ✅
- [ ] 320px no overflow ✅
- [ ] TypeScript clean (`tsc --noEmit`)
- [ ] `enforce.js` clean (offline rules, no raw fetch)
- [ ] All mutations pass `entityType` and `entityLabel`
- [ ] Offline: IDB cache shown when network unavailable
- [ ] Dark mode: all new screens tested

---

## 17. QA Checklist

QA verifier must check and sign off each item before marking the epic complete.

**Aging Dashboard**
- [ ] Aging buckets show correct amounts (cross-check against `/api/payments/outstanding` totals)
- [ ] Bucket drill-down party list is paginated (page 2 loads correctly)
- [ ] "Last updated" timestamp updates after manual refresh
- [ ] Top 5 Outstanding Parties sorted by total outstanding descending
- [ ] Indian number format used in all amount displays
- [ ] Zero-outstanding party does not appear in any bucket

**Bulk Reminders**
- [ ] Selecting all parties with "Select All" does not include parties with no phone
- [ ] `{{name}}` substituted correctly in preview and sent message
- [ ] `{{amount}}` shows formatted amount (Rs X,XX,XXX not X paise)
- [ ] Reminder record created in DB for each dispatched party
- [ ] Duplicate reminder warning shown if same party was reminded in last 24 hours
- [ ] Rate limit enforced: second bulk batch within 10 minutes rejected

**Payment Links**
- [ ] Payment link amount = invoice's current balanceDue (not grandTotal)
- [ ] Only one active link per invoice enforced
- [ ] Webhook test: simulate Razorpay `payment_link.paid` → confirm Payment, PaymentAllocation, Document.balanceDue updated
- [ ] Webhook with bad signature → 400 returned
- [ ] Expired link shows "Expired" on invoice detail

**Customer Statement**
- [ ] Opening balance correct (sum of pre-period transactions)
- [ ] Running balance recalculates correctly row by row
- [ ] Credit notes shown as credits (positive credit column)
- [ ] Statement period defaults to "Last 3 Months" on first open
- [ ] PDF typography legible on device screen at 320px width

**Promise-to-Pay**
- [ ] Past date rejected on form
- [ ] PTP edit blocked after status = BROKEN
- [ ] PTP delete blocked after status = BROKEN
- [ ] Daily cron correctly flips OPEN → BROKEN (test by setting promisedDate = yesterday in staging DB)
- [ ] Manual "mark kept" via `POST /api/collections/ptp/:id/mark-kept` updates status
- [ ] Broken PTP alert row appears on Collections dashboard

**Cross-cutting**
- [ ] No raw `fetch()` in any new service or page file
- [ ] All POSTs pass `entityType` and `entityLabel`
- [ ] Offline queue test: create PTP while in airplane mode; confirm it syncs on reconnect
- [ ] All new routes return 401 without valid auth cookie
- [ ] All new routes return correct business-scoped data (no cross-tenant leakage test)
