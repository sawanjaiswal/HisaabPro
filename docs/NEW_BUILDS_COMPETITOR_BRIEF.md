# NEW-build screens — competitor brief (D2 decision input)

> Feeds the **D2 deferral** in `GPT_REDESIGN_PLAN.md`. The restyle sweep is complete;
> these 6 screens have no existing HisaabPro page and were held back until their scope
> is defined against the market. This brief exists so Sawan can make the go/no-go +
> scope call per screen, then each greenlit screen becomes its own `/f` epic.
>
> **Sourcing honesty:** competitor behaviour below is from general product knowledge of
> the Indian SMB-billing category (Vyapar, myBillBook, Khatabook, OkCredit) as of early
> 2026. Feature details in these apps shift release-to-release — anything marked ⚠️ should
> be spot-checked in the live app before it drives a build decision. Nothing here is a
> live teardown.

Personas referenced from `CLAUDE.md`: **Raju** (micro retailer), **Priya** (growing
wholesaler), **Amit** (multi-location distributor).

---

## Scoreboard (recommendation at a glance)

| # | Screen | Vyapar | myBillBook | Khatabook | OkCredit | Rec. MVP | Priority | Rough effort |
|---|--------|--------|-----------|-----------|----------|----------|----------|--------------|
| #24/61 | Universal Search | ✅ strong | ✅ | partial | partial | **Build (client-first)** | **P1** | M (FE) + S (BE opt.) |
| #36 | Help & Support | ✅ | ✅ | ✅ | ✅ | **Build (static+contact)** | **P1** | S |
| #37 | About | ✅ | ✅ | ✅ | ✅ | **Build (static)** | **P1** | XS |
| #64 | Today's Tasks | partial ⚠️ | partial ⚠️ | ❌ | ❌ | **Build (aggregator)** | **P2** | M |
| #58 | Opening balance | ✅ | ✅ | ✅ (khata) | ✅ (khata) | **Build (onboarding step)** | **P2** | S–M |
| #26 | Delivery / Route | ❌ (add-on ⚠️) | ❌ | ❌ | ❌ | **Defer / validate demand** | **P3** | L (full-stack) |

Read: #36/#37 are near-free table-stakes and should ship first. #24/61 is the highest
user-value net-new. #26 is the only one no direct competitor ships as core — treat it as
a differentiator bet that needs demand validation before a large build.

---

## #24/61 — Universal Search  · **P1 · Build (client-first)**

**What it is:** one search entry point (header icon / command bar) that finds parties,
invoices, products, payments across the app. Verified 2026-07-21: no search component,
hook, or `/api/search` endpoint exists today — this is net-new.

**Market:** Vyapar and myBillBook both put a persistent search on list screens and a
global party/item lookup; Khatabook/OkCredit search is mostly within the customer/khata
list. A single cross-entity command bar is a credible polish edge for HisaabPro.

**Recommended MVP:**
- Header search icon → full-screen search sheet (archetype F/list), debounced.
- **Client-first**: query the already-cached Dexie stores (parties, recent invoices,
  products) so it works offline and needs no backend on day one. Group results by entity
  with the tinted-icon-row motif; tap → deep-link to the detail page.
- Recent searches + empty state (“Search parties, invoices, products”).

**Phase 2:** a real `/api/search` with server-side ranking for accounts too large to
cache. Only if the client index proves insufficient.

**Open questions for Sawan:** (a) scope entities for v1 — parties + invoices + products,
or include payments/expenses? (b) command-bar (Cmd/Ctrl-K desktop) or mobile-sheet only?

---

## #36 — Help & Support  · **P1 · Build (static + contact)**

**What it is:** entry point for FAQs, contact channels, and how-to content.

**Market:** universal — every competitor has a Help/Support entry (FAQ + WhatsApp/call/
email). Khatabook & OkCredit lean on in-app chat + WhatsApp; Vyapar has a help centre +
YouTube tutorials.

**Recommended MVP (archetype H — grouped list):**
- Grouped tinted-icon rows: **Contact us** (WhatsApp — first-class per project rules,
  call, email), **FAQs** (accordion of static Q&A, i18n en+hi), **Video guides** (links),
  **Report a problem** (routes into existing `FeedbackWidget`).
- No backend — static content + `wa.me`/`tel:`/`mailto:` deep links. Reuse `<Accordion>`,
  `<FeedbackWidget>`.

**Open questions:** (a) support WhatsApp number / email to wire in? (b) FAQ content — I
can draft an initial en+hi set from the feature surface for your review.

