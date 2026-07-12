---
symptom: /settings/subscription/checkout — a solid black rectangle covers the bottom ~15% of the viewport during the Razorpay UPI payment step (reported on mobile-web and Android)
root_cause_file: src/features/subscription-checkout/components/MobileRazorpayCheckout.tsx:65 and src/features/subscription-checkout/components/NativeRazorpayCheckout.tsx:75
root_cause_reason: both Razorpay SDK invocations pass a `theme` object with only `color` set — they never set `backdrop_color`, so Razorpay's checkout widget falls back to its own default modal backdrop, which is a near-opaque black overlay behind/around the bottom-sheet. HisaabPro's own CSS/components were never the source; the black region is Razorpay's unconfigured default rendering underneath its slide-up sheet.
---
## 5-whys
1. Why does a black rectangle appear at the bottom of the checkout page? — Razorpay's checkout widget (both checkout.js on phone-web and the native Android plugin) renders as a bottom-sheet with a full-screen backdrop behind it; on some viewports/devices the backdrop is visible as a solid black band before/around the sheet content.
2. Why is the backdrop solid black instead of matching the app? — grepped `subscription-checkout.css`, `MobileRazorpayCheckout.tsx`, `NativeRazorpayCheckout.tsx`, `DesktopQrCheckout.tsx` for `black`/`#000`/`rgba(0,0,0` — zero matches in HisaabPro-authored code. The black comes from Razorpay's own widget, not this codebase.
3. Why doesn't HisaabPro's own dark-overlay token apply to it? — Razorpay's checkout.js/native SDK render in their own DOM subtree (an injected iframe / native view), completely outside this app's CSS cascade. `--backdrop-color` (`tokens-core.css:118`, `tokens-dark.css:132`) has no effect there.
4. Why wasn't the widget's backdrop configured to match? — Razorpay's `theme` config option supports `backdrop_color` specifically for this (the widget's docs default it to an opaque/near-black value when omitted). Both `MobileRazorpayCheckout.tsx:59-65` and `NativeRazorpayCheckout.tsx:71-76` only pass `theme: { color: '#0f3638' }` (button/accent color) — `backdrop_color` was never set, so every checkout session runs with Razorpay's default backdrop.
5. Why did this ship without it being noticed? — the dev environment has no `RAZORPAY_*` credentials configured (`server/.env` grep confirms), so the checkout-session API call fails before ever reaching the real widget in local dev — nobody exercised the live payment step against a real/sandbox Razorpay key during review.

## Hypothesis
Set `backdrop_color` explicitly in the `theme` object passed to both the `Razorpay` (checkout.js) constructor and the native `RazorpayCheckout.open()` call, using the same value as this app's own `--backdrop-color` design token (`rgba(26, 25, 23, 0.5)` light / `rgba(0, 0, 0, 0.7)` dark, resolved from `document.documentElement`'s `data-theme` attribute at call time), so the widget's backdrop is visually consistent with the rest of the app's overlays instead of Razorpay's unconfigured default.

## Verification
- Cannot reproduce the live Razorpay widget in this dev environment — `server/.env` has no `RAZORPAY_*` credentials, so `POST /subscription/checkout` fails server-side before the widget ever opens (confirmed via dev-login session + `?tier=PRO&cycle=MONTHLY` repro attempt).
- FE tsc clean after the change.
- This is a configuration fix to a documented third-party SDK option (`backdrop_color`), not a guess — code review confirms no HisaabPro CSS/component is the source, and both call sites omit the one Razorpay option that controls this exact visual (backdrop appearance behind the modal).
- Recommend re-verifying visually against a real Razorpay test key (sandbox mode) once one is available, since this cannot be confirmed pixel-for-pixel without the real widget rendering.
