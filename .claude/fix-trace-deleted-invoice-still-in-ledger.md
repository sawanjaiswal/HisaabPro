---
symptom: A deleted invoice keeps appearing on the customer's ledger statement (and every other reader that trusts the soft-delete filter).
root_cause_file: server/src/services/document/delete.ts:54
root_cause_reason: The delete writes `status: 'DELETED'` but never `isDeleted: true`, so the row stays visible to the soft-delete extension that Document is registered with — two flags for one fact, and readers split between them.
---
## 5-whys
1. Why is a deleted invoice still on the statement? `getPartyLedger` queries documents with `isDeleted: false` and the row matches.
2. Why does the row still have `isDeleted: false`? `deleteDocument` sets `status`, `deletedAt`, `deletedBy` and `permanentDeleteAt` — never `isDeleted`.
3. Why does that matter beyond the ledger? `Document` is in `SOFT_DELETE_MODELS`, so the Prisma extension auto-injects `isDeleted: false` into every read. A deleted document is therefore invisible to nothing.
4. Why did the document list still hide it? The document reads carry their own `status: { not: 'DELETED' }` predicate. Every reader that does *not* — ledger, public invoice view, share links, GST backfill, quota counts — sees the deleted row.
5. Why did two flags exist? The recycle bin was built around a `status` value and did not adopt the soft-delete registry, which is the SSOT for "this model is soft-deleted". Nothing forced the two to agree.

## Hypothesis
Make `isDeleted` the fact and `status: 'DELETED'` the recycle-bin state that rides along with it: set `isDeleted: true` on delete and back to `false` on restore, and give the five recycle-bin queries the explicit `isDeleted: true` the extension documents as its bypass. Every reader that trusts the registry then hides deleted documents without needing to know the recycle bin exists.

## Failing test
e2e/gold/invoices-lifecycle.spec.ts (TC-INV-07 — "a deleted invoice must stop billing the customer"; failed with the invoice still on the ledger)
