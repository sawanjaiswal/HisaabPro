# Create-Invoice — Gold-Standard Plan (v3)

> Sources: Vyapar "Sale" audit (2026-07-24) + product brief "Invoice Creation
> Flow GS" (2026-07-25) + Sawan's 3 scope decisions (2026-07-25).
> Target: `CreateInvoicePage.tsx` (`/invoices/new`), all form factors.
> Status: **PLAN + wireframes.** Build starts after wireframe sign-off.

## 0. Locked decisions (2026-07-25)

1. **GST is IN the flow now** — reverses CLAUDE.md "No GST in MVP." Tax %/HSN
   per line, GST summary, place-of-supply are first-class. → **constitution edit
   required** (see §0.1).
2. **Typography density → 9–14px** — Sawan chose to adopt the brief's dense
   scale AND update the core guidelines. → **constitution edit required.**
   Engineering note kept on record: tap targets stay **≥40px** (touch area ≠
   font size — a 40px row can hold 11px text); contrast still targeted ≥4.5:1
   so small text stays legible on cheap Android. This is the one place I'm
   holding a floor the brief didn't ask for, because it's a hardware fact, not
   a style preference.
3. **Mobile + tablet + desktop together** — responsive is part of every phase,
   not a later epic.

### 0.1 Constitution changes this plan will make (first build step)
| file | change |
|---|---|
| `CLAUDE.md` | "No GST in MVP (Phase 2)" → GST in invoice flow; keep other GST features phased |
| `CLAUDE.md` | "16px min body" → density scale: title 18 / section 13 / body 12-14 / meta 10 / caption 9; tap targets ≥40px |
| `.claude/rules/PAGE_AUDIT_CHECKLIST.md` §L | contrast ≥4.5:1 retained; remove 16px-min implication; add "no font below 9px" floor |
| `--fs-*` tokens | **already dense in `tokens-core.css`** (`--fs-3xs`=9 … `--fs-2xl`=18); no new tokens — map screens onto the existing scale |

> These are project-guideline edits (not high-risk gated paths). They land in
> one commit labelled `chore(guidelines): adopt GST-in-flow + density scale`.

## 1. The one sentence
Fastest way for an Indian shopkeeper to sell — invoice is the byproduct.
Repeat invoice **<20s**. Software never interrupts the conversation.

## 2. Target selling flow
`Customer → Items → Total → Receive payment? → Done`. Nothing before the first
item except the customer. Progressive disclosure: cash hides credit/due-date;
retail hides transport; GST slots show per the tax config.

**Line-item row anatomy** (mobile):
```
#1  Ultratech Cement            ₹380 × 10        ₹3,800   ✕
    HSN 2523 · 18% GST  (2nd line, --fs-2xs meta)          └─ delete row (≥40px hit)
```
Tap the row body → opens the edit bottom-sheet (P3). The trailing **✕** deletes
the row immediately (no confirm — undo via toast). `onRemoveLineItem` is already
wired in `LineItemEditor`; P1 only surfaces it as the ✕ control.

## 3. Current state → target (grounded)
| Brief principle | Today | Gap |
|---|---|---|
| Auto-focus item search after customer | toggle behind "+ Add item" (2 extra taps) | **P0** |
| Recents on customer focus | ✅ done | — |
| Auto-load balance/credit/GSTIN/place-of-supply on select | price-list ✅; balance/GST **not shown** | **P0/P1** |
| Invoice # + date on surface | buried in accordion | **P0** |
| Progressive disclosure cash/credit/transport | all shown always | **P1** |
| GST per line (tax%/HSN) + GST summary | flag-gated, not first-class | **P0 (now in-scope)** |
| Item edit in bottom sheet | inline editor | P1 |
| "Already added → +qty?" | silently ignored | P2 |
| Receive-payment toggle→expand + real payment | absent | **P0** (backend) |
| Live summary / advanced-collapsed / sticky bar | ✅ | keep |
| Keyboard qty→price→disc tab | not wired | P2 |
| Barcode scan-loop / Voice | partial / absent | P3 |
| Tablet 2-pane / desktop keyboard grid | mobile only | **now in-scope, every phase** |

## 4. Phased build (responsive baked into each)

### Phase 0 — Constitution + tokens ✅ DONE (2026-07-25)
CLAUDE.md (GST-in-flow + density scale + ≥40px touch), PAGE_AUDIT §E/§L updated.
`--fs-*` tokens already dense in `tokens-core.css` — no new tokens.

### Phase 1 — Selling-flow core + responsive shell  ✅ CORE DONE (2026-07-25)
- ✅ Auto-focus item search on customer select (`ProductSearchInput autoFocus`
  + `CreateInvoicePage` opens search on party set) — kills the 2 extra taps.
- ✅ `InvoiceHeaderMeta` — invoice #(auto) + date surfaced at top; date hidden
  in Details accordion via `hideDate` (edit form unaffected).
- ✅ Delete per row already present (`LineItemEditor` Trash2, ≥40px).
- Progressive disclosure = existing Details accordion (collapsed by default).
- Responsive baseline = `PageContainer`; desktop power-grid deferred to P4.
| path | action | ~lines | layer |
|---|---|---|---|
| `components/InvoiceHeaderMeta.tsx` | create | ~90 | # + date on surface |
| `hooks/useAutoFocusItemSearch.ts` | create | ~40 | focus item search on party set |
| `components/InvoiceItemsSection.tsx` | edit | +25 | auto-open+focus search; drop toggle friction |
| `components/LineItemEditor.tsx` | edit | +8 | surface delete as trailing **✕** on each row (≥40px hit) — `onRemoveLineItem` already wired |
| `components/InvoiceProgressiveDetails.tsx` | create | ~120 | cash/credit/transport disclosure |
| `layouts/InvoiceResponsiveLayout.tsx` | create | ~140 | 1-col mobile / 2-pane tablet / 3-col desktop |
| density css + `invoice-summary.css` | edit | ~+90 | css |
| `translations.en/hi.ts` | edit | ~+20 | i18n |

