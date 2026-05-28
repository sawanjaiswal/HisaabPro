---
status: approved
feature: razorpay-upi-crossplatform
created: 2026-05-28T09:32:00Z
session: bare-091634
proposer: claude
high_risk_paths_touched:
  - server/src/services/subscription/checkout-session.service.ts
  - server/src/routes/subscription.ts
  - server/src/lib/env.ts
files_planned:
  # ── Backend ──
  - server/src/services/subscription/checkout-session.service.ts   # +razorpayKeyId; resolve couponCode→razorpayOfferId; yearly-missing→503
  - server/src/routes/subscription.ts                              # surface keyId; add GET /subscription/checkout/status (req.user.businessId)
  - server/src/lib/env.ts                                          # yearly plan-id presence helper
  - server/src/schemas/subscription.schemas.ts                     # extend checkout response shape (if schema exists)
  # ── Frontend (6-layer, ≤250L each) ──
  - src/features/subscription-checkout/subscription-checkout.types.ts
  - src/features/subscription-checkout/subscription-checkout.constants.ts
  - src/features/subscription-checkout/utils/checkout-js-loader.ts
  - src/features/subscription-checkout/utils/checkout-status.utils.ts
  - src/features/subscription-checkout/hooks/useCheckoutDevice.ts
  - src/features/subscription-checkout/hooks/useCheckoutSession.ts          # create-session + phase machine
  - src/features/subscription-checkout/hooks/useCheckoutStatusPoll.ts       # poll loop + watchdog/timeout
  - src/features/subscription-checkout/components/MobileRazorpayCheckout.tsx # checkout.js widget (phone browser/PWA)
  - src/features/subscription-checkout/components/NativeRazorpayCheckout.tsx # capacitor-razorpay native SDK (Android)
  - src/features/subscription-checkout/components/DesktopQrCheckout.tsx      # QRCodeSVG from qrcode.react
  - src/features/subscription-checkout/components/CheckoutStatusView.tsx
  - src/features/subscription-checkout/SubscriptionCheckoutPage.tsx          # thin render-switch, ≤200L
  - src/features/subscription-checkout/subscription-checkout.css
  - src/features/subscription/UpgradeDrawer.tsx                    # CTA → navigate to checkout route
  - src/App.tsx                                                    # register /settings/subscription/checkout route
  - src/lib/translations.en.ext45.ts                              # new EN key file for this feature
  - src/lib/translations.hi.ext45.ts                              # new HI key file (parity)
  - index.html                                                    # add tight CSP <meta http-equiv>
  - package.json                                                  # add capacitor-razorpay@^1.3.0
  # ── Docs / critique artifacts ──
  - docs/EPIC_razorpay-upi-crossplatform/**
agents_invoked:
  - architecture-auditor (output: docs/EPIC_razorpay-upi-crossplatform/architecture-critique.md, verdict: PASS)
  - security             (output: docs/EPIC_razorpay-upi-crossplatform/security-critique.md, verdict: PASS)
critique_history:
  - ts: 2026-05-28T09:19:00Z
    critic: architecture-auditor
    verdict: REVISE
    revision: 1
    findings: 4 MUST_FIX (Android mechanism disproven), 7 SHOULD_FIX
  - ts: 2026-05-28T09:19:00Z
    critic: security
    verdict: BLOCK
    revision: 1
    findings: 1 MUST_FIX (couponCode→offer_id money-out), 3 SHOULD_FIX
  - ts: 2026-05-28T09:33:00Z
    critic: architecture-auditor
    verdict: PASS
    revision: 2
    findings: all 4 MUST_FIX + 7 SHOULD_FIX resolved; 1 new SHOULD_FIX (port-time VITE key wiring), non-blocking
  - ts: 2026-05-28T09:33:00Z
    critic: security
    verdict: PASS
    revision: 2
    findings: MF-1 money-out closed (server-resolved offer_id); SF-1/SF-2/SF-3 resolved
acceptance:
  backend:
    - tsc clean (server)
    - "curl POST /subscription/checkout → 201 with {razorpaySubscriptionId, checkoutUrl, razorpayKeyId, planTier, amountPaise}"
    - "curl POST /subscription/checkout unauth → 401"
    - "curl POST /subscription/checkout FREE tier → 400; missing monthly OR yearly plan-id env → 503 (no silent monthly charge)"
    - "curl POST /subscription/checkout with unknown/expired couponCode → coupon dropped (no offer_id forwarded); never forwards raw input as offer_id"
    - "GET /subscription/checkout/status → {subscriptionState, planTier}, scoped to req.user.businessId; cross-tenant id in URL ignored"
  frontend:
    - "screenshots: loading · error · empty · success · 320px (checkout page, all three surfaces)"
    - "device picker: phone-browser → checkout.js widget; Android(Capacitor) → native plugin; desktop → QR"
    - console clean
    - "Android device test: native plugin launches GPay/PhonePe/Paytm UPI intent (real device or documented in PR)"
approver: sawanjaiswal
approved_at: 2026-05-28T04:15:07.865Z

---

# Razorpay cross-platform UPI checkout — Plan (rev 2)

## 1. Goal & scope

Port DudhHisaab's **working** cross-platform UPI checkout into HisaabPro. The
backend (razorpay.service, webhook→FSM writer, entitlement JWT) is already
ported and hardened. The gap is the **frontend checkout surface** and the
**Android native UPI handoff**.

**rev 2 correction (arch M1/M2, user decision):** the previous draft proposed a
`WebViewClient.shouldOverrideUrlLoading` hook to intercept `upi://` inside the
Capacitor WebView. DH's own code disproves this: Razorpay's Checkout.js detects
the `; wv)` UA token and **disables UPI Intent entirely** inside any WebView, so
it never emits a `upi://` URL for the hook to intercept. HP also bundles its
webview (no `server.url`), so it cannot replicate DH's hosted-webview trick.
The only proven Android path — and the user's chosen approach ("Native Razorpay
plugin, DH parity") — is the **native `capacitor-razorpay@^1.3.0` SDK plugin**,
which launches the Android UPI Intent API directly, bypassing the WebView
restriction. The WebViewClient mechanism is dropped entirely.

**In scope:** three checkout surfaces (phone-browser checkout.js widget · Android
native plugin · desktop QR), device picker, sync-verify + status poll + dismissal
watchdog, `razorpayKeyId` in checkout response, server-side coupon resolution,
yearly plan-id env validation, tight FE CSP.

**Out of scope (FUTURE_EPIC):** iOS checkout; coupon/offer *UX* beyond resolving
an entered code; cold-start checkout resume (`useCheckoutResume`); subscription
management redesign (UpgradeDrawer stays, only its CTA target changes).

## 2. The three surfaces (DH model, verified)

| Surface | Audience | Mechanism |
|---|---|---|
| **phone-web** | phone browser, PWA (NOT Capacitor) | checkout.js widget; mobile Chrome emits `upi://` natively → GPay/PhonePe/Paytm |
| **android-native** | Capacitor Android WebView | **`capacitor-razorpay` native SDK** (`registerPlugin('Checkout')`). Forwards `{key, subscription_id, prefill, theme}` to Razorpay's native Android Checkout activity → real UPI Intent. No WebView UPI restriction. |
| **desktop-web** | tablet / laptop / desktop | QR-only — render `checkoutUrl` (rzp.io short_url) as a QR via `QRCodeSVG` (`qrcode.react@^4.2.0`, already a dep); user scans with phone |

`useCheckoutDevice` SSOT:
1. `Capacitor.isNativePlatform() && getPlatform()==='android'` → **android-native**
2. else `matchMedia('(max-width:768px) and (pointer:coarse)')` → **phone-web**
3. else → **desktop-web**

**Android needs NO native code in `MainActivity.java`.** `capacitor-razorpay` is a
standard Capacitor plugin; `npx cap sync` auto-registers it via plugin discovery
(import `com.ionicframework.capacitor.Checkout`). MainActivity stays the 6-line
config-only shell — PLATFORM_SHELL C3 is fully preserved (resolves arch M3). The
plugin ships its own Android UPI Intent handling, so there is **no
`shouldOverrideUrlLoading`, no intent-scheme allowlist, no `allowNavigation` for
`upi:`/`intent:`** (moots security SF-2). `capacitor.config.ts` is unchanged.

## 3. Payment-confirmation flow

1. FE `POST /subscription/checkout` → `{ razorpaySubscriptionId, checkoutUrl, razorpayKeyId, planTier, amountPaise }`.
2. **phone-web:** load checkout.js, `new Razorpay({ key: razorpayKeyId, subscription_id }).open()`.
3. **android-native:** `RazorpayCheckout.open({ key: razorpayKeyId, subscription_id, name, prefill, theme })`. Native SDK resolves only on payment success.
   - In BOTH (2)(3): success → **sync verify** via `GET /subscription/checkout/status`; the native SDK / handler resolving is NOT trusted for entitlement.
   - dismissal/cancel → watchdog: poll status N times before declaring abandoned.
4. **desktop-web:** show QR of `checkoutUrl` + poll status until FSM flips to ACTIVE.
5. Source of truth for activation is the **webhook → FSM writer** (already ported).
   FE poll/handler is UX only — never grants entitlement client-side. Entitlement
   JWT (RS256, already ported) is the gate.

**Critical invariant (DH N3, preserved — arch S4):** never show "active" on
`subscription.activated` alone — Razorpay flips that on *mandate registration*
before first charge. The status route reads the FSM `subscriptionState` from the
DB (written only by the webhook→FSM writer, enforce.js check 13), never a
Razorpay-derived flag. Activation requires `subscriptionState === 'ACTIVE'`
(`paidCount >= 1`).

## 4. Backend file plan

| File | Change | Est |
|---|---|---|
| `checkout-session.service.ts` | (a) add `razorpayKeyId` (publishable `RAZORPAY_KEY_ID`) to `CheckoutSessionResult`. (b) **MF-1:** replace raw `offer_id: input.couponCode` with server-side resolve — `prisma.coupon.findUnique({ where:{code}, select:{razorpayOfferId, …validity} })`, run existing validity checks (mirror `coupon/redemption.ts:159-168`), pass the **resolved `razorpayOfferId`**; unknown/expired/not-linked → drop (no offer forwarded). (c) **S3:** yearly with missing `_YEARLY` env → throw 503, not silent monthly fallback. | ~45L |
| `subscription.ts` | surface `razorpayKeyId` in response; add `GET /subscription/checkout/status` returning `{subscriptionState, planTier}`, `businessId = req.user!.businessId` (verbatim copy of the `:43` auth-scoping pattern — no path/query/body businessId; resolves S2/SF-3). | ~30L |
| `env.ts` | `getRazorpayPlanId(tier, yearly)` presence helper; boot-warn if `RAZORPAY_PLAN_*` unset in prod. | ~20L |
| `subscription.schemas.ts` | extend checkout response schema with `razorpayKeyId` if a response schema exists. | ~5L |

No schema migration. No webhook change. No FSM-writer change.

## 5. Frontend file plan (6-layer, ≤250L each)

types → constants → utils (`checkout-js-loader`, `checkout-status`) → hooks
(`useCheckoutDevice`, **`useCheckoutSession`** = create-session + phase machine,
**`useCheckoutStatusPoll`** = poll loop + timeout/watchdog — split per arch
S5/S6) → components (`MobileRazorpayCheckout`, `NativeRazorpayCheckout`,
`DesktopQrCheckout`, `CheckoutStatusView`) → page (`SubscriptionCheckoutPage`, a
thin phase render-switch, budget ≤200L) → css.

All API via `api()`. All strings via `t.*` (EN+HI, new `ext45` pair). 4 UI states
(loading/error/empty/success) + waiting/pending phases. QR via existing
`qrcode.react` `QRCodeSVG` — **no new dep** (arch S1).

`NativeRazorpayCheckout` mirrors `MobileRazorpayCheckout` props/prefill/sync-verify
(DH parity). Prefill synthesises a `noreply` email from user id when email absent
(DH pattern). `key` comes from the checkout response `razorpayKeyId`.

## 6. Android — native plugin (no MainActivity / no WebViewClient)

Add `capacitor-razorpay@^1.3.0` to `package.json`; `npx cap sync` registers the
`Checkout` plugin natively. The plugin forwards the options blob to Razorpay's
native Android Checkout activity (UPI Intent API). No `MainActivity.java` edit, no
`capacitor.config.ts` edit, no intent-scheme handling in app code. PLATFORM_SHELL
C3 (MainActivity = config-only `BridgeActivity`) is preserved. APK rebuild +
device test required to verify UPI app handoff.

## 7. Security cuts (all from security critique)

- **MF-1 (BLOCK→fixed):** `couponCode` resolved server-side to a trusted
  `razorpayOfferId` via the `Coupon` table; raw input never forwarded as
  `offer_id`. See §4.
- **SF-1:** add tight CSP `<meta http-equiv="Content-Security-Policy">` to
  `index.html`: `script-src 'self' https://checkout.razorpay.com; connect-src
  'self' https://*.razorpay.com https://api.razorpay.com; frame-src
  https://*.razorpay.com https://api.razorpay.com; img-src 'self' data: blob:`.
  No `unsafe-inline` / wildcard `https:` for script-src. Verify checkout.js
  subresource origins in Razorpay test mode; add only what breaks.
- **SF-3:** status route scoped to `req.user!.businessId` only (no IDOR). Returns
  only `{subscriptionState, planTier}` — no mandateId/PII.
- **OK (preserve):** `razorpayKeyId` is publishable-only; `RAZORPAY_KEY_SECRET`
  never leaves server (result is an explicit field allowlist, never spread the SDK
  response). Entitlement is server-SSOT (FSM writer). PII prefill stays
  client-side; server logger/Sentry already scrub phone/email + Razorpay IDs.
- Idempotency + replay already on `POST /subscription/checkout` — keep.
- **SF-2 N/A:** no `shouldOverrideUrlLoading` (native plugin handles UPI), so no
  intent-redirection surface.

## 8. Env contract (corrects doc drift)

Required on Render: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PLAN_PRO|_BUSINESS|_PRO_MAX` (+ `_YEARLY`
variants — missing `_YEARLY` now 503s, not silent monthly), `ENTITLEMENT_PRIVATE_KEY`,
`ENTITLEMENT_PUBLIC_KEY` (NOT `_JWT_`). Optional: `ENTITLEMENT_KEY_PREV`,
`RAZORPAY_MERCHANT_VPA|_NAME`. `VITE_RAZORPAY_KEY_ID` no longer needed by FE —
`razorpayKeyId` comes from the checkout response.

## 9. Rollout

Online-only feature; no migration. Behind existing subscription surface (opt-in by
user action; no cohort flag). Smoke: create session in Razorpay test mode → widget
/ native plugin opens → test UPI success → webhook flips FSM → status poll shows
ACTIVE → entitlement JWT issued.

## 10. Critic answers (resolved)

1. **Android UPI** — native `capacitor-razorpay` plugin (user's choice + DH proven). WebViewClient dropped (arch M1/M2/M3).
2. **QR lib** — reuse `qrcode.react@^4.2.0` (arch S1). No new dep.
3. **Status route** — new narrow `GET /subscription/checkout/status`, not GET /subscription overload (arch S2 / sec SF-3).
4. **CSP** — tight `<meta>` in index.html (sec SF-1); prerequisite, verified in test mode.
5. **PII prefill** — stays client-side; server already scrubs (sec OK-3).
