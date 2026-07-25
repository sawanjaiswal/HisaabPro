---
symptom: When a lazily-imported floating widget fails to load, the whole app is replaced by "Something went wrong" — bottom nav, page content and toasts all disappear.
root_cause_file: src/app.guards.tsx:104
root_cause_reason: FloatingWidgets renders its lazy children under a bare <Suspense> with no ErrorBoundary, so a failed dynamic import propagates to the single app-level ErrorBoundary in App.tsx:73 and unmounts the entire tree.
---

## Symptom

`e2e/gold/shell.spec.ts` TC-SHELL-06b logs in, goes offline, and tries to use
the bottom nav. The screenshot shows the whole viewport replaced by:

```
Something went wrong
Failed to fetch dynamically imported module:
http://localhost:5002/src/features/settings/CalculatorOverlay…
```

No nav, no page, no toasts — the click target was detached from the DOM.

## 5-whys

1. **Why did the nav disappear?** The app-level `ErrorBoundary` (App.tsx:73)
   caught an error and rendered its fallback in place of its children — which
   are the routes, `PersistentNav`, `FloatingWidgets`, `SideNav`,
   `ToastContainer` and `SWUpdatePrompt`. Everything.
2. **Why did the error reach that boundary?** Nothing between the throw and the
   root catches it.
3. **Why not?** `FloatingWidgets` wraps each lazy widget in `<Suspense
   fallback={null}>` only. Suspense handles the *pending* state of a dynamic
   import; it does not handle the *rejected* state. A rejected import re-throws
   on render and travels to the nearest error boundary.
4. **Why does the import reject?** In this case the network was cut, so the dev
   server could not serve the chunk. In production the same rejection happens
   whenever a chunk 404s — the standard case being a user on a stale tab after a
   deploy, where the previously-hashed chunk no longer exists on the CDN.
5. **Why is that a defect and not just "offline is offline"?** Because the two
   widgets involved are optional decoration (a calculator overlay and a feedback
   button). Their failure has no bearing on billing, and it must not be able to
   take the navigation away from a user mid-invoice. Route content already
   degrades correctly — `PageRoute` gives every route its own ErrorBoundary, so
   a failed *page* chunk shows an error in the content area with the nav intact.
   The floating widgets simply never got the same treatment.

Root cause: an optional, lazily-loaded overlay shares the application's
outermost error boundary.

## Hypothesis

Wrapping the floating widgets in their own `ErrorBoundary` with a `null`
fallback contains the failure to the widget: the overlay silently does not
appear, the shell and nav stay mounted, and the user keeps working. Nothing else
changes — `PageRoute` already isolates route chunks the same way.

## Failing test

- `e2e/gold/shell.spec.ts` TC-SHELL-06b — offline mid-session, the bottom nav
  must survive and stay clickable.
