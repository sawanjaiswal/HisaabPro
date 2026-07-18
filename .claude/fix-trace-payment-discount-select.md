---
symptom: Recording or fetching a payment 500s with "Unknown field `value` for select statement on model `PaymentDiscount`"
root_cause_file: server/src/services/payment/selects.ts:48
root_cause_reason: PAYMENT_DETAIL_SELECT selects a `value` column that does not exist on PaymentDiscount (model stores valuePaise XOR percentBps)
---

## 5-whys
1. Why does payment create 500? — Prisma rejects `tx.payment.findUniqueOrThrow` because the select is invalid.
2. Why is the select invalid? — It requests `discount.select.value`, and `PaymentDiscount` has no `value` field.
3. Why does it request `value`? — The frontend `PaymentDiscount` type exposes a single `value` (0-100 for %, paise for FIXED), and the select was written against that API shape instead of the DB columns.
4. Why did the DB shape diverge? — Migration A2 split the single value into `valuePaise` XOR `percentBps` (with a CHECK constraint) but the read select was never updated to derive `value` from them.
5. Why wasn't it caught? — No test creates a payment through the real service with PAYMENT_DETAIL_SELECT; list-select (which only reads `calculatedAmount`) masked the gap.

## Hypothesis
PAYMENT_DETAIL_SELECT must select the real columns (`type, valuePaise, percentBps, calculatedAmount, reason`) and a shared mapper must derive the API `value` (percentBps/100 for PERCENTAGE, valuePaise for FIXED) so every payment-detail return site emits the `{ id, type, value, calculatedAmount, reason }` contract the frontend expects.

## Failing test
server/src/services/payment/__tests__/create.discount.test.ts — create a PAYMENT_IN with a FIXED discount and assert the returned discount.value equals the entered paise.
