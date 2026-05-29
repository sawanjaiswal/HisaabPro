---
symptom: A BOUNCED cheque can be re-updated (e.g. flipped to CLEARED), erasing bouncedAt/bounceCharges/bounceReason.
root_cause_file: server/src/services/cheque.service.ts:60
root_cause_reason: The terminal-state guard lists ['CLEARED','CANCELLED','RETURNED'] but omits 'BOUNCED', which the write path at line 76 actually produces — so the most common terminal outcome is treated as non-terminal.
---
## 5-whys
1. Why can a bounced cheque be updated again? — Because updateChequeStatus only rejects when existing.status is in ['CLEARED','CANCELLED','RETURNED'].
2. Why isn't BOUNCED rejected? — Because BOUNCED is not in that array, even though it is a valid CHEQUE_STATUSES value the bounce path writes.
3. Why was BOUNCED omitted? — The guard was written against an assumed status name 'RETURNED' (a status the bounce write path never sets), a divergence between the guard's vocabulary and the writer's vocabulary.
4. Why does the divergence matter? — Flipping BOUNCED→CLEARED silently drops bouncedAt/bounceCharges/bounceReason, corrupting the cheque register and any downstream reconciliation.
5. Why is the right fix not "add BOUNCED to the list"? — Because the true invariant is "only a PENDING cheque awaits an outcome; every non-PENDING status is terminal." Enumerating terminal states re-introduces the same omission risk for any future status. Guard on the live state (PENDING) instead.

## Hypothesis
Replacing the deny-list of terminal states with an allow-list of the single live state (PENDING) makes the guard correct for BOUNCED today and immune to the same omission for any future status. updateChequeStatus should reject any cheque whose current status is not 'PENDING'.

## Failing test
server/src/services/cheque.service.test.ts — "rejects updating a BOUNCED cheque" fails on current code (the update succeeds) and passes after the fix.
