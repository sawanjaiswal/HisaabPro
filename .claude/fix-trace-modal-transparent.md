---
symptom: The logout confirmation renders see-through — the menu grid behind it reads straight through the dialog panel
root_cause_file: src/styles/components-overlay.css:2
root_cause_reason: `.modal` never declared a `background`; it inherited `background-color: canvas` from the UA stylesheet for native `<dialog>`. Commit 74fd421 ported Modal/ConfirmDialog to Radix, which portals plain `<div>`s — the UA rule stopped applying and nothing in app CSS replaced it.
---

## 5-whys

1. **Why is the logout dialog see-through?**
   The `.modal.confirm-dialog` element paints no background, so the menu
   drawer behind it composites through.

2. **Why does it paint no background?**
   Neither class that lands on the element declares one.
   `components-overlay.css:2` `.modal` sets border, radius, padding,
   max-width, width, box-shadow — no `background`. `.confirm-dialog`
   (line 29) sets only `max-width`. `.rx-dialog-content`
   (`overlay.css:248`) sets position/z-index/animation.

3. **Why did nobody notice a modal with no background?**
   Because for the whole life of the file it did not need one. `.modal`
   was applied to a native `<dialog>`, and the UA stylesheet gives
   `dialog { background-color: canvas }`. The opaque surface was a
   browser default the app silently depended on.

4. **Why did that default stop applying?**
   Commit `74fd421` ("converge overlay family on Radix") rewrote
   `Modal.tsx` and `ConfirmDialog.tsx` to render `RX.Content` — a
   portalled `<div>`, not a `<dialog>`. `<div>` has no UA background.
   The class name carried over; the element type did not.

5. **Why did the port not carry the background over?**
   The port's own comment (`overlay.css:232-235`) shows the author
   reasoned about exactly one UA dependency — "the legacy
   `.modal::backdrop` is inert on divs" — and re-implemented the scrim as
   `.rx-dialog-overlay`. The *second* UA dependency, the surface fill,
   was not enumerated. Porting away from a native element requires
   listing every UA rule relied upon, not the one that was noticed.

6. **Why did no gate catch a regression across 41 call sites?**
   Nothing asserts computed style. `tsc` and `enforce.js` are static;
   jsdom does not apply linked stylesheets. The only detector was a human
   opening a modal — which is why this survived from `74fd421` to today.

## Hypothesis

This is not a logout bug. `.modal` is the shared surface class for
`<Modal>` (2 call sites) and `<ConfirmDialog>` (41 call sites), so
**every modal and every destructive confirmation in the app is
transparent**. The logout dialog is simply the one opened over a dense,
high-contrast background (the full-screen menu grid), which is what made
it visible. Over a plain page the missing fill reads as "slightly odd
contrast" rather than an obvious defect.

Fix at the surface class, not at the logout call site.

## Second issue, same element — reachability

Raised in the same report: on a 425x748 viewport the confirm sits
centred, ~40% up the screen, far from the thumb. `<Drawer>`
(`drawer-panel.css:83-127`) already implements the house pattern —
bottom sheet under 768px, centred modal at or above it. `ConfirmDialog`
does not.

Not swapping ConfirmDialog to `<Drawer>`: Drawer is built on
`Dialog`, ConfirmDialog on `AlertDialog`. AlertDialog is what supplies
`role="alertdialog"`, focus landing on the confirm action, and refusal to
close on outside-click — the semantics a destructive action needs. The
correct move is to give ConfirmDialog the same *responsive geometry* as
Drawer while keeping AlertDialog semantics.

## Failing test

`src/components/ui/__tests__/overlay-surface.test.ts`

Honest scope: jsdom does not apply linked CSS, so a rendering assertion
is not available here. The test parses `components-overlay.css` and
asserts the shared surface class declares an explicit `background`.
That is a **regression guard on the stylesheet**, not proof of paint —
it fails today, passes after the fix, and would fail again if someone
deletes the declaration. Visual confirmation is the 425px screenshot.
