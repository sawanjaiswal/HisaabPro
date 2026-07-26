---
symptom: A customer holding an advance shows the advance as money owed on their outstanding page
root_cause_file: server/src/services/payment/outstanding.ts:132
root_cause_reason: getPartyOutstanding returns Math.abs(outstandingBalance) and no direction field, so the sign that distinguishes a debt from a credit is destroyed with nothing carrying it
---

## 5-whys

1. Why does a Rs 2,500 advance read as Rs 2,500 owed? — The party-detail endpoint returns 2500 positive.
2. Why positive? — `outstanding: Math.abs(party.outstandingBalance)`; the stored balance is -250000.
3. Why is the stored value negative? — That is the contract: `Party.outstandingBalance` is
   "positive = receivable, negative = payable" (schema.prisma:455), and `createPayment` decrements it.
4. Why does abs() not lose information in the LIST endpoint? — Because the list pairs it with
   `type: 'RECEIVABLE' | 'PAYABLE'`, which carries the direction. The detail response has no such field.
5. Why did nobody see it? — The detail endpoint has no page consuming it yet, and the client type
   (`OutstandingPartyDetail.outstanding`) says only "current net outstanding", which is what the caller
   would assume it got.

## Hypothesis

The direction is part of the amount, not a display concern. Both endpoints should return the SIGNED
balance and state the direction alongside it, from one helper, so the two responses cannot drift again;
the UI already renders with `Math.abs()` plus a receivable/payable class, so signed values are what it
wants. Erasing the sign server-side is the only place the information can be lost permanently.

## Failing test

e2e/gold/payments.spec.ts — TC-PAY-03 (an advance with no invoice becomes an on-account credit).
