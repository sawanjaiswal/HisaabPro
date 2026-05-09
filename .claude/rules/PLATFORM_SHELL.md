# Platform Shell — Invariants

> Android 15+ (and iOS) mandate edge-to-edge: the WebView spans the full
> screen, including the status bar and gesture/3-button nav. We work *with*
> that, not against it. Capacitor injects `--safe-area-inset-{top,right,
> bottom,left}` CSS variables on `viewport-fit=cover`, and **platform
> primitives** (header, BottomNav, drawers, side-nav) pad themselves by
> those insets. Feature code lives *between* the padded primitives and never
> references the insets. The user-visible result is identical to "WebView in
> safe rect" — but it survives Android 15, iOS Dynamic Island, keyboard
> open, gesture-bar mode changes, and rotation.

This is enforced mechanically by `scripts/enforce.js` (checks 9, 10, 11, 12).
If a check fires, fix the root cause; never add an exception.

---

## Mental model

```
┌─────────────────────────┐  ← phone display
│  Status bar             │  ← OS-owned, transparent, dark icons
├─────────────────────────┤  ← app header pads top by --safe-area-inset-top
│  Header (sticky)        │
├─────────────────────────┤
│                         │
│   Feature page content  │  ← never sees insets; lives between primitives
│                         │
├─────────────────────────┤
│  BottomNav              │  ← pads bottom by --safe-area-inset-bottom
├─────────────────────────┤  ← OS gesture pill / 3-button nav
│  Nav bar                │  ← OS-owned, transparent, dark icons
└─────────────────────────┘
```

The WebView itself is full-screen (edge-to-edge). The "safe rectangle" is
created at the user-visible layer by primitives padding themselves.

---

## C1 — `viewport-fit=cover`

`index.html` MUST use `<meta name="viewport" ... viewport-fit=cover>`.
Capacitor's `SystemBars.java` only injects `--safe-area-inset-*` CSS variables
when this string is present (line 47, function `capacitorSystemBarsCheckMetaViewport`).
`viewport-fit=auto` silently breaks every primitive's safe-area padding.

## C2 — Capacitor 8 native edge-to-edge, no custom shims

`capacitor.config.ts` MUST NOT set fictional options like
`adjustMarginsForEdgeToEdge` (does not exist in Capacitor 8.2.0). Let the
default behaviour run. Plugins block: `Keyboard.resize: 'native'` + `resizeOnFullScreen: false`,
plus Splash + BarcodeScanning.

## C3 — Plain `BridgeActivity`

`MainActivity.java` MUST be a plain `BridgeActivity` with no `WindowCompat`
calls, no `EdgeToEdge.enable(this)`, no manual inset listeners. Configuration
is theme-only.

**Enforced:** check 11 — bans `setStatusBarColor` / `setNavigationBarColor` /
`setDecorFitsSystemWindows` in any `*.java` / `*.kt` under
`android/app/src/main/java/`.

## C4 — Transparent system bars + light icons

`android/app/src/main/res/values/styles.xml` `AppTheme.NoActionBar` MUST set:

- `android:windowLightStatusBar = true`        (dark icons on cream)
- `android:windowLightNavigationBar = true`    (dark icons on cream)
- `android:statusBarColor = @android:color/transparent`
- `android:navigationBarColor = @android:color/transparent`

Transparent bars let the cream gradient bleed under the OS chrome — there
is no visible seam between app and OS. Do NOT set `fitsSystemWindows`,
`windowDrawsSystemBarBackgrounds`, `windowTranslucentNavigation`, or any
Android 15-deprecated bar APIs.

## C5 — Safe-area access is primitive-only

Allowed:
- `var(--safe-area-inset-top)`     in header / drawer-top primitives
- `var(--safe-area-inset-bottom)`  in BottomNav, drawer footer, side-nav footer
- `var(--safe-area-inset-left)` / `right`  in any primitive

Banned everywhere:
- `env(safe-area-inset-*)` — Capacitor injects `var(--safe-area-inset-*)` on
  Android. The native CSS `env()` form is iOS-only and yields `0` on Android,
  causing silent breakage.

Banned in feature code:
- `var(--safe-area-inset-*)` — feature pages consume already-padded primitives.
  If a feature needs bottom padding, it consumes `<BottomActionBar>` /
  `<Drawer>` (which already inset themselves), or it pads against
  `--bottom-nav-height` (the height token already includes the inset).

**Enforced:** check 9 — primitive allowlist lives in `scripts/enforce.js`.

## C6 — Fixed-bottom is a primitive responsibility

Only platform primitives own `position: fixed; bottom: 0`:

- `src/components/layout/BottomNav.css`
- `src/components/ui/drawer-panel.css` / `drawer-content.css`
- `src/components/ui/bulk-action-bar.css` *(temporary — Phase 3 migrates to BottomActionBar)*
- `src/components/feedback/sw-update-prompt.css` / `feedback-widget.css`
- `src/styles/components-*.css`
- `src/features/landing/**`

