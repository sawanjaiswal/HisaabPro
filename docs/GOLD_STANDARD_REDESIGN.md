# HisaabPro — Gold Standard Plan: Redesign

> **Purpose:** define what "gold standard" means for a redesigned screen, measure
> every remaining screen against it, and sequence the work so the highest-value
> screens land first.
>
> **Scope:** the GPT redesign sweep only. Multi-tenant, correctness, and debt
> work live in `docs/GOLD_STANDARD.md`. Wave/mockup mapping lives in
> `docs/GPT_REDESIGN_PLAN.md`. This doc is the **quality bar + sequence**.
>
> Measured: **2026-07-21** · Branch: `redesign/mobile-first-sweep`
> Re-run the scan in Appendix A to refresh every number here.

---

## 0. Out of scope — already designed, do not touch

Shipped in `891528a` and signed off. These are the **reference implementations**;
when a rule below is ambiguous, copy what these do rather than reinterpreting.

| Screen | Route | Role |
|---|---|---|
| Dashboard / home | `/dashboard` | canonical Emerald-Hero + staged reveal |
| Party list | `/parties` | canonical list archetype (A) |
| Party detail / ledger | `/parties/:id` | canonical entity-detail archetype (B) |
| Product list | `/products` | canonical grid list |
| Product detail | `/products/:id` | canonical detail |
| Add/Edit product | `/products/new`, `/:id/edit` | canonical form |
| Invoice detail | `/invoices/:id` | canonical document detail |
| Filter & sort drawer | (primitive) | canonical `<Drawer>` filter |

Re-styling any of these is a **regression**, not progress.

---

## 1. The bar — what "gold standard" means for one screen

A screen is gold when all seven hold. Six are mechanically checkable; one is not.

| # | Criterion | Verified by |
|---|---|---|
| G1 | **Archetype match** — mounts the right shell (`HeroPage` / `PageContainer` / `AppShell`) for its archetype (A–O per `hp-design/screen-archetypes.md`) | scan + review |
| G2 | **4 UI states** — loading skeleton, error + retry, empty + CTA, success. *Applicability rule in §2.* | scan + 320px screenshot |
| G3 | **Tokens only** — no hex, no Tailwind palette, no raw px/ms. Dark-mode parity automatic | `enforce.js` |
| G4 | **Primitives only** — `<Button>`/`<Input>`/`<Card>`/`<Badge>`/`<Drawer>`; no raw interactive HTML, no `window.confirm`, no `alert()` | review (convention) |
| G5 | **i18n complete** — every string `t.*`, keys in both `translations.{en,hi}.ts` | scan + review |
| G6 | **Responsive** — no horizontal scroll at 320/375/768/1024/1280/1536; tap targets ≥44px | browser measurement |
| G7 | **Offline-correct** — `api()` only, mutations carry `entityType`+`entityLabel`, no `localStorage` for entities | `enforce-offline.mjs` |

**Ship gate per screen:** `tsc` clean · `enforce.js` 0 · `check-refs.mjs` fresh ·
all four states screenshotted at 320px · `PAGE_AUDIT_CHECKLIST.md` A–N ticked.

### The criterion that will actually slip

G4 and G5 are **convention-only** — nothing fails the build if you use a raw
`<button>` or hardcode an English string. Every other criterion has a gate. Budget
review attention accordingly; the enforcers will not save these two.

---

## 2. Measured state — 195 pages

```
total=195   gold=71 (36%)   gaps=124
```

Note this is stricter than the 43% in `GPT_REDESIGN_PLAN.md §6`, which scanned
190 files with a looser definition. **Use 71/195 as the baseline.**

### Honest caveat on the "empty state" column

The scan counts a missing `<EmptyState>` as a gap on every page. That
over-counts: a **detail page or a form has no empty state** — its zero-data case
is "not found", which is an error state. Roughly a third of the 124 gaps are
detail/form pages flagged only for empty. Treat the empty column as a
*question*, not a defect, and resolve it per archetype:

- Archetype A (list/index) → empty state **required**
- Archetype B (entity detail) → not-found → **error state**, empty N/A
- Forms / wizards → empty N/A

### Gaps by area — worst first

