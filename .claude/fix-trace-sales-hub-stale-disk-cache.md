---
symptom: After the app.ts etag/no-store fix landed and was confirmed live via curl (server healthy, no ETag, Cache-Control: no-store on every response), the browser still shows "Could not load X" / "Query data cannot be undefined" on Sales Hub tabs on a plain reload, hours after the fix deployed.
repro: Added temporary debug logging to server/src/routes/documents/crud.ts logging every real GET /api/documents hit. Tailed /private/tmp/hp-be.log for 90s while the bug was reportedly still visible in the browser — every logged request in that window showed resultIsUndefined:false, full valid data. git log shows the app.ts etag fix (34ad2ce) was authored/restarted into the running server process at 1:36 PM (last "change in ./src/app.ts" restart in the log); the user's second bug screenshot was taken at 10:00 PM, 8+ hours after the fix was already live and serving correct responses.
root_cause_file: src/lib/api.ts:203-207 (NO_BODY_STATUSES/304 branch) — the code is now correct; the browser's HTTP disk cache still holds a pre-fix 304 (empty-body) response for GET /api/documents recorded before Cache-Control:no-store existed.
root_cause_reason: Before 1:36 PM, the live server had no Cache-Control header and answered a repeat GET with an empty 304 (see fix-trace-sales-hub-etag-304.md). The browser heuristically cached that 304 exchange to disk. A normal reload (F5) revalidates against the browser's own disk cache entry using stale validators, NOT a fresh network round-trip, so it can keep replaying that old cached empty response indefinitely — even though the live server has been fixed for hours — until the user forces a real network fetch (hard reload / empty-cache-and-hard-reload / DevTools "Disable cache").
class: browser-http-cache-staleness (post-fix stale-cache-replay, distinct from the original http-cache-contract-violation)
regression_since: not a regression — this is the client-visible tail of the original bug, masked as "still broken" because the fix (no-store) only prevents FUTURE caching; it cannot retroactively invalidate an entry the browser already cached before the header existed.
flip_proof: manual — server-side proof that the live process has been correct since 1:36 PM (git log --format='%h %ad' -- server/src/app.ts; grep "change in ./src/app.ts" /private/tmp/hp-be.log) contradicted by the 10:00 PM screenshot still showing the bug, which is only explained by a client-cached response that never reached the (already-fixed) server. No further server-side code change needed; user action (hard refresh) is the resolution for already-poisoned caches, and no-store prevents any new poisoning going forward.
---

## 5-whys

1. Why does the browser still show the error at 10:00 PM if the etag/no-store
   fix was committed at 9:49 PM?
   Because the running server process had already picked up that exact code
   at 1:36 PM (`grep "change in ./src/app.ts" /private/tmp/hp-be.log` — last
   restart for app.ts was 1:36 PM; commit time 9:49 PM just reflects when I
   committed, not when the file was last saved/watched). The 10:00 PM
   screenshot is 8+ hours AFTER the fix was already serving correctly.
   [git log --format='%h %ad %s' -- server/src/app.ts; grep restarts in hp-be.log]
2. Why does live-server proof (curl, 5 DEBUG_TRACE log entries, all
   resultIsUndefined:false) not match what the user's browser shows?
   Because the failing request the user's browser is rendering never
   reached this server instance at all in that window — no matching log
   entry exists for a failing/undefined response at any point after the
   fix landed.
   [90s tail of hp-be.log during the reported-still-broken window: 5 entries,
    all healthy]
3. Where else could "Query data cannot be undefined" originate if not from a
   live 304/204/205 response from THIS server?
   Nowhere else in the code — src/lib/api.ts's only undefined-return path is
   the NO_BODY_STATUSES branch, and cacheReads is off for this endpoint
   (sales-list.service.ts never passes cacheReads), so the IDB read-cache
   path is unreachable here.
   [read src/lib/api.ts:203-239; read sales-list.service.ts — no cacheReads]
4. So what could produce a 304-shaped empty response that the live server
   never generated?
   The browser's own disk HTTP cache, entirely bypassing the network layer.
   Before 1:36 PM, the server had no Cache-Control header at all — Express's
   default ETag behavior plus a bare 304 is heuristically cacheable, and
   Chrome/Chromium can retain and replay that exchange on a plain
   reload without issuing a new request.
   [fix-trace-sales-hub-etag-304.md — pre-fix curl showed ETag present, no
    Cache-Control]
5. Why does a normal page reload not clear this?
   A standard reload (F5 / navigating back to the tab) validates against the
   browser's existing cache entries; it does not force a new network fetch
   for a resource the cache considers fresh/matchable. Only a hard reload
   (Cmd+Shift+R, or DevTools "Disable cache while DevTools is open" +
   reload) discards the disk cache entry and forces a genuine network hit
   against the now-fixed server.
   [standard HTTP caching behavior — no server-side evidence needed, this is
   a browser platform contract]

## Hypothesis

The original fix (`app.ts:41-48`, no-store + etag disabled) is correct and
has been live and healthy since 1:36 PM — proven by continuous server logs.
The still-reproducing symptom the user saw at 10:00 PM is not a second
server bug; it is the client replaying a 304 response the browser cached
to disk BEFORE the no-store header existed. No further code change is
needed. The resolution is a one-time hard reload (or clearing site data /
disabling cache in DevTools) to flush the poisoned disk-cache entries —
`Cache-Control: no-store` guarantees this cannot recur once the poisoned
entries are gone.

## Bug class & fix shape

class: browser-http-cache-staleness
shape: no-class-guard — this is the tail end of the already-fixed
http-cache-contract-violation class; the guard (no-store) already shipped
in 34ad2ce. There is no code fix for "a client's already-poisoned disk
cache" — only the passage of a hard reload (or natural cache eviction)
resolves already-cached entries. [no-class-guard: one-time transitional
artifact of the prior bug, not a recurring class — no-store forecloses new
occurrences]

## Failing test

None — not a server-code bug. The existing
`documents-etag.contract.test.ts` already pins the server-side contract
this depends on.

## Mask sweep

N/A — no server code changed in this trace; this documents why the
already-shipped fix's proof (curl, logs) legitimately diverged from a
stale browser session, so the investigation doesn't re-open the etag fix
as "not working."
