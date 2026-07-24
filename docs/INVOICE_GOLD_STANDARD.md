# Create-Invoice — Gold-Standard Plan

> Benchmark: Vyapar "Sale" create flow (7 screens, captured 2026-07-24).
> Target: `/invoices/new?type=SALE` on HisaabPro.
> Status: **PLAN ONLY** — no code in this pass.

## 0. Guardrails (what this plan may and may not do)

- **No GST in MVP.** HSN/SAC, Tax %, IGST, State of Supply, tax themes, "Without
  Tax" fields, `Item wise tax`, GST invoice preview themes — all **Phase 2**.
  Everything below is the *non-GST* subset of Vyapar's flow.
- **Our aesthetic, not theirs.** Vyapar is dated bordered-Material with
  torn-ticket totals and a watermark. We stay Cred/Jupiter-clean on emerald
  (`--color-primary-*`), 16px min body, soft shadows, 8–12px radius.
- **Reuse first.** New primitives only where none exists. Existing engine:
  `useInvoiceForm`, `InvoiceTotalsBar`, `InvoiceItemsSection`,
  `InvoiceOptionalSections`, `PartySearchInput` (+ new global `SearchInput`).
- **4 UI states, tokens, i18n (en+hi), 320px, offline — every screen.**

---

## 1. Vyapar screen-by-screen audit

