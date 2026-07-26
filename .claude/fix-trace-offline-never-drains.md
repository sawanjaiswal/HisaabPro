---
symptom: A mutation queued offline stays `pending` forever after the network returns — nothing replays it.
root_cause_file: src/hooks/useSyncQueue.ts:74
root_cause_reason: The only trigger for processQueue() was an offline→online *edge* observed inside a React component (SyncStatusIcon → useSyncQueue). The save-while-offline navigates, which unmounts that component, so the edge lands while nobody is listening; when it remounts, its prevOnlineRef initialises to the already-online value and no transition is ever seen again.
---

## Symptom

TC-PTY-11: fill `/parties/new` with the network off, save, turn the network
back on. The party never reaches the server. Instrumented run:

```
QUEUE while offline: [{"path":"/parties","status":"pending","errorMessage":null}]
t+3s … t+24s        [{"path":"/parties","status":"pending","errorMessage":null}]
```

`processQueue` was never entered — no attempt, no error, no retry count.

## 5-whys

1. **Why is the party missing after reconnect?** — the queue item is still
   `pending` and was never attempted (`errorMessage: null`, `retryCount: 0`).
2. **Why was it never attempted?** — `processQueue()` was never called. Proven
   by instrumenting its first line: no entry log across 24s online.
3. **Why was it never called?** — its single caller is
   `useSyncQueue`'s `useOnlineStatusWithCallbacks({ onOnline })`, and `onOnline`
   never fired.
4. **Why didn't `onOnline` fire?** — instrumenting `setGlobalOnline` shows the
   offline→online flip happening with `listeners1`: only `<OfflineBanner>` (the
   one app-level subscriber) was subscribed at that instant. Saving offline
   navigates `/parties/new → /parties`, which unmounts the old `<Header>` and
   with it `<SyncStatusIcon>`/`useSyncQueue`; the lazy route chunk for the new
   page then mounts *after* the flip. When it remounts, `prevOnlineRef` is
   seeded with the current (already `true`) value — `cbEffect:true:prevtrue` —
   so no transition is ever observed again.
5. **Why is a component allowed to own that trigger at all?** — the drain rule
   was written as edge-triggered ("when we come online") and hung off whatever
   component happened to display the queue. Every edge-triggered rule owned by
   an unmountable subscriber has the same hole: miss the edge once, miss it
   forever.

Root cause: the queue's drain condition is a *level* ("online AND work
pending"), but it was implemented as an *edge* observed by a component whose
lifetime is shorter than the queue's.

## Hypothesis

Move ownership of the trigger into the offline library itself
(`src/lib/offline.autosync.ts`), started once at boot and never unmounted, and
make it level-triggered: drain whenever the app is online and the queue holds
work — on start, on every online transition, and on every queue change. The
component keeps rendering the queue; it stops being responsible for draining it.
`useOnlineStatus` gains a non-React `subscribeOnlineStatus()` so the library can
observe the same dual-signal state without a React tree.

Level-triggering also closes the sibling hole: an item enqueued while the
heartbeat still reports "online" (a single failed request) had no edge coming at
all and would sit pending until the next real outage.

## Failing test

`src/lib/__tests__/offline-autosync.test.ts` — "drains a queue that is already
pending when auto-sync starts, with no online transition". Red before the change
(`processQueue` not called), green after. E2E: TC-PTY-11 in
`e2e/gold/parties-list.spec.ts`.

## Did I fix the symptom or the cause?

The cause. The symptom fix would have been a `processQueue()` call in
`useSyncQueue`'s mount effect — which still ties the app's headline offline
promise to one widget being on screen, and would silently break again the next
time a header is restructured. The library that owns the queue now owns the
drain.
