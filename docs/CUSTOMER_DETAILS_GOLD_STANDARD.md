# Customer Details — Gold-Standard Plan (reconciled)

> Source: ChatGPT "Customer Details Gold Standard v1.0" spec (2026-07-25).
> Target: `PartyDetailPage.tsx` (`/parties/:id`).
> Status: **PLAN ONLY.** This reconciles the spec with (a) what's already
> built and (b) HisaabPro's design constitution. Where they conflict, the
> constitution wins and the reason is stated.

## 0. Verdict up front

The spec's **structure and priorities are excellent** and ~80% already shipped.
Its **typography/density section is unshippable as written** — it mandates
9–14px text and "no 16–18px except page title," which directly violates our
own rules:

- CLAUDE.md: **"16px min body"**
- PAGE_AUDIT_CHECKLIST §L: **contrast ≥ 4.5:1 body**, **touch targets ≥ 44px**
- Target hardware: **Rs 8–15K Android phones** — 9px captions are unreadable
  and fail WCAG on exactly the devices Raju uses.

So: **adopt the spec's information architecture; reject its pixel sizes.**
Replace "max 14px / 9px captions" with *calm density on our `--fs-*` scale*
(title `--fs-lg` 16px, amount `--fs-df` 15–16px semibold, meta `--fs-sm` 13–14px,
never below `--fs-xs`). Dense feel comes from **tight spacing and dividers**,
not sub-legible type.

---

## 1. What already exists (do NOT rebuild — SSOT)

| Spec section | Already shipped as | Delta |
|---|---|---|
| Green header (back · name · call · more) | `PartyDetailHeader` | + status pill, + phone under name |
| Recommended action | `PartyOverdueAlert` (auto-hides) | ✓ keep |
| Primary actions (Receive Payment / Invoice) | `PartyDetailPayBar` (sticky) | + Share Statement as 3rd |
| Tabs: **Ledger · Invoices · Payments · Info** | `UnderlineTabs` + `usePartyDetailTabs` | ✅ **exact match** |
| Ledger tab | `PartyLedgerTab` | verify month-grouping + row density |
| Invoices / Payments tabs | `PartyLedgerTab` with `lockTypes` | ✓ keep |
| Info tab | `PartyOverviewTab` + `PartyAddressesTab` + `PartyCrmTab` + `CommitmentsSection` | regroup into collapsible cards |
| Financial summary | `PartySummaryTiles` (3 divided tiles) | enrich → single calm card |

**Conclusion:** this is a *refinement*, not a rebuild. Four real deltas below.

---

## 2. Reconciled deltas (ranked)

### D1 — Financial summary: enrich, keep calm **(P1)**
Spec wants ONE Mercury/Stripe-calm card with Outstanding + Credit Limit +
Available Credit + Customer-since (or Last Payment / Avg Payment Time).
Current `PartySummaryTiles` = 3 tiles (Outstanding / Open Invoices / Last Payment).

- **Adopt:** add **Credit Limit** + **Available Credit** (we already store
  `creditLimit`; available = limit − outstanding) and **Customer since** (from
  `createdAt`). Keep it one calm card, emerald accent on the primary number only.
- **Reject:** colourful multi-KPI tiles (spec agrees). Two-greens rule holds —
  Outstanding is *status* (success/danger tone), not brand emerald.
