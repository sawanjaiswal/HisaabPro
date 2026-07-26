---
symptom: Committing any import returns 500 DATABASE_ERROR and writes nothing — no party, product or invoice a shop imports is ever created
root_cause_file: server/src/services/import/commit.helpers.ts:60
root_cause_reason: the commit transaction's first statement calls pg_advisory_xact_lock with two bigint arguments, a signature Postgres does not have (it has (bigint) and (int4,int4)), so the transaction aborts with 42883 before a single row is written
---

## 5-whys

1. Why does `POST /imports/:id/commit` answer 500? — Prisma raised P2010 with Postgres code
   `42883`: `function pg_advisory_xact_lock(bigint, bigint) does not exist`.
2. Why is that function missing? — Postgres ships two overloads: `pg_advisory_xact_lock(bigint)` and
   `pg_advisory_xact_lock(int4, int4)`. The two-key form is int4-only.
3. Why does the code pass two bigints then? — S7 replaced `hashtext` (int4) with `hashtextextended`
   (bigint) to stop key collisions at ~77k businesses, and applied it to BOTH arguments — namespace
   and businessId — without re-checking that the widened pair still resolves to a real signature.
4. Why did nothing catch it? — `acquireBusinessLock` is only exercised by unit tests where `tx` is a
   mock and `$executeRaw` is a `vi.fn()`. A mock accepts any SQL string; only a live server resolves
   an overload.
5. Why did no one hit it by using the product? — `FEATURE_DATA_IMPORT` defaults OFF, so the commit
   path has never run outside tests. The feature would have 500'd on its first real user.

## Hypothesis

The namespace does not need to be a separate lock argument. Folding it into the hashed text —
`hashtextextended('import-commit:' || businessId, 0)` — keeps the full 64-bit key width S7 wanted,
keeps import-commit keys disjoint from every other subsystem's, and uses the single-argument
signature Postgres actually has. One call site; no other advisory lock in the server passes two
bigints (loyalty uses `(int,int)`, subscription and the notification drain already use the bigint
form).

## Failing test

server/src/__tests__/integration/import-commit-lock.contract.test.ts — runs `acquireBusinessLock`
inside a real `prisma.$transaction` against live Postgres and asserts an advisory lock is held.
Fails with 42883 before the fix. e2e/gold/import.spec.ts TC-IMP-01 covers it end to end.

## Did I fix the symptom or the cause?

The cause. The symptom was a 500 on commit; the fix is at the one place the lock key is built, and
the new test runs the real statement against a real server, which is the only arrangement that can
catch an unresolvable overload.