### Screen 1 — Sale (main create) `224053`
| Element | Verdict | Take for HP |
|---|---|---|
| Header: back · "Sale" · **Credit/Cash toggle** · settings | Keep the payment-nature toggle | **Adopt** Cash/Credit segmented control |
| **Invoice No. `33` + Date side-by-side, on surface, editable** | Strong — no digging | **Adopt** (ours is buried in a collapsed accordion) |
| **Party Balance `₹600.00`** top-right above customer | Strong context | **Adopt** inline balance on party select |
| Customer* (floating label) + Phone Number | Good, but 2 fields | Adopt as 1 party picker; phone auto-from-party |
| "Billed Items" collapsible + line cards (#, name, qty×rate, disc, tax, total) | Good density | **Adopt** card summary (drop tax row) |
| "Add Items" dashed button, centered | Good affordance | Adopt |
| **Totals block: Total → Received (checkbox+₹) → Balance Due (green)** | **The key pattern** | **Adopt** — biggest gap |
| Payment Type (Cash ▾) + Add Payment Type | Useful | Adopt simple mode dropdown (Cash/UPI/Bank) |
| State of Supply | GST | **Reject** (Phase 2) |
| Description + image, Add Document | OK | Keep notes; defer attachments |
| Terms & Conditions (collapsible) | OK | Already have |
| Sticky: **Save & New / Save** | Good | **Adopt** dual-action |

### Screen 2 — Add Items (empty) `224058`
- Dedicated sub-screen: Item Name (focused, floating label) · Quantity · Unit (▾) · Rate · ~~Without Tax~~.
- **Take:** move item entry into a focused sheet with generous fields, not cramped inline rows. Drop "Without Tax".

### Screen 3 — Item settings toggles `224136`
- Config sprawl: barcode, stock, manufacturing, party-wise rate, wholesale, decimals, item-wise tax/discount, HSN…
- **Take:** **Reject** as a create-flow surface. Over-configuration for Raju. (Some already live in our Product model.)

### Screen 4 — Add Items (filled) `224126`
- Qty `236` · Unit `Bag` · Rate `33`. **Totals & Taxes**: Subtotal (Rate×Qty) · Discount (`06 %` | `₹467.28` dual input) · Tax% (GST) · Total.
- **Take:** **Adopt** the **dual discount input** (% ⇄ ₹ toggle) and live per-item subtotal. **Reject** the Tax% row (Phase 2).

### Screen 5 — Settings drawer `224147`
- Sale Prefix · Transaction SMS · Additional Fields · Additional Charges · Billing Type (Full Sale / Mobile POS).
- **Take:** mostly **Reject** for create flow. Prefix belongs in business settings; charges we already have; SMS = WhatsApp-share later.

### Screens 6–7 — PDF preview (Tally / GST themes) `224208` `224259`
- Theme picker + full tax-invoice PDF with Sub Total / Discount / **Received / Balance / You Saved**.
- **Take:** we already have `InvoicePreviewDrawer` + React-PDF. **Adopt** the "Received / Balance / You Saved" lines into our preview + PDF once the received-amount field lands. **Reject** GST columns.

---

## 2. Current HisaabPro state (grounded in code)

Page: `CreateInvoicePage.tsx` → continuous scroll:
`StockBanners → [GstHeader] → InvoiceItemsSection (party + line items) →
InvoiceOptionalSections (Details accordion + Charges accordion)` +
sticky `InvoiceTotalsBar` + `InvoicePreviewDrawer`.

`DocumentFormData` (`invoice-api.types.ts:141`) has **no**:
- `documentNumber` on surface (server auto-generates; not shown/editable)
- `amountReceived` / any payment-at-creation field
- party balance (form stores only `partyId`)
- cash/credit nature

Backend: regular `POST /api/documents` (`routes/documents/crud.ts`) creates the
document with **no payment**. Only the POS `quick-sale.ts` endpoint accepts
`amountPaid` and writes a `Payment` + `PaymentAllocation` in one transaction —
that logic is the reuse target for "received at creation".

---

## 3. Gap analysis (ranked)

| # | Gap | Priority | Evidence |
|---|---|---|---|
| G1 | Invoice # + Date not on surface (buried in Details accordion; # not shown at all) | **P0** | Screen 1 vs `InvoiceOptionalSections` |
| G2 | No "Amount Received / Balance Due" block — can't record payment at creation | **P0** | Screen 1 totals vs `DocumentFormData` (no field) + `crud.ts` (no payment) |
| G3 | Party balance not shown on select | **P1** | Screen 1 `₹600.00` |
| G4 | Cash/Credit nature toggle absent | **P1** | Screen 1 header |
| G5 | Line-item entry is cramped inline, not a focused sheet | **P1** | Screens 2/4 vs `InvoiceItemsSection` |
| G6 | Per-item discount is single-mode; no % ⇄ ₹ toggle + live line subtotal | **P2** | Screen 4 dual input |
| G7 | Payment mode (Cash/UPI/Bank) not selectable at creation | **P2** | Screen 1 Payment Type |
| G8 | Preview/PDF lacks Received/Balance/You-Saved lines | **P2** | Screens 6/7 |

---

## 4. Gold-standard target (HP, reimagined)

```
┌ Header ────────────────────────────────────┐
│ ‹  New Invoice        [ Cash | Credit ]  📷 │  ← G4 segmented toggle
├─────────────────────────────────────────────┤
│  Invoice #INV-0033 ▾        Date 25/07/26 ▾ │  ← G1 on-surface row
├─────────────────────────────────────────────┤
│  🔎 Search or add customer…                 │  ← global SearchInput (done)
│  Ramesh Traders          Balance ₹600 ▸     │  ← G3 inline balance
├─────────────────────────────────────────────┤
│  ITEMS                                       │
│  #1 Jisko      30 × ₹66      ₹1,960.20  ✎   │  ← summary cards (G5)
│  ＋ Add item                                 │  → opens item sheet (Drawer)
├─────────────────────────────────────────────┤
│  Notes · Charges · Terms      (accordion)   │  ← existing optional sections
└─────────────────────────────────────────────┘
┌ Sticky totals ─────────────────────────────┐
│  Subtotal              ₹9,500.54            │
│  ☑ Received            ₹5,000.00            │  ← G2
│  Balance Due           ₹4,500.54  (green)   │  ← G2
│  [ Save & New ]        [ Preview / Save ]   │  ← G1 dual action
└─────────────────────────────────────────────┘
```

---

## 5. Phased implementation plan

Order = P0 → P1 → P2. Each phase ships independently and passes
`enforce.js` + `tsc` + the PAGE_AUDIT_CHECKLIST.

### Phase A — P0: on-surface # + date, and Received/Balance block

**Backend** (received-amount path — reuse `quick-sale` payment logic):

| path | action | ~lines | layer |
|---|---|---|---|
| `server/src/schemas/document.schema.ts` | edit | +8 | schema (add optional `amountReceived`, `paymentMode`) |
| `server/src/services/document/create-with-payment.ts` | create | ~90 | service (wrap doc create + `payment/create.ts` + allocation in one tx) |
| `server/src/routes/documents/crud.ts` | edit | +12 | route (call new service when `amountReceived>0`) |

> Note: touches the Payment ledger. Not a high-risk glob (no stripe/refund/
> webhook), but money-adjacent — needs a 201 + allocation-correctness curl and
> an integration test asserting `paidAmount`/`balance` before ship.

**Frontend:**

| path | action | ~lines | layer |
|---|---|---|---|
| `invoice-api.types.ts` | edit | +4 | types (`amountReceived?`, `paymentMode?`) |
| `useInvoiceForm.ts` | edit | +15 | hook (state + submit payload) |
| `components/InvoiceHeaderMeta.tsx` | create | ~90 | component (# ▾ + Date row) |
| `components/InvoiceReceivedRow.tsx` | create | ~110 | component (checkbox + ₹ input + Balance Due) |
| `components/InvoiceTotalsBar.tsx` | edit | +25 | component (host received row + balance) |
| `invoice-summary.css` | edit | +40 | css |
| `translations.en.ts` / `.hi.ts` | edit | +12 | i18n |

### Phase B — P1: party balance, cash/credit, item sheet

| path | action | ~lines | layer |
|---|---|---|---|
| `components/PartyBalanceChip.tsx` | create | ~70 | component (fetch outstanding on select) |
| `components/InvoiceNatureToggle.tsx` | create | ~60 | component (Cash/Credit segmented) |
| `components/ItemEntryDrawer.tsx` | create | ~180 | component (focused item sheet over `<Drawer>`) |
| `components/LineItemSummaryCard.tsx` | create | ~90 | component (#, name, qty×rate, total, edit) |
| `InvoiceItemsSection.tsx` | edit | ~-40 | component (swap inline editor → cards + drawer) |
| relevant css | edit | +60 | css |

### Phase C — P2: dual discount, payment mode, preview lines

| path | action | ~lines | layer |
|---|---|---|---|
| `components/DiscountDualInput.tsx` | create | ~90 | component (% ⇄ ₹ toggle + live subtotal) |
| `components/PaymentModeSelect.tsx` | create | ~60 | component (Cash/UPI/Bank) |
| `InvoicePreviewDrawer.tsx` + `pdf/InvoicePdfDocument.tsx` | edit | +30 | Received/Balance/You-Saved lines |

---

## 6. Explicitly rejected (do NOT build)

GST/HSN/Tax%/IGST/State of Supply/tax themes · "Without Tax" fields · item
config-toggle sprawl (Screen 3) · Sale Prefix in create flow · Mobile POS
billing-type switch · torn-ticket totals kitsch · bordered-Material styling ·
watermark.

## 7. Acceptance (per phase)

- `node scripts/enforce.js` 0 errors · `npx tsc -b --noEmit` clean
- No horizontal scroll at 320/375/768/1024/1280
- 4 UI states visible · i18n en+hi · tokens only · offline (`api()`, optimistic `{}`)
- Phase A backend: curl 201 with payment, allocation `paidAmount` correct, 400 on `amountReceived>total`
- Golden path recorded: create SALE with 2 items + partial received → Balance Due correct → appears paid-partial in list
```
