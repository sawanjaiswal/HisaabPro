---
symptom: HisaabPro local dev "works then stops working after some time"
root_cause_file: vite.config.ts:96 (+ server/src/index.ts:44)
root_cause_reason: Vite dev server has no strictPort, so a port collision silently
  moves the live server to another port while the browser tab stays pinned to 5002;
  the API listen has no EADDRINUSE guard so a stale process lingers half-bound.
---

## 5-whys
1. Why does the app stop working? → The tab at http://localhost:5002 is no longer
   served by the live dev server, and/or every /api call returns 502 BACKEND_DOWN.
2. Why isn't the live server on 5002? → Vite silently moved to 5003 because 5002
   was still held by a stale/orphaned previous dev process.
3. Why did Vite move instead of failing loudly? → vite.config.ts sets no
   `strictPort`; Vite's default is `strictPort: false` → auto-increment.
4. Why was 5002 still held? → A prior `npm run dev` / `dev:all` child didn't release
   the socket before restart (common with `concurrently -k` + HMR restarts / macOS
   TIME_WAIT). Same for the API on 5001 under `tsx watch` respawns.
5. Why does that break the user? → Their tab / Capacitor / bookmark is pinned to
   5002; the new server on 5003 is invisible, and a half-bound API on 5001 answers
   with 502. Result: "worked, then died after a while."

## Root cause
Missing `strictPort: true` on the Vite dev server, plus no `EADDRINUSE` handler on
`app.listen()`. Port collisions resolve silently to a different / half-dead port
instead of failing fast. Every OTHER project on this machine already pins its port
(DudhHisaab admin 4000 / frontend 4002 strict, flint 6100, Rent-Income 6002) — HP
was the lone exception.

## Machine port map (no cross-project clash)
| Project     | web/frontend | admin | api/server |
|-------------|--------------|-------|------------|
| HisaabPro   | 5002 (now strict) | —  | 5001       |
| DudhHisaab  | 4002 (strict)     | 4000 (strict) | 4001 |
| flint       | 6100              | —  | —          |
| Rent-Income | 6002              | —  | ts-node-dev |

HP's 5001/5002 collide with nothing above → the fix is to make HP *fail loudly*
on a self-collision (stale HP process), not to move any port.

## Failing test (manual repro — port binding isn't unit-testable)
1. `npm run dev:web` → serves 5002.
2. In another shell, `npm run dev:web` again.
   - BEFORE: second server silently binds 5003; tab on 5002 shows the dead one.
   - AFTER: second server exits immediately with a clear "Port 5002 is already in
     use" message → the collision is visible, not silent.
3. `PORT=5001 node -e "require('net').createServer().listen(5001)"` then start the
   API → BEFORE: unhandled EADDRINUSE / half-bound; AFTER: logs a clear fatal +
   exits(1).

## Fix
1. `vite.config.ts` server: add `strictPort: true`.
2. `server/src/index.ts`: attach `.on('error')` to the http server; on `EADDRINUSE`
   log a clear fatal and `process.exit(1)` so tsx-watch respawn surfaces it and no
   half-bound process lingers.
