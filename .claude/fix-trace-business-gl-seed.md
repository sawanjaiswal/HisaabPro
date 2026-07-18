---
symptom: A newly-created business cannot save its first invoice — POST /documents 400s with "GL posting: required system account(s) 1200, 4000, 5050, 1300 missing for this business"
root_cause_file: server/src/services/business.service.ts:102
root_cause_reason: createBusiness seeds categories, roles, and vertical defaults but never seeds the default chart of accounts, so GL auto-posting on the first invoice has no accounts to post to
---

## 5-whys
1. Why does the first invoice 400? — Document GL posting (account-resolver) can't find system accounts 1200/1300/4000/5050.
2. Why are those accounts missing? — The business has no LedgerAccount rows at all.
3. Why no LedgerAccount rows? — createBusiness never called seedDefaultAccounts.
4. Why not? — GL auto-posting (S1) was added after createBusiness was written; seeding was only wired to the on-demand POST /accounting/accounts/seed route and the backfill script, not to business creation.
5. Why wasn't it caught? — No test drives createBusiness → createDocument end to end; existing dev/test businesses were seeded manually or predate S1 posting.

## Hypothesis
createBusiness must seed the default chart of accounts for every new business (idempotent seedDefaultAccounts), alongside ensureSystemRoles and applyVerticalDefaults, so GL posting on the first invoice always resolves its system accounts.

## Failing test
server/src/services/__tests__/business-gl-seed.test.ts — create a business, then assert the required system account codes (1200, 1300, 4000, 5050) exist for it.