---

## #37 — About HisaabPro  · **P1 · Build (static)**  · smallest, ship first

**What it is:** app identity — version, legal links, credits.

**Market:** universal, trivial. Version + Terms + Privacy + rate-us + social.

**Recommended MVP (archetype H):** logo + `APP_NAME` + version from `app.config`, rows for
Terms / Privacy / Rate us (Play Store deep link) / Website (hisaabpro.in) / social. Pure
static, `APP_NAME` never hardcoded. **~XS effort — good warm-up / first epic.**

**Open questions:** Terms & Privacy URLs live yet? Play Store listing URL for “Rate us”?

---

## #64 — Today's Tasks  · **P2 · Build (aggregator)**

**What it is:** a daily action hub — overdue follow-ups, payments due, low stock,
reminders firing today.

**Market:** ⚠️ Vyapar/myBillBook surface *dashboard cards* (receivables due, low stock) but
not a dedicated unified “today” task list; Khatabook/OkCredit don’t really have this. So
it’s a **differentiator**, not table-stakes — but built entirely on data HisaabPro already
has (reminders, follow-ups, dues, stock).

**Recommended MVP (archetype A — list):** aggregate existing sources into one dated,
grouped, actionable list (overdue collections, today’s reminder rules, low-stock items),
each row deep-linking to the relevant action. No new backend if it composes existing
endpoints; a thin `/api/today` aggregator is the Phase-2 optimisation.

**Open questions:** (a) which sources in v1? (b) is this a tab, a dashboard section, or a
standalone page (#64 mock implies standalone)? (c) does it overlap enough with the
dashboard to merge instead of add?

---

## #58 — Opening balance  · **P2 · Build (onboarding step)**

**What it is:** capture a party’s / account’s starting balance at setup so ledgers are
correct from day one. Referenced as an onboarding step and as the archetype-G / sticky-CTA
mock.

**Market:** universal and important — Vyapar/myBillBook prompt opening balance on party &
bank-account creation; Khatabook/OkCredit’s whole model starts from an opening khata
balance. Getting this wrong corrupts every downstream report, so correctness > polish.

**Recommended MVP (archetype G — wizard step / form):** opening-balance field on
party-create and bank-account-create (amount in paise, To-collect / To-pay direction),
plus an onboarding step to seed balances for imported parties. **Touches ledger posting —
this is the one NEW build with data-integrity risk**; per `CLAUDE.md` high-risk rules a
schema/ledger change forces the `architect` (+ `security` if it touches money writers)
sequence before code.

**Open questions:** (a) opening balance per-party only, or also bank/cash accounts? (b)
editable after creation, or immutable once transactions exist? (c) does the existing
ledger writer already accept an opening-balance entry, or is a migration needed?

---

## #26 — Delivery / Route  · **P3 · Defer / validate demand first**

**What it is:** delivery management / route planning for distributors (Amit persona) —
delivery lists, route ordering, proof-of-delivery.

**Market:** ⚠️ **none of the four core competitors ship this as a core feature** — it’s the
domain of specialised distributor/field-sales apps, sometimes a Vyapar add-on. So it’s the
highest-uncertainty, highest-effort item: a real differentiator for the Amit segment, or
scope that a micro-retailer (Raju/Priya, the primary personas) never touches.

**Recommendation:** **do not build on the strength of a mockup alone.** Validate demand
with a few distributor users first. If greenlit it’s a full-stack epic (schema: deliveries/
routes/stops; endpoints; map/ordering UI) and should get its own scope-writer → architect
pass — not a quick `/f`.

**Open questions:** (a) is the Amit/distributor segment a near-term target or later? (b)
MVP = a simple ordered delivery checklist per day, or full route optimisation + maps? (c)
willing to validate with real distributors before committing?

---

## Suggested sequencing if you greenlight

1. **#37 About** (XS) → **#36 Help** (S) — table-stakes, static, no backend, quick wins.
2. **#24/61 Universal Search** (client-first) — highest net user value, offline-friendly.
3. **#58 Opening balance** — high value but **high-risk (ledger)**; run the architect
   sequence.
4. **#64 Today's Tasks** — differentiator on existing data.
5. **#26 Delivery/Route** — validate demand before any build.

Each greenlit screen → its own `/f` epic, one-commit-per-page discipline, `/hp-design`
gate, 4 UI states. #58 and #26 additionally trip the high-risk agent sequence.
