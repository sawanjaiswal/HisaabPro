**[04:06 PM]**

**Verdict: REVISE.** Your prompt contained the literal text `$(cat .agent_debate/offline_impl_diff.patch)`, so I read the patch file directly. I also read the working-tree files for the hooks, `calculateLocalLedger.ts` and `repository.utils.ts`. I could not run the server `tsc` (the command needed approval), so the syntax-error finding below comes from reading the file, not from a compiler.

## Blockers

1. **`sync.routes.ts` looks syntactically broken.** The `else if (entityType === 'PAYMENT') {` block (around line 196) is never closed. The `if (idempotencyKey)` log-write that follows sits inside it, and the braces are one short before `});`. If so, the whole push route fails to compile. Even once fixed, the idempotency write would only run for `PAYMENT`, because it is nested in that branch instead of sitting after the entity dispatch.

2. **`useLiveQuery` has a likely infinite refetch loop.** `data` was added to the `executeQuery` deps (`[enabled, data]`). The initial-load effect depends on `executeQuery`. So `setData` creates a new callback, which re-runs the effect, which refetches and sets new data, and so on. The `data` dependency was only needed for the throttle's early `return data`. Read it from a ref instead.
   - The throttle also uses `lastExecutionTimeRef` for every execution, not just focus-triggered ones. A mutation-triggered refetch therefore suppresses the next focus revalidation for 5s.
   - There is no unmount guard.

3. **Sub-1ms token indexing is dead code, so mandate #4 fails.**
   - `generateSearchTokens` has zero callers. Nothing writes `searchTokens` and nothing queries it.
   - Dexie v2 has no `.upgrade()` to backfill existing rows.
   - `barcode` was added to `LocalProduct` but not indexed, so barcode-scanner lookup is still a full scan.
   - This is exactly the "compiles but unreachable" case your global rules prohibit.

4. **Tenant and identity bugs in the sync push.**
   - `req.user!.id` is used for `createdBy` and `IdempotencyLog.userId`. Your memory note says the field is `req.user.userId`. An undefined value is dropped by Prisma, giving either a constraint failure or a wrong-user write.
   - `.catch(() => {})` on `idempotencyLog.create` inside a `$transaction` is wrong. A failed statement aborts the Postgres transaction (25P02), so the swallowed error just turns into a confusing commit failure.
   - `IdempotencyLog.key` is globally unique and looked up without user or business scope.

5. **"Full-fidelity" push for DOCUMENT and PAYMENT is not true.**
   - Document create sets `subtotal = grandTotal`.
   - It drops `lineItems`, tax, the document-number sequence and stock movements.
   - It does not update the party's outstanding balance or GL.
   - Payment create has no allocation or balance effect.
   - Document delete writes `status: 'DELETED'` directly.
   - None of this goes through the services that `POST /documents` and `POST /payments` use, so the server ledger will diverge from what the client computed.
   - There is also no per-entity Zod validation of `payload`.
   - With the REST dual-write gone, any server-side rejection (GST, unique phone, plan limits) happens after the user was shown success. It ends up in the DLQ with no user-visible signal.

## Other defects

- **Ledger (`calculateLocalLedger.ts`):**
  - `closingBalance` includes transactions dated after `to`, because `running` is updated before the `<= to` check.
  - `SALE_RETURN` matches `startsWith('SALE')` and is booked as a debit. It should be a credit.
  - `ESTIMATE` and `PROFORMA` count as receivables, and draft or cancelled statuses are not filtered.
  - The sort is by date string only, so same-day ordering is non-deterministic. Add a `createdAt` tiebreak.
  - It ignores the party's opening balance.
  - If a document's `paidAmount` and a payment record both exist, it can double-count.
  - There is no pagination, so `nextCursor` is always null.
  - The `usePartyLedger` fallback catches every error, including 401, 403 and 500. Fall back only on network failure, and show a "computed locally" indicator.
  - The integer-paise arithmetic itself is fine.

- **Hydration (`hasHydrated`):**
  - It starts as `true`, so the first render can flash the empty state before the effect runs.
  - It uses a dynamic import plus a one-shot `syncMeta.first()` that isn't scoped by `businessId`.
  - It is copy-pasted into `useParties` and `useInvoices`, which is drift by construction. Make it one shared `useHasHydrated` hook backed by a live query.
  - Fresh install plus offline shows a skeleton forever, with no timeout or offline state.
  - `if (local) return local` is correct for 0ms reads only if the background `getParties(filters)` result is actually merged into Dexie. The diff doesn't show that.

- **Dual-write elimination is incomplete:**
  - Party and product create, update and delete are done. `updateProduct` still falls back to `await api(...)` when the local row is missing.
  - Invoice update, delete and convert are untouched.
  - `entityVersion` (#150 optimistic lock) and `signal` were silently dropped.
  - The Dexie try/catch fallback was removed, so a quota or private-mode failure now hard-fails creates.

- **SSOT guard is weak.** The regex only matches `void api('/parties…`. It misses `await api(...)`, `.then`, and `/parties/${id}` paths if written differently. The `updateProduct` fallback in this very diff is an `await api('/products/...')` that the rule does not flag, so "0 leaks" is only true for this one literal shape.

- **Repository update paths:** `ProductRepository.update` enqueues the raw form `data` as the outbox payload and never refreshes `searchTokens` on rename.

## Counter-proposals

1. Fix the brace and move the idempotency log after the dispatch. Use `req.user.userId`, scope the key by `businessId`, and drop the `.catch`.
2. Have the sync handler call the same document and payment services as the REST routes, with a Zod schema per entity.
3. Fix `useLiveQuery` (ref for `data`, throttle only on focus, unmount guard) and add a test that counts `queryFn` calls.
4. Wire `generateSearchTokens` into the Party and Product repositories' create and update, add a Dexie `.upgrade()` backfill, index `barcode`, and query with `where('searchTokens').startsWith(...)`.
5. Fix the ledger: cap `closingBalance` at `to`, handle returns and non-posting document types, add a tiebreak, and fall back only on network errors. Add unit tests for these cases.
6. Make the SSOT regex catch any `api(` call whose first argument is a core-entity path outside `src/repositories` and `SyncManager`.

**[04:06 PM]**