---
symptom: Allocating more than an invoice's due drives balanceDue negative, and PUT /payments/:id/allocations accepts another business's invoice id
root_cause_file: server/src/services/payment/create.ts:27
root_cause_reason: allocation validation only compared the allocation total against the payment amount — never against each invoice's own balanceDue — and the update path repeated the check without even the ownership half
---

## 5-whys

1. Why does an invoice show a negative balance due? — An allocation of more than its due was accepted.
2. Why accepted? — Create validates `allocTotal <= payment.amount` and that the invoices exist; no
   check compares an allocation against the invoice's `balanceDue`.
3. Why does that matter beyond a cosmetic number? — `balanceDue` is summed for receivables, drives the
   outstanding list and the party statement; one negative row silently reduces the total the shop chases.
4. Why is the update path worse? — `updateAllocations` re-implements the same partial check and drops
   the ownership half, so `tx.document.update({ where: { id } })` writes to whatever id was sent —
   another tenant's invoice included.
5. Why did the duplication happen? — The rule lived inline in two call sites instead of one guard, so
   the second copy could be weaker than the first without anything noticing.

## Hypothesis

There is one rule — "an allocation fits the payment, belongs to this business, and does not exceed
what is due on the invoice" — and it belongs in one module both writers call. On update, the payment's
existing allocations are reversed first, so their amounts are capacity the invoice is about to get
back and must be added to the cap; otherwise re-saving an unchanged allocation would fail against the
balance it created itself.

## Failing test

e2e/gold/payments.spec.ts — TC-PAY-07 (an invoice cannot be paid more than it is worth) and
TC-PAY-09 (re-saving allocations, the regression the capacity term protects), and TC-PAY-10
(a rewritten allocation may not reach an invoice this business does not own).
