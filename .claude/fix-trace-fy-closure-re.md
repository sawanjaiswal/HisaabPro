---
symptom: FY-closure (#99) throws "Retained Earnings account not found" on every freshly-seeded business
root_cause_file: server/src/services/fy-closure/close.ts:104
root_cause_reason: lookup filters on subType:'CAPITAL', but seedDefaultAccounts seeds Retained Earnings (code 3100) with subType:null, so findFirst never matches and closeFY throws before posting the closing entry
---
## 5-whys
1. Why does closeFY throw? — `retainedEarningsAccount` is null, hitting the `if (!retainedEarningsAccount) throw` guard at close.ts:109.
2. Why is it null? — `prisma.ledgerAccount.findFirst` with `where: { businessId, type:'EQUITY', subType:'CAPITAL', name~'Retained Earnings' }` matches no row.
3. Why does no row match? — the seeded Retained Earnings account (chart-of-accounts.ts:29) has `subType: null`, not `'CAPITAL'`. Only the Capital Account (code 3000) carries subType 'CAPITAL'.
4. Why did the lookup use subType:'CAPITAL'? — author assumed all EQUITY system accounts share the CAPITAL subType; they don't — Retained Earnings was deliberately seeded with subType null.
5. Why wasn't it caught? — no test exercises closeFY end-to-end against the real seeded chart of accounts; the bug only surfaces at runtime on a real (or correctly-mocked) business.

## Hypothesis
The account lookup should not filter by `subType` at all. The single source of truth for "which account is Retained Earnings" is the seed's stable, system-assigned `code: '3100'`. Resolving by `code:'3100'` (the canonical seeded RE account) matches both freshly-seeded and existing businesses with no data migration, and removes the false `subType:'CAPITAL'` predicate that excluded the real row.

## Failing test
server/src/services/fy-closure/__tests__/close.test.ts — mocks ledgerAccount.findFirst with seed-accurate matching semantics (an EQUITY account with code '3100', subType null). With the current subType:'CAPITAL' filter the mock returns null and closeFY throws; the test asserts closeFY succeeds and posts the closing entry to that account.