- **Server:** `avgPaymentTime` (spec's alt) is **not derived today** — defer to
  P2; don't block D1 on it.

### D2 — Header: status pill + phone under name **(P2)**
- **Adopt:** small status `<Badge>` (Active / Overdue) beside name; phone line
  under name (currently only city/state shows).
- **Constitution note:** phone was *intentionally hidden* on the party *list*
  (earlier task) — that was a list-density call; on the *detail* header showing
  it is correct (spec agrees). Not a contradiction.

### D3 — Row detail opens a **bottom sheet**, not a page **(P1)**
Spec: tap a ledger/invoice/payment row → `<Drawer>` bottom sheet (number, items,
remarks, created-by, + Print/Share/Duplicate/Delete), separate page only for edit.
- **Verify first:** does `PartyLedgerTab` currently navigate to a full page? If
  yes, this is the highest-value interaction change (fewer taps, keeps context).
- Reuse existing `<Drawer>` primitive + invoice/payment detail data already fetched.

### D4 — Info tab as collapsible grouped cards **(P2)**
Spec groups Info into: Contact · GST · Credit · Business · Additional, each a
collapsible `<Accordion>` card.
- **Adopt** the grouping over today's stacked sections.
- **Reject/Defer:** GST card is Phase 2 (no GST in MVP) — render the card only
  when GST is enabled; don't add GSTIN fields to MVP.

---

## 3. Typography — the corrected scale (replaces spec §Typography)

| Spec says | We ship (token) | Why |
|---|---|---|
| Page title 16px | `--fs-lg` (16) title, `--fs-xl` header name | ok |
| "Amounts 14px SemiBold" | `--fs-df` (~15–16) semibold `tabular-nums` | legible money |
| "Body 12px" | `--fs-sm` (13–14) | 16-min rule → no 12px body |
| "Metadata 10px" | `--fs-xs` (12–13) | floor at `--fs-xs` |
| "Captions 9px" | **banned** — use `--fs-xs` | WCAG + cheap-phone legibility |

Ledger row height: spec's **64–72px is fine** (touch ≥44px satisfied) — the row
shrinks via *spacing*, not type. Keep tap target ≥44px.

Spacing: adopt spec's rhythm (16px h-pad, 16px card pad, 8/12/16 vertical) — this
matches our `--space-*` scale and PAGE_AUDIT §E already.

---

## 4. File plan (refinement, phased)

### Phase A — D1 + D3 (highest value)
| path | action | ~lines | layer |
|---|---|---|---|
| `components/PartySummaryTiles.tsx` → `PartyFinancialSummary.tsx` | edit/rename | ~110 | component (single calm card) |
| `party.utils.ts` | edit | +12 | utils (`availableCredit`, `customerSince`) |
| `ledger/LedgerRowSheet.tsx` | create | ~160 | component (bottom-sheet detail over `<Drawer>`) |
| `ledger/PartyLedgerTab.tsx` | edit | +25 | wire row-tap → sheet instead of nav |
| relevant css | edit | +60 | css |
| `translations.en/hi.ts` | edit | +14 | i18n |

### Phase B — D2 + D4
| path | action | ~lines | layer |
|---|---|---|---|
| `components/PartyDetailHeader.tsx` | edit | +25 | status `<Badge>` + phone line |
| `components/PartyInfoCards.tsx` | create | ~180 | component (Contact/Credit/Business/Additional accordions) |
| `PartyDetailPage.tsx` | edit | ~-10 | swap Info stack → `PartyInfoCards` |
| `party-detail-header.css` | edit | +30 | css |

### Deferred (P2 / needs server)
- `avgPaymentTime` derivation (server `detail-stats.ts`) — new stat.
- GST info card — Phase 2 only.
- Attachments in row sheet — after document-attachments ship.

---

## 5. Explicitly rejected from the spec

- **9–14px type / 9px captions** — violates 16px-min + WCAG (see §3).
- **"No avatar"** as a hard rule — we keep `<PartyAvatar>` optional; it aids
  scanning in lists. Header can omit it (spec's point stands *there*).
- **GST fields in MVP** — Phase 2.
- Any move that drops offline (`api()`, optimistic `{}`) or the two-greens rule.

## 6. Acceptance (per phase)

- `enforce.js` 0 · `tsc` clean · 4 UI states · i18n en+hi · tokens only · 320px no h-scroll
- Every ledger/invoice/payment row tap opens the sheet in <200ms; sheet has
  Print/Share/Duplicate/Delete
- Financial summary shows Outstanding, Credit Limit, Available Credit, Customer-since
- No body text below `--fs-xs`; every tap target ≥44px verified at 320px
```
