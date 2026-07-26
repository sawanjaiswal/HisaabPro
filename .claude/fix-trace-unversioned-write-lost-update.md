---
symptom: A save made from a stale copy is accepted, silently discarding another user's change.
root_cause_file: server/src/lib/optimistic-lock.ts:57
root_cause_reason: The version increment lives inside the version guard, so a write that sends no X-Entity-Version changes the row without advancing its version — the next stale save then matches and wins.
---

## 5-whys

1. A user edits a party, someone else saves first, and the first user's save
   still succeeds — the other change is gone with no conflict shown. But why?
2. `bumpVersionOrConflict` found the row still sitting at the version the first
   user's client is holding, so there was nothing to conflict with. But why is
   the row still at that version after another write landed on it?
3. Because that other write sent no `X-Entity-Version` header. But why does that
   leave the version untouched?
4. Because `bumpVersionOrConflict` returns early on
   `expectedVersion === undefined` — and the `version: { increment: 1 }` it
   would otherwise run is inside the guarded `updateMany`. But why is the
   increment inside the guard?
5. Because the helper conflates two different jobs: *checking that nobody else
   moved the row* (optional — a client that sends no version has opted out) and
   *recording that the row moved* (never optional — it is what every other
   client's check reads). Making both conditional on the header means a client
   that opts out of the lock also disables it for everyone else.

Who writes without the header, today, in this app: the offline queue's replay
path (`src/lib/offline.processor.ts` builds its headers without `entityVersion`),
the bulk importers, and every server-to-server caller. So the hole is not
hypothetical — it is exactly the reconnect flow Suite O exercises.

## Hypothesis

`version` must be a row-revision counter maintained by every writer, not a
by-product of the guard. When `expectedVersion` is undefined the helper should
still increment the row's version (scoped to `id + businessId`) and simply skip
the conditional part. Then a guarded save from a stale copy finds the version
advanced and 409s, whichever kind of client made the earlier write.

## Failing test

server/src/__tests__/integration/optimistic-lock.contract.test.ts