| Area | Pages w/ gaps | error | empty | loading | i18n | shell |
|---|---|---|---|---|---|---|
| settings | 13 | 4 | 9 | 7 | 2 | 1 |
| marketing | 9 | 7 | 5 | 0 | 0 | **9** |
| reports | 8 | 2 | 4 | 6 | 0 | 0 |
| sales | 7 | **7** | 7 | 6 | 3 | 6 |
| auth | 4 | **4** | 4 | **4** | 3 | **4** |
| godowns | 4 | 1 | 4 | 1 | 0 | 0 |
| pos | 4 | 2 | 4 | 2 | 0 | 1 |
| custom-orders | 4 | 1 | 3 | 0 | **4** | 0 |
| hr | 4 | 1 | 4 | 2 | 0 | 0 |
| jobs | 4 | 1 | 3 | 0 | 2 | 0 |
| top-level `pages/` | 4 | 2 | 4 | 3 | **4** | **4** |
| bom | 3 | 0 | 2 | 0 | **3** | **3** |
| production-runs | 3 | 1 | 2 | 1 | **3** | **3** |
| business | 3 | 2 | 3 | 3 | 1 | 2 |
| tax | 3 | 1 | 3 | 1 | 0 | 0 |

Remaining 24 areas: 1–3 pages each, mostly a single missing state. Full output
via Appendix A.

---

## 3. Sequence — value-ordered, not wave-ordered

`GPT_REDESIGN_PLAN.md` sequences by mockup wave. That ordering optimises for
mockup coverage; this one optimises for **user-visible value per hour**. Where
they disagree, follow this one and tick the wave table as screens land.

### Phase 1 — Auth (4 screens) · ⛔ do first

`LoginPage` · `RegisterPage` · `VerifyOtpPage` · `ForgotPasswordPage`

Worst scores in the codebase: **all four fail all five checks**. No error state,
no loading state, no shell primitive, 3 of 4 without i18n. This is the first
screen every user sees and the only screen a *failed* user sees. A login that
gives no feedback on a wrong OTP reads as a broken app, not a wrong password.

Highest value-per-screen in the entire plan. Four files.

### Phase 2 — Marketing shell (9 screens)

All 9 miss a layout primitive and 7 miss error states. Uniform defect, uniform
fix — mount `PageContainer`, add `<ErrorState onRetry>`. Cheapest large win;
mechanical enough to batch.

### Phase 3 — Sales (7 screens)

`SalesHubPage` · `DocumentListPage` · `EstimatesPage` · `SaleOrdersPage` ·
`DeliveryChallansPage` · detail pages · `create/*` wrappers

**Every one of the 7 lacks an error state.** Core revenue flow — a silent failure
here means a user thinks an invoice saved when it did not. Highest correctness
risk of any group, and it maps to redesign Waves 1 and 4.

### Phase 4 — Settings (13 screens)

Largest count, lowest per-screen urgency. Split 3 ways per `GPT_REDESIGN_PLAN`
Wave 8a/8b/8c. Mostly empty/loading states on list-shaped settings pages.

### Phase 5 — Reports (8 screens) + no-i18n features (bom, production-runs, custom-orders)

Reports need loading states (6 of 8). BOM / production-runs / custom-orders have
**no i18n at all** — 10 screens of hardcoded English. That's a translation-key
task more than a design task; scope it as such and do it in one pass.

### Phase 6 — Long tail (24 areas, 1–3 pages each)

Batch by defect, not by area: one pass adding empty states, one adding error
states. Faster than 24 separate page visits.

### Phase 7 — NEW builds (5) · deferred

Delivery-Route · Today's Tasks · **Universal Search** (full-stack: no component,
hook, or `/api/search` exists) · Help & Support · About.

Stays deferred per D2 pending competitor comparison (Vyapar / myBillBook /
Khatabook / OkCredit). Do not start these before the restyle phases land — they
add surface area to a sweep that is not yet closed.

---

## 4. Per-screen workflow (no exceptions)

1. `/hp-design` — Phase 0 marker, Phase 0.5 inventory, Phase 1 component map
2. Identify the **archetype** (A–O) → copy its skeleton from `page-templates.md`
3. Build against the reference implementations in §0 — do not reinterpret
4. `PAGE_AUDIT_CHECKLIST.md` A–N
5. Verify: `tsc` · `enforce.js` · `check-refs.mjs` · 4 states at 320px in Chrome
6. Commit one screen (or one batched defect class) per commit

---

## 5. Honest limits of this plan

- **The scan is structural, not visual.** It proves an `<ErrorState>` is
  imported, not that it renders the right message, or that the page matches its
  mockup. G1 and G4 still need eyes on every screen.
- **71/195 "gold" is optimistic.** A page passing all five scanned checks can
  still miss its archetype or use raw `<button>`s. The real number is lower;
  the scan sets an upper bound.
- **Mockup fidelity is unmeasured.** Nothing here compares a built screen to its
  GPT mockup. That comparison is manual and is the one thing no gate covers.

---

## Appendix A · Re-measure

```bash
node scripts/enforce.js && node scripts/enforce-offline.mjs
node .claude/skills/hp-design/check-refs.mjs
npx tsc -b --noEmit
# per-page state scan — regenerates §2
node scripts/scan-ui-states.mjs
```

The scan reports `total / gold / gaps` plus a per-area breakdown of which of the
five checks each area fails.
