
# Prompt — HisaabPro transaction row

You are designing one UI component for **HisaabPro**, an Indian billing/business-management
app for MSMEs (React 19 + TypeScript + Tailwind 4, mobile-first, offline-first).

## The problem

Design the **transaction/invoice list row** — the repeating card in the sales, purchases and
party-ledger lists. This row is the most-viewed surface in the app; a user scrolls it dozens
of times a day.

Four constraints, all binding at once:

1. **Compact height.** Lists run to hundreds of rows. Every extra pixel costs rows-per-screen.
2. **Optimised for the unpaid case.** Most transactions in a real ledger are *not yet paid*.
   The number the user is hunting for is "how much is still owed", not the invoice total.
   Competitor apps bury this.
3. **Actions must be reachable on the row.** Sharing a bill on WhatsApp and recording a
   payment are daily actions. Burying them entirely behind a detail screen is wrong.
4. **Must survive 320px.** Target hardware is Rs 8,000–15,000 Android phones. Party names run
   long ("M/s Krishnamurthy Textile Trading Company") and amounts run to crores
   ("Rs 1,90,00,000"). Both in the same row, without horizontal scroll.

The tension: at 320px a row has ~288px. A crore amount takes ~130px and two action buttons
take ~78px, leaving ~55px for the name — about 7 characters. Solve that.

## Competitor context

- **Vyapar** puts three icons (Print, Share, overflow) on every row plus dual Total/Balance
  columns. Dense and capable, but visually dated — explicitly what HisaabPro must not be.
- **MyBillBook** keeps rows clean and moves all actions to the detail screen. Premium-looking
  but costs a tap for the most common action.

Fuse them: the density of Vyapar with the restraint of MyBillBook.

## Design system (non-negotiable)

- Aesthetic: premium, Cred/Jupiter polish. Generous whitespace, soft shadows, subtle motion.
- **Two greens, never mixed.** Brand emerald `#026F39` = identity + primary actions + nav.
  Success green `#22C55E` = status only (paid / up-delta). A "Paid" chip is never brand
  emerald; an "Add payment" button is never success green.
- Warm-cream neutrals, not cool grey. Page bg `#F8F7F4`, cards `#FFFFFF`, borders `#F0EFEB`,
  headings `#2A2824`, secondary text `#7A7870`, muted `#9C9A92`.
- Status: error `#EF4444`/`#DC2626`, warning `#F59E0B`/`#D97706`, success `#22C55E`/`#16A34A`.
- Radius: cards 12px, buttons 8px, chips/avatars full.
- Font: Inter. Body minimum 16px generally; dense list rows may go to 14px/11px.
- Money: integers in paise on the wire; display via `Intl.NumberFormat('en-IN')` in Indian
  grouping (Rs 1,00,000), always `tabular-nums`.
- Touch targets >= 44px.
- Dark mode via CSS-variable swap — no `dark:` utility classes.
- Every string comes from a translation object (English + Hindi). No hardcoded copy.

## What to produce

1. A rendered visual mockup (self-contained HTML, inline CSS, no external assets) showing
   **at least four distinct row layouts** solving the constraints differently — not variations
   on one idea. Populate every layout with the *same* realistic Indian data, at least
   two-thirds of it unpaid or overdue.
2. Include the stress cases in the mockup: a 40-character party name, a crore-scale amount,
   a partial payment, and a paid row — all rendered at 320px.
3. For each layout, state the row height and the specific tradeoff it makes.
4. Recommend one, and say what you would give up to get it.

## Decisions already made (respect these)

- The **amount still owed** is the hero number, not the invoice total.
- Actions are **state-dependent**: an unpaid row shows *Add payment* + overflow; a paid row
  shows *Share* + overflow. Both pairs occupy the same slot width so rows stay aligned.
- Maximum **two** visible action buttons. The full set (Collect, Share, Print, Delete) lives
  on swipe-left.
- The party name is the only element allowed to shrink and truncate. The amount and the
  actions are fixed-width. Truncating an amount in a ledger is unacceptable.

## Open question to solve

At 320px, is the right answer (a) dropping the overflow button, (b) putting the name on its
own line and letting the row grow ~6px, (c) abbreviating large amounts to "Rs 1.90 Cr", or
(d) something better? Argue it, don't just pick. Note that (c) hides exact rupees, which is
risky in a ledger.