Feature pages that need a sticky bottom action bar consume `<Drawer>` (with
footer) or — once Phase 3 lands — `<BottomActionBar>`. Raw fixed-bottom in
feature CSS duplicates the pattern, escapes design review, and accumulates
inconsistencies between drawers.

**Enforced:** check 10. Phase 3 debt list lives in `scripts/enforce.js`
(`FIXED_BOTTOM_PHASE3_DEBT`).

## C7 — `@capacitor-community/safe-area` MUST NOT be installed

Capacitor 8 already injects `--safe-area-inset-*` natively when
`viewport-fit=cover` is set. The community plugin duplicates that work and
adds a second source of truth — they will diverge. Keep `package.json` clean.

## C8 — Keyboard resize: `native`, not fullscreen

`Keyboard.resize: 'native'` shrinks the WebView when the keyboard appears so
forms stay visible. `resizeOnFullScreen: false` keeps the OS bars in place
during keyboard-up — switching to fullscreen would mean the WebView briefly
takes the status bar area, breaking C4.

## C9 — `--bottom-nav-height` is the SSOT for bottom-page-padding

Page bodies that need to clear the BottomNav (almost all of them) use:

```css
.page-content {
  padding-bottom: var(--bottom-nav-height);
}
```

`--bottom-nav-height = 112px + var(--bottom-nav-safe-inset)`, where
`--bottom-nav-safe-inset = var(--safe-area-inset-bottom, 0px)`. This is the
*only* place the inset is added to page-padding math. Feature code never
adds `+ var(--safe-area-inset-bottom)` itself.

A primitive that floats *above* the BottomNav (toast, FAB, sticky CTA)
positions itself with `bottom: calc(var(--bottom-nav-height) + <gap>)` —
NOT a hardcoded pixel offset. Hardcoding (`bottom: 72px`) ignores both the
FAB overhang and the safe-area inset, and on edge-to-edge Android renders
the floating element partially behind the BottomNav.

## C10 — `--header-height` is the SSOT for top-page-offset

Mirror of C9. `--header-height = 56px + var(--header-safe-inset)`, where
`--header-safe-inset = var(--safe-area-inset-top, 0px)`.

The base `.header` primitive consumes `--header-safe-inset` as its
`padding-top` and `--header-height` as its `min-height`. All header
variants (`.header--scroll-condense`, `.header--center`, etc.) inherit
these — variants own *layout*, not *inset math*.

A sticky bar that sits *below* the app header (filter strip, tab bar
under a list page) uses `top: var(--header-height)` — NOT `top: 0`.
`top: 0` puts the bar under the OS status bar on edge-to-edge Android.

**Enforced:** check 12 — bans `position: sticky|fixed; top: 0` outside
the platform-primitive allowlist. Phase 4 debt list lives in
`scripts/enforce.js` (`FIXED_TOP_PHASE4_DEBT`) for known feature-level
custom headers being migrated to `<Header>`.

## C11 — `overscroll-behavior: none` on the document scroller

`html` and `body` set `overscroll-behavior: none` (`src/styles/base.css`).

Without this, Chromium WebView lets the user pull the page past the top
or bottom scroll bound. The rubber-band animation translates the whole
viewport — including the sticky header and the fixed BottomNav — past
the OS bars for a moment before snapping back. The result looks like
the platform-shell math is wrong, but it's the scroller's elastic
behaviour leaking through. The single rule pins the scroller to its
bounds and also disables pull-to-refresh (which a billing app should
never invoke).

Set on BOTH `html` and `body` so neither end of the propagation chain
leaks. Internal scroll containers (drawers, virtualized lists) keep
their own `overscroll-behavior: contain` where appropriate.

---

## When the model breaks

If the user reports content under the OS chrome:

1. **Check `index.html` line 5** — `viewport-fit=cover` must be present.
2. **Check `cap sync` ran** after `capacitor.config.ts` edits.
3. **Check the device theme** isn't a 3rd-party launcher with custom inset behaviour.
4. **Check the activity** is `AppTheme.NoActionBar` in `AndroidManifest.xml`.
5. **Inspect `--safe-area-inset-bottom`** in WebView devtools — should be a
   non-zero pixel value when running on a phone with a gesture pill / 3-button nav.
6. If it IS non-zero but the BottomNav still touches the OS chrome, the
   primitive's CSS lost its `padding-bottom: var(--safe-area-inset-bottom)` —
   restore it.

## Adding iOS later

When `npx cap add ios` is run:

1. iOS WebView reads `env(safe-area-inset-*)` natively. Capacitor's iOS plugin
   ALSO injects `--safe-area-inset-*` so the same primitive CSS works on both
   platforms with no fork.
2. Verify on iPhone with Dynamic Island: header sits below the island, BottomNav
   sits above the home indicator.

If iOS shows a gap (Capacitor not injecting on iOS for some reason), the
fallback would be to allow `env(safe-area-inset-*)` in primitives only —
which is a 2-line change to enforce.js. Don't pre-build for that case.
