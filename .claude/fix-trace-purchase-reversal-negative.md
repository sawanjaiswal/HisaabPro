---
symptom: Deleting a supplier bill whose goods have already been sold leaves the product at negative stock, silently.
root_cause_file: server/src/services/document/delete.ts:40
root_cause_reason: Reversing a received-goods document runs through the same adjustStock path a sale does, so the WARN_ONLY selling policy allows it — but a reversal has no physical counterpart, so nothing bounds it and the shelf ends up owing goods.
---

## 5-whys

1. **Why did the product end at -5 after the purchase was deleted?**
   The delete reversed a +10 stock movement against a shelf that held 5.
2. **But why was that allowed?** `reverseForInvoice` calls `adjustStock` with a
   negative quantity, and `adjustStock` only refuses a negative balance under
   `HARD_BLOCK`. The business runs `WARN_ONLY` (the default), so it passed.
3. **But why does WARN_ONLY apply to a reversal at all?** Because reversal reuses
   the sale path verbatim. To `adjustStock` a give-back and a sale are the same
   event: quantity < 0.
4. **But why is that wrong?** WARN_ONLY exists for a lag in the records — the
   shopkeeper physically HAS the goods and the purchase has not been entered
   yet, so blocking the sale would stop a queue for a bookkeeping reason. A
   reversal is the opposite: the goods are gone (sold to a customer) and the
   app is being asked to un-receive them. There is nothing to warn about and
   nothing that later reconciles.
5. **But why did nobody notice?** The delete answers 200 and the warning
   `adjustStock` produces is discarded by `reverseForInvoice`. The only trace is
   a negative `currentStock` that every downstream number then inherits:
   valuation goes negative, reorder alerts fire, and the shop's own books say
   it sold goods it never bought.

**Root cause:** the reversal boundary has no bound of its own. The policy it
inherits (`WARN_ONLY`) answers a different question — "may I sell?" — and the
question actually being asked, "may I take these back off the shelf?", is never
put to anything.

## Hypothesis

Guard at the boundary that knows the NET effect, not inside `reverseForInvoice`
— an edit legitimately reverses and immediately re-applies, so a per-movement
guard would refuse correct edits at the intermediate step. `deleteDocument` and
`updateDocument` both know how much stock a received-goods document is about to
give back; a shared `assertStockGiveBackPossible` refuses when any product does
not have that much on the shelf, naming the product and telling the shopkeeper
to record a purchase return instead. The guard is unconditional: it is
arithmetic, not policy, so `HARD_BLOCK` / `WARN_ONLY` does not enter into it.

## Failing test

`e2e/gold/purchases.spec.ts` — TC-PUR-04b: buy 20, sell 15, delete a bill for
10. Before the fix stock ends at -5 and the delete answers 200.
