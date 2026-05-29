verdict: PASS

# Architecture Critique — S1 GL Auto-Posting (rev 2 re-judge of M4)

audit_of: .claude/design-plan-active--s1-gl-auto-posting--bare-055707.md
scope_ref: docs/EPIC_s1-gl-auto-posting (SCOPE)
auditor: architecture-auditor
audited_at: 2026-05-29
must_ship_gaps: 0
prior_must_ship: M4 (SALE map unbalanced) — RESOLVED

## Verdict

PASS. The sole remaining MUST_SHIP (M4 — SALE posting map unbalanced) is
resolved by rev 2. Revenue now posts from `subtotal` instead of
`totalTaxableValue`, which fixes the composition-scheme break. The algebraic
balance identity is correct for any sign of roundOff and any TDS/TCS, and no
grandTotal component is left unaccounted. The one open question — whether
`subtotal` is net-of-discount — is resolved from code in the affirmative, so
no new gap.

## M4 re-judge — three checks

### (1) Does the SALE map balance for the three worked examples?

All three balance. Verified by hand against the rev-2 map at plan lines 137-138.

- **A — standard GST** (subtotal 100000p, GST 18000p, charge 5000p, roundOff 0):
  grandTotal = 100000+5000+18000 = 123000. Debit AR 123000. Credit
  Revenue 100000 + Tax 18000 + Other Income 5000 = 123000. ✓
- **B — composition scheme** (subtotal 100000p, GST 0, totalTaxableValue=0):
  Revenue posts from subtotal = 100000 (NOT taxableValue=0). grandTotal =
  100000. Debit AR 100000. Credit Revenue 100000. ✓ — **this is the exact
  break flagged in the prior audit; posting from `subtotal` closes it.** With
  the old `taxableValue` basis the credit side would have been 0 → unbalanced.
- **C — TDS on sale** (subtotal 100000p, GST 0, TDS 2000p): grandTotal =
  100000 (TDS is NOT in grandTotal — confirmed at document-calc.ts:124-126).
  Debit AR (100000−2000) 98000 + TDS Receivable 2000 = 100000. Credit Revenue
  100000. ✓

Confirmed: Revenue=subtotal fixes the composition break.

### (2) Is the plan's algebraic identity correct?

Yes. Ground truth from code: `grandTotal = subtotal + charges + totalTax +
roundOff` (document-calc.ts:124-126; no TDS/TCS terms).

- Σdebit = (grandTotal − tds + tcs) + tds + max(−roundOff,0)
         = grandTotal + tcs + max(−roundOff,0)
- Substitute grandTotal:
         = subtotal + charges + totalTax + roundOff + tcs + max(−roundOff,0)
- Identity roundOff + max(−roundOff,0) = max(roundOff,0) (holds for either sign):
         = subtotal + charges + totalTax + max(roundOff,0) + tcs
- Σcredit = subtotal + totalTax + charges + tcs + max(roundOff,0)

Σdebit = Σcredit for any sign of roundOff and any tds/tcs value. The TDS terms
cancel (−tds on AR debit, +tds on TDS-Receivable debit); TCS appears once on
each side. The reduction printed in the plan (lines 147-152) is correct.

### (3) Does any grandTotal component remain unaccounted?

No. grandTotal decomposes into exactly four credit-side terms, each mapped:
- subtotal      → Sales Revenue 4000
- charges       → Other Income 4100 (totalAdditionalCharges)
- totalTax      → Tax Payable 2100 (totalCgst+totalSgst+totalIgst+totalCess)
- roundOff      → RoundOff 5400 (sign-split: credit if >0, debit if <0)

TDS/TCS are correctly treated as OUTSIDE grandTotal (separate Document
columns) and netted on the AR debit. Cost side (COGS/Inventory) is internally
balanced and independent of grandTotal. Nothing is dropped or double-counted.

**totalDiscount — resolved from code, NOT assumed:** document-calc.ts:32
computes `lineTotal = max(0, gross − discountAmount)`; line 78 accumulates
`subtotal += lineTotal`. `totalDiscount` is tracked in a separate accumulator
(line 79) and is NEVER added back into preRound or grandTotal (lines 124-126).
Therefore `subtotal` is already NET of discount, discount is purely
informational for reporting, and posting Revenue=subtotal does not double-count
or omit discount. **subtotal is net, not gross — no MUST_SHIP.** (If it had
been gross, the credit side would have over-stated revenue by totalDiscount and
this would be a balance break; it is not.)

## SHOULD_SHIP dispositions (carried, not blocking)

- **S1 (COGS source):** RESOLVED. COGS posts `Document.totalCost` (computed at
  invoice time per document-calc.ts:81 `totalCost += cost`), not the misnamed
  `Product.avgCost`. Backfill falls back to `weightedAvgCostPaise × qty`. Cost
  line pair skipped+warned when totalCost=0 (open-Q4) — acceptable; a
  fabricated COGS would be worse than an absent one.
- **S2 (expense category → account):** ACCEPTED with FUTURE_EPIC. Default 5200
  Indirect with a name-heuristic bump to 5100 Direct; proper
  `ExpenseCategory.ledgerAccountId` FK deferred. Note: plan lines 171-178 and
  180-191 carry two slightly different S2 phrasings (name-heuristic vs a table
  in posting.maps.ts). Not a balance issue and not blocking, but tighten to one
  description at build time to avoid implementer ambiguity.

## What the architecture got right

- Maps built from REAL Document columns, cross-referenced to document-calc.ts.
- TDS/TCS correctly excluded from grandTotal and netted on AR/AP — matches code.
- Sign-split RoundOff line keeps each entry one-sided per leg.
- Zero-value components emit no line (plan line 169) — keeps entries clean and
  the partial unique index meaningful.
- Hard-atomic posting inside the existing mutation `$transaction` (M1) — no
  degrade-to-warning path that could leave half-posted entries.
- Account resolution by stable seeded `code` via `assertSystemAccounts` — a
  missing account is a loud failure, not a silent skip.
- File plan all ≤250L, correct layer ordering.

## Cross-session learnings applied

- `feedback_auth_req_user_shape` — posting hooks run inside tenant-scoped
  mutation transactions; the JE write keys on `businessId` (partial unique
  index, plan line 239), so no cross-tenant IDOR surface is introduced.