### Phase 2 — GST first-class + payment-at-creation  ✅ DONE (2026-07-25)
- ✅ `ReceivePaymentToggle` — amount·method·ref on the create screen; wired to
  `form.payment`, sent nested only when `amountReceived>0` on a SAVED sale
  invoice. Server records a real Payment + allocation via canonical
  `createDocumentWithPayment` → `createPayment`.
- ✅ `InvoiceGstSummary` + `useInvoiceGstSummary` — CGST/SGST/IGST split via the
  canonical `calculateDocumentTax` engine (no drift from server), inter/intra
  driven by place-of-supply vs business state; handles INCLUSIVE back-calc.
- ✅ `PartyBalanceChip` — outstanding balance (due/advance/settled) + GSTIN the
  moment a customer is picked; reuses `getParty` + the detail query key.
- ✅ Wire: `normalizeFormPayload` strips server-derived `supplyType` and folds
  `vehicleNumber` into `transportDetails` (fixes a latent strict-schema 400 on
  both create AND edit). `DocumentWirePayload` is the single wire SSOT.
- Proof: 7-test integration suite (`documents-payment.contract.test.ts`) green —
  allocation clamp, change calc, party-outstanding vs invoice-balanceDue, DRAFT
  ignore, `received=0` 400, top-level `supplyType`/`vehicleNumber` 400. tsc +
  enforce.js clean; 108 invoice FE tests pass.

| path | action | ~lines | layer |
|---|---|---|---|
| `components/LineItemTaxRow.tsx` (promote TaxPicker+HSN inline) | edit | ~+40 | GST per line always-on when enabled |
| `components/InvoiceGstSummary.tsx` | create | ~90 | CGST/SGST/IGST split + place-of-supply |
| `components/ReceivePaymentToggle.tsx` | create | ~120 | No/Yes → Amount·Method·Ref |
| `components/PartyBalanceChip.tsx` | create | ~70 | inline balance + GSTIN on select |
| `server/.../document.schema.ts` | edit | +8 | `amountReceived,paymentMode,paymentRef` |
| `server/.../document/create-with-payment.ts` | create | ~90 | doc+payment+allocation, one tx |
| `server/.../documents/crud.ts` | edit | +12 | branch on `amountReceived>0` |
| `invoice-api.types.ts` + `useInvoiceForm.ts` | edit | +20 | fields + payload |

> Payment path is money-adjacent → curl 201 + allocation correctness + 400
> (`received>total`) + integration test before ship.

### Phase 3 — Intelligence, edit-sheet, keyboard  ✅ DONE (2026-07-25)
- ✅ `Usually bought` chips → `GET /parties/:id/frequent-products` (5-test
  integration proof: ranking, DRAFT-excluded, party isolation, 404). Chips stay
  visible after add and show a running `×N`; a re-tap bumps that line's qty.
- ✅ "Already added → +qty": `handleProductSelect` now bumps the existing line's
  quantity (+toast) instead of no-op'ing — reachable via chip re-tap.
- ✅ Keyboard qty→price→disc→next-row: `Enter` walks the three line fields and
  jumps to the next row's qty (`.select()` primes overtype); number fields now
  block `e/E/+/-`.
- ⏭️ **Item edit bottom-`<Drawer>` sheet — SKIPPED (deliberate).** Every line
  already renders full inline editors (qty/rate/discount/delete-✕) via
  `LineItemFields`; a separate edit sheet would duplicate the editing surface
  in a dense mobile UI — a net negative. Inline edit + the keyboard flow cover
  the need.
- ✅ Barcode add-and-return loop: `InvoiceScanButton` reuses `<BarcodeScanner>`
  + `useBarcodeLookup`; on each found product it adds the line and re-arms the
  scanner (remount via `scanKey`) so scanning is continuous. Device-only
  (camera/wedge) — verified by construction + tsc/enforce.

### Phase 4 — Desktop power + voice  🔶 KEYBOARD GRID DONE (2026-07-25)
- ✅ Desktop keyboard grid — `useInvoiceHotkeys`: **⌘/Ctrl+K** quick-add (opens +
  focuses product search), **⌘/Ctrl+S** save (suppresses the browser save
  dialog), **Esc** closes search; **F2** opens the barcode scan loop (bound in
  `InvoiceScanButton`). Used ⌘/Ctrl+S rather than ⌥S — ⌥S inserts a glyph on
  macOS; Ctrl/Cmd+S is the universal save chord.
- ⏭️ **Bulk edit — DEFERRED (with voice).** Multi-row select + batch actions is a
  spreadsheet-grid interaction that doesn't fit the current card-based, few-line
  mobile invoice; it belongs with the desktop/voice epic, not this mobile-first
  sweep. Inline per-row edit + the keyboard flow cover day-to-day editing.
- ⏭️ Voice item entry — own epic (unchanged).

## 5. Rejected
Vyapar bordered/torn-ticket styling · giant KPI cards · huge buttons · settings
inside the flow · per-field edit pages · asking for known customer data · any
font **below 9px**.

## 6. Acceptance
`enforce.js` 0 · `tsc` clean · 4 states · i18n en+hi · tokens · **320/375/768/1024/1280
no h-scroll** · offline · **repeat invoice <20s mid-phone** · tap targets ≥40px ·
GST math verified against a known invoice.
