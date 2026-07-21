---
status: approved
task: Party Detail Page — 100% parity with "Generated image 1 (3).png"
feature: party-detail-mockup-parity
createdAt: 2026-07-22T00:50:00+05:30
approvedAt: 2026-07-22T00:58:00+05:30
approver: Sawan ("design the single customer template with the new design … audit once more and approve")
---

## Note on this file

Replaces the `overlay-surface-fix` plan, whose rows were all ticked complete
(`c371cd0 fix(ui): give the modal surface an explicit background`).

Companion doc for the wider sweep: `docs/GOLD_STANDARD_RESKIN_PLAN.md`.

This is the **single-customer template** — the pattern every other entity-detail
screen (supplier ledger #52, invoice detail #103, payment detail #104) inherits.
Build decisions here are template decisions; keep them primitive-level wherever
the choice is a coin-flip.

---

## Audit pass 2 (2026-07-22 00:58) — four corrections to the draft

The draft was written against the `/hp-design` reference card. Grepping the real
code contradicted it in four places. **Code wins.**

| # | Draft said | Reality | Correction |
|---|---|---|---|
| A1 | `Badge variant="success\|error\|warning\|info\|default"` | actual cva: `paid \| pending \| overdue \| draft \| info` | Status map becomes OVERDUE→`overdue`, PENDING/PARTIAL→`pending`, PAID→`paid`. **No new Badge variant needed** — one less change |
| A2 | add `Button variant="outline-danger"` | Button has no `danger` — it is `destructive`. Variants: `primary, secondary, outline, accent, destructive, ghost, none` | Name it **`outline-destructive`** to match existing naming; `.btn-outline-destructive` added to `components-ui.css` next to `.btn-outline` |
| A3 | "More Actions" needs a new `DropdownMenu` | **`PartyDetailMenu` already exists** and already carries exactly Edit/Invoice/Share/Invite/Delete | **Reuse it** as the third button. No new dropdown, no new menu items. Mounted twice (header ⋮ + action row ⋯) |
| A4 | `ledger.service.ts` is 260L → may need splitting | it is **170L** (the 2026-07-21 drain already split it) | No split. Row-`status` addition lands in place |

Net effect: **the plan got smaller.** A1 and A3 delete work; A2 is a rename; A4
removes a contingency. Files created drops 5 → 5, modified 22 → 21.

Also confirmed live: `--color-hero-surface` + `--color-white-inverse` (in
`components-layout.css`, defined in `tokens-colors.css`), `formatPaise`
(`src/lib/format.ts:4`), `SummaryTiles` 78L, `TransactionRow` 95L — all as
assumed.

---

## Inventory (Phase 0.5 — raw scan)

`src/components/ui/` — relevant primitives found: `Badge` · `Button` · `Card` ·
`Input` · `Drawer` · `DropdownMenu` · `SummaryTiles` (+css) · `TransactionRow`
(+css) · `BottomActionBar` (+css) · `FilterChips` · `PeriodGroup` ·
`ListTotalsFooter` · `PartyAvatar` · `ConfirmDialog`

`src/components/layout/` — `HeroPage` · `Header` · `PageContainer` · `AppShell`
· `BottomNav` · `ResponsiveTable`

`src/components/feedback/` — `Skeleton` · `EmptyState` · `ErrorState` ·
`Spinner` · `OfflineBanner` · `ToastContainer`

Party feature already has: `PartyDetailHeader` (emerald 2-row hero) ·
`PartySummaryTiles` (3 tiles) · `PartyDetailActionBar` (2 buttons) ·
`PartyDetailMenu` · `usePartyDetailTabs` (Ledger/Invoices/Payments/Info on the
underline `.party-detail-tabs` pattern — **already matches the mockup**) ·
`ledger/PartyLedgerTab` + `LedgerRowList` + `LedgerMonthPicker` +
`LedgerFilterDrawer` + `LedgerLoading/Empty/Error`.

**Conclusion: ~70% of the mockup already exists.** Extend-and-restyle, not
rebuild. Nothing below forks an existing component.

---

## Mockup → current delta (the only 10 things that differ)

| # | Mockup element | Current | Action |
|---|---|---|---|
| 1 | Header actions are 4 **labelled** icons: Edit · Call · WhatsApp · More | 3 unlabelled icons, no WhatsApp | extend `PartyDetailHeader` + css |
| 2 | Stat strip = **4 columns, divider-separated, no icon circles** | 3 bordered tiles with tinted icon circles | new `variant="divided"` on `SummaryTiles` |
| 3 | Stats read Outstanding · **Oldest Due (days)** · **Open Invoices** · Last Payment | only Outstanding / Sales-MTD / Last-Payment exist | extend server `detail-stats.ts` |
| 4 | Red **overdue alert banner** + "Receive Payment ›" | absent | new `PartyOverdueAlert` (feature component) |
| 5 | Action row = 3 buttons | 2: Receive Payment · WhatsApp Statement | rework `PartyDetailActionBar` — see **§ Action row spec** |
| 6 | Tabs: Ledger/Invoices/Payments/Info, icons, underline | **identical** | no change |
| 7 | Ledger toolbar = **search field** + Filter + **calendar icon** | month dropdown + Filter + PDF icon | restructure toolbar; PDF export moves into the filter drawer |
| 8 | Rows carry a **status badge** (Overdue/Pending) + right-side **"Balance: ₹X"** | neither | `TransactionRow` gains `status`; reuse `subtitle`; server row gains `status` |
| 9 | Running Balance footer with wallet icon square | exists (`ledger-total`), icon square missing | css only |
| 10 | **Sticky bottom outstanding bar** above BottomNav | absent | new `PartyDetailPayBar` inside the `BottomActionBar` primitive |

---

## Action row spec (from the supplied button crop — mobile-first)

Sawan's direction: *"make these buttons super responsive and make the color of
primary, secondary and triple-dots-only button, mobile-first css."*

| Slot | Label | Component | Variant | Why |
|---|---|---|---|---|
| 1 | Receive Payment | `Button` | **`primary`** | The money action — brand emerald fill |
| 2 | New Invoice | `Button` | **`secondary`** | `.btn-secondary` = transparent + emerald text + `--color-primary-100` border. Reads as a real second-tier action, not a second CTA |
| 3 | (none — icon only) | **`PartyDetailMenu`** | `ghost`, 44×44 | Collapses "More Actions ⌄" to a **⋯ triple-dots** button. Already exists (A3) with the right menu items |

Note the crop shows slot 2 as a second emerald *fill*; the instruction to make
it **secondary** overrides the crop. Two filled emerald buttons side by side
compete for the same attention and break the one-primary-per-view rule — the
instruction is the better design. Flag if the fill was actually intended.

**Mobile-first CSS** (`party-action-bar.css`, base = 320px, no media query):

```
.pd-actions            display:flex; gap:var(--space-2); align-items:stretch
.pd-actions__cta       flex:1 1 0; min-width:0            /* both labelled buttons */
.pd-actions__cta .btn  width:100%; min-height:44px
.pd-actions__label     overflow:hidden; text-overflow:ellipsis; white-space:nowrap
.pd-actions__more      flex:0 0 44px; width:44px; height:44px   /* never shrinks */
```

Progressive enhancement upward only:

- **≥480px** — `gap: var(--space-3)`
- **≥768px** — row centres, `max-width: 640px`, buttons stop stretching
- **320px floor** — labels truncate before the ⋯ button is ever squeezed; icons
  stay `w-[18px]`, tap targets stay ≥44px. Verified at 320 as part of Phase 4.

Rejected: wrapping to two lines under 360px (pushes the tabs below the fold) and
hiding slot-2's label at 320 (an unlabelled document icon is unreadable).

## Phase 0.75 — variant-first justification

- **`SummaryTiles variant="divided"`** — extends, does NOT fork. Same component,
  same tones; adds a divider layout + icon suppression. A `PartyStatStrip` fork
  would duplicate all tone and dark-mode CSS.
- **`TransactionRow status` prop** — extends; renders through the existing
  `<Badge>`. No `LedgerRowWithStatus` fork.
- **`Button variant="outline-destructive"`** — one row in the cva map + one CSS
  rule beside `.btn-outline`. Closest existing are `outline` (emerald outline)
  and `destructive` (red **fill**); neither is a red outline. Reusable for every
  destructive secondary action. (Renamed from the draft's `outline-danger` — see
  audit A2.)
- **`PartyDetailMenu` reused, not rebuilt** (audit A3) — the action row's ⋯
  button mounts the existing component. Same menu items, same handlers, one
  extra mount point. This is the cheapest possible way to satisfy the
  triple-dots requirement.
- **`PartyOverdueAlert` — NEW, justified.** Closest inventory matches are
  `ErrorState` (a full-page 4-state block — wrong semantics: this is an inline
  actionable advisory, not a failed load) and `OfflineBanner` (hard-wired to
  connectivity). Composed of `Card` + `Button`; lives in
  `src/features/parties/components/` per the composition rule, not promoted to
  `ui/` until a second caller exists.
- **`PartyDetailPayBar` — NEW, justified.** Not a primitive: it is the
  party-specific *content* mounted inside the existing `BottomActionBar`, which
  keeps owning `position: fixed` + safe-area math (PLATFORM_SHELL C6/C9). Zero
  positioning CSS in feature code.

`NONE — justify creation` rows: **2**. Gate limit is 2. Pass.

---

## COMPONENT MAP (Phase 1)

| UI element | Component | Props / variant |
|---|---|---|
| Page shell | `AppShell` + `PageContainer` | `variant="detail"` |
| Emerald hero | `PartyDetailHeader` | + labelled action cluster |
| Header action | `Button` | `variant="ghost"`, 44px, `aria-label` |
| Stat strip | `SummaryTiles` | `variant="divided"`, 4 tiles |
| Overdue advisory | `PartyOverdueAlert` | NEW (justified) |
| Action row | `Button` ×2 | `primary` + `secondary` (§ Action row spec) |
| More (⋯) | `PartyDetailMenu` | existing — reused, not rebuilt |
| Tabs | `.party-detail-tabs` | unchanged |
| Ledger search | `Input` | `icon={<Search/>}`, client-side filter |
| Date range | `Button` `ghost` + `LedgerMonthPicker` | calendar trigger |
| Ledger row | `TransactionRow` | + `status` prop |
| Row status pill | `Badge` | `overdue` / `pending` / `paid` (audit A1) |
| Running balance | `.ledger-total` | + wallet icon square |
| Sticky pay bar | `BottomActionBar` + `PartyDetailPayBar` | `className="pd-paybar"` |
| Loading | `PartyDetailSkeleton` / `LedgerLoading` | update to 4-tile strip |
| Error | `ErrorState` | `onRetry={refresh}` |
| Empty | `EmptyState` / `LedgerEmpty` | existing |

---

## File Plan (each ≤ 250 lines)

### Server (not a HIGH_RISK path — no agent sequence required)

- [ ] `server/src/services/party/detail-stats.ts` — modify ~95→150 — add
      `oldestDueDays`, `openInvoiceCount`, `oldestOverdueInvoice{number,
      amountPaise, daysOverdue}`
- [ ] `server/src/services/party/ledger.types.ts` — +6 — row `status?:
      'PAID'|'PARTIAL'|'PENDING'|'OVERDUE'`
- [ ] `server/src/services/party/ledger.service.ts` — +12 — derive row `status`
      from `balanceDue` + `dueDate` (file is 170L after the drain — no split)
- [ ] `server/src/services/party/__tests__/detail-stats.test.ts` — create ~90

### Client — types & data

- [ ] `src/features/parties/party.types.ts` — +8 — mirror new stat fields
- [ ] `src/features/parties/ledger/ledger.types.ts` — +4 — mirror row `status`
- [ ] `src/features/parties/party.constants.ts` — +10 — `LEDGER_STATUS_BADGE`
      map: `OVERDUE→'overdue'`, `PENDING|PARTIAL→'pending'`, `PAID→'paid'`
      (real Badge variants — audit A1)

### Client — shared primitives (extend, never fork)

- [ ] `src/components/ui/SummaryTiles.tsx` — 78→110 — `variant?: 'tile' | 'divided'`
- [ ] `src/components/ui/summary-tiles.css` — +55 — `.summary-tiles--divided`,
      4-col with dividers, wraps 2×2 at 320px
- [ ] `src/components/ui/TransactionRow.tsx` — 95→130 — `status?: { label; variant }`
- [ ] `src/components/ui/transaction-row.css` — +25 — badge slot, amount/balance stack
- [ ] `src/components/ui/Button.tsx` — +1 — cva row `outline-destructive`
- [ ] `src/styles/components-ui.css` — +6 — `.btn-outline-destructive` beside
      `.btn-outline` (error-500 border + text, error-50 hover)

### Client — party feature

- [ ] `src/features/parties/components/PartyDetailHeader.tsx` — 122→165
- [ ] `src/features/parties/party-detail-header.css` — +70
- [ ] `src/features/parties/components/PartySummaryTiles.tsx` — 86→130 — 4 tiles, no icons
- [ ] `src/features/parties/components/PartyOverdueAlert.tsx` — **create** ~85
- [ ] `src/features/parties/components/party-overdue-alert.css` — **create** ~55
- [ ] `src/features/parties/components/PartyDetailActionBar.tsx` — 41→95 —
      primary / secondary / ⋯ per § Action row spec; mounts `PartyDetailMenu`
- [ ] `src/features/parties/components/party-action-bar.css` — **create** ~55 —
      mobile-first row (base 320px, ≥480, ≥768)
- [ ] `src/features/parties/components/PartyDetailPayBar.tsx` — **create** ~70
- [ ] `src/features/parties/components/party-pay-bar.css` — **create** ~45
- [ ] `src/features/parties/components/PartyDetailSkeleton.tsx` — +15
- [ ] `src/features/parties/PartyDetailPage.tsx` — 230→245
- [ ] `src/features/parties/ledger/PartyLedgerTab.tsx` — 180→235
- [ ] `src/features/parties/ledger/components/LedgerRowList.tsx` — 135→175
- [ ] `src/features/parties/ledger/components/LedgerToolbar.tsx` — **create** ~90
      (split out so `PartyLedgerTab` stays <250)
- [ ] `src/features/parties/ledger/ledger.utils.ts` — +25 — `rowStatusBadge()`,
      `filterRowsByQuery()`
- [ ] `src/features/parties/ledger/ledger.css` — +60

### i18n

- [ ] `src/lib/translations.en.ts` — +16 keys
- [ ] `src/lib/translations.hi.ts` — +16 keys

**Totals:** 6 created, 22 modified. No file crosses 250 lines.

---

## Design tokens (specific vars)

- **Colors** — hero `var(--color-hero-surface)` · white-on-emerald
  `var(--color-white-inverse)` · overdue `var(--color-error-50/500/600)` ·
  pending `var(--color-warning-50/600)` · credit `var(--color-success-50/600)` ·
  brand emerald `var(--color-primary-500)` (CTAs, tab underline, month label,
  FAB) · page bg `var(--color-gray-50)` · card `var(--color-gray-0)` · dividers
  `var(--color-gray-200)`
- **Two-greens check** — every CTA / tab-underline / FAB is brand emerald.
  Success green appears ONLY on the credit amount, the paid badge, and the
  header status dot. No mixing.
- **Radius** — card/alert `--radius-xl` · button `--radius-sm` ·
  input/toolbar `--radius-md` · badge/chip `--radius-full` · icon square `--radius-md`
- **Type** — `--fs-2xl` party name · `--fs-xl` stat value · `--fs-df` row title ·
  `--fs-sm` labels/hints · `--fs-xs` header action labels
- **Spacing** — page `px-4`; section group `space-y-6`; **every section
  container `py-0`**, inner padding on a child
- **Shadow** — `--shadow-card` · `--shadow-bar-top` (from the primitive)
- **Z** — `Z.*` / `--z-sticky` via primitives only
- **Motion** — `var(--duration-snappy)` + `var(--ease-default)`

## Translation keys (EN + HI, both files)

`whatsapp` · `moreActions` · `newInvoice` · `oldestDue` · `days` ·
`openInvoices` · `invoicesCount` · `overdueByDays` · `oldestInvoiceOverdue` ·
`searchTransactions` · `dateRange` · `balanceLabel` · `outstandingSuffix` ·
`receiveFullPaymentHint` · `receiveAmount` · `statusPending`

## 4 UI states (mandatory, all verified at 320px)

- **Loading** — `PartyDetailSkeleton` (hero + 4-tile strip + banner + 3 CTAs +
  tabs); `LedgerLoading` for the tab body
- **Error** — `ErrorState` with `onRetry={refresh}`; `LedgerError` in-tab
- **Empty** — `EmptyState` (party not found) · `LedgerEmpty` (no txns) · the
  overdue alert **and** pay bar hide entirely when outstanding ≤ 0
- **Success** — full render per mockup

## Offline compliance (`.claude/rules/OFFLINE_RULES.md`)

No new endpoints. New stat fields ride the existing `/parties/:id` payload, so a
stale-cache response without `stats` must still render — oldest-due and
open-invoice tiles fall back to `—`, the alert hides. Search is client-side over
already-fetched rows: zero extra network, works offline.

## Verification (Phase 4 — falsifiable)

```
npx tsc -b --noEmit                              && echo TSC_OK
node scripts/enforce.js                          && echo ENFORCE_OK
node .claude/skills/hp-design/check-refs.mjs     && echo REFS_OK
npm test -- detail-stats                         && echo TEST_OK
```
Plus screenshots of all 4 states at 320 / 375 / 768, light **and** dark; no
horizontal scroll; every tap target ≥44px.

## Explicitly NOT in scope

- Redesigning the Invoices/Payments/Info tab bodies (they reuse the same ledger
  component and inherit the row restyle for free)
- Promoting `PartyOverdueAlert` to `components/ui/` (waits for a 2nd caller)
- The mockup's OS status-bar chrome
