verdict: PASS

# Architecture critique — Razorpay cross-platform UPI checkout (rev 2 re-audit)

audit_of: `.claude/design-plan-active--razorpay-upi-crossplatform--bare-091634.md`
auditor: architecture-auditor
audited_at: 2026-05-28T09:33:00Z
revision_audited: 2
prior_verdict: REVISE (rev 1 — 4 MUST_FIX + 7 SHOULD_FIX) · security BLOCK (1 MUST_FIX + 3 SHOULD_FIX)

## Verdict rationale (one paragraph)

Rev 2 resolves every MUST_FIX from rev 1 at the root, not by hand-waving.
The disproven WebViewClient.shouldOverrideUrlLoading mechanism is gone
entirely (M1/M2); Android now uses the native `capacitor-razorpay@^1.3.0`
SDK — DH's proven path — verified against
`DudhHisaab/.../NativeRazorpayCheckout.tsx:63,116-123` (`registerPlugin('Checkout')`,
native UPI Intent, sync-verify before declaring success) and DH
`package.json:76`. The plugin is auto-registered by `npx cap sync` with no
MainActivity edit, which I confirmed is safe: HP's
`MainActivity.java` is the 6-line config-only `BridgeActivity` (M3 — C3
preserved, no `WindowCompat`/inset code). `files_planned` is now tight —
concrete `src/App.tsx`, a single new `translations.en/hi.ext45.ts` pair,
`package.json`, `index.html`; only the docs dir keeps `**` (M4). All SHOULD_FIX
land: `qrcode.react@^4.2.0` reused (`package.json:51`, no new dep — S1); a
narrow `GET /subscription/checkout/status` instead of overloading the
JWT-resigning heavy `GET /subscription` (S2); yearly-missing-env now 503 in
acceptance instead of silent monthly charge (S3); FSM-is-SSOT preserved (S4);
`useCheckoutSession`/`useCheckoutStatusPoll` split + page budgeted ≤200L
(S5/S6); CSP treated as a build prerequisite (S7). The security BLOCK
(MF-1) is resolved correctly: `couponCode` resolved server-side to a trusted
`razorpayOfferId` via `prisma.coupon`, mirroring the existing validity-check
at `redemption.ts:159-168` which I confirmed exists, with raw input never
forwarded as `offer_id`. No MUST_FIX remains. PASS.

---

## Rev 1 → Rev 2 resolution ledger

| Prior | Status | Verification |
|---|---|---|
| M1 — Android UPI mechanism disproven | RESOLVED | Native `capacitor-razorpay` plugin adopted; WebViewClient dropped. Matches DH `NativeRazorpayCheckout.tsx:63,116-123`. Plan §1, §2 table, §6. |
| M2 — internal scope contradiction (bundled webview can't reuse DH mobile-web) | RESOLVED | Plan §1/§6 now state the native SDK is the only proven bundled-webview path; no false DH-parity claim. |
| M3 — C3/MainActivity safety | RESOLVED | Confirmed `MainActivity.java` is 6-line config-only BridgeActivity; plugin auto-registered by `npx cap sync`, no MainActivity/`capacitor.config.ts` edit. PLATFORM_SHELL C3 intact. |
| M4 — `files_planned` over-broad globs | RESOLVED | `src/App.tsx` (concrete), single `translations.en/hi.ext45.ts` pair, `package.json`, `index.html`. Only `docs/EPIC_.../**` keeps a glob — acceptable per rev-1 finding. |
| sec MF-1 — couponCode→offer_id money-out | RESOLVED | §4(b)/§7: server resolves `prisma.coupon.findUnique({where:{code}, select:{razorpayOfferId}})` + validity, forwards resolved id only. Pattern exists at `redemption.ts:159-168` (verified). Acceptance line added. |
| S1 — QR lib | RESOLVED | `qrcode.react@^4.2.0` confirmed `package.json:51`; no new dep; §2/§5/§10. |
| S2 — status route | RESOLVED | New narrow `GET /subscription/checkout/status → {subscriptionState, planTier}`, `req.user.businessId`-scoped; not the heavy `GET /subscription` (which re-signs JWT at `subscription.ts:74-83`). |
| S3 — yearly silent-fallback | RESOLVED | §4(c) + acceptance: yearly with missing `_YEARLY` → 503. (Note: the live `checkout-session.service.ts:42-43` still has the silent fallback — this is the change the plan commits to making; verify in build.) |
| S4 — FSM SSOT | PRESERVED | §3/§7: status route reads FSM `subscriptionState` from DB, never a Razorpay flag; `paidCount>=1`→ACTIVE. enforce.js checks 13/14 still guard the writer. |
| S5/S6 — hook + page 250L | RESOLVED | `useCheckoutSession` (create+phase) + `useCheckoutStatusPoll` (poll+watchdog) split; page budgeted ≤200L thin render-switch. Both in `files_planned`. |
| S7 — CSP prerequisite | RESOLVED | §7 SF-1 tight `<meta>` CSP in `index.html` (no `unsafe-inline`/wildcard script-src), treated as build prerequisite. |

---

## Findings (rev 2)

### MUST_FIX

None.

### SHOULD_FIX

| # | Finding | Evidence | Recommendation |
|---|---------|----------|----------------|
| S8 | `VITE_RAZORPAY_KEY_ID` leak in the borrowed code. DH's `NativeRazorpayCheckout.tsx:112` reads the key from `import.meta.env.VITE_RAZORPAY_KEY_ID`, but plan §5/§8 correctly say HP's `key` must come from the checkout-response `razorpayKeyId`. When porting, do NOT copy DH line 112 verbatim — wire `key` from the response prop, and drop `VITE_RAZORPAY_KEY_ID` from the FE env (plan §8 already states this). | DH `NativeRazorpayCheckout.tsx:112`; plan §8 | Pass `razorpayKeyId` as a prop into `NativeRazorpayCheckout` from the checkout response; assert no `import.meta.env.VITE_RAZORPAY_KEY_ID` lands in HP feature code. Low risk (publishable key) but avoids a second source of truth. |

### FUTURE_EPIC

| # | Item | Note |
|---|------|------|
| F1 | Cold-start checkout resume (`useCheckoutResume`) | DH has it; HP defers (plan §1 out-of-scope). Acceptable for v1 — a user who kills the app mid-pay then reopens won't auto-resume polling; webhook→FSM still activates server-side, so no money/entitlement is lost. |
| F2 | iOS checkout | Out of scope per §1 — fine. |
| F3 | Coupon/offer UX beyond code resolution | Deferred per §1 — fine. |

---

## What the plan got right (preserve)

- Native SDK choice matches DH's working, device-tested path — not a novel mechanism. Sync-verify after the plugin resolves (never trust the native handler for entitlement) is carried over correctly (§3 step 3).
- Backend delta stays minimal: `razorpayKeyId` (publishable, explicit allowlist field — never spread the SDK response), no schema/webhook/FSM-writer change (§4 footer).
- IDOR posture correct: both `POST /checkout` and the new `/checkout/status` scope `businessId` from `req.user!.businessId` — matches the existing `subscription.ts:43,114` pattern and MEMORY `feedback_auth_req_user_shape`.
- FSM-is-SSOT preserved and mechanically guarded (enforce.js checks 13/14); `paidCount>=1` activation guard intact.
- Idempotency + replay kept on `POST /subscription/checkout` (`subscription.ts:110-111`).
- File-layer discipline honored: 6-layer split, every row ≤250L, page ≤200L.

## Cross-session learnings applied

- `feedback_auth_req_user_shape` / MEMORY IDOR note → confirmed both routes scope by `req.user.businessId`; cross-tenant URL id ignored (acceptance line present).
- CLAUDE.md ≤250L file-layer discipline → S5/S6 split verified in `files_planned`.
- Project rule "no skipping 4 UI states" → acceptance lists loading/error/empty/success + 320px across all three surfaces.
- `feedback_root_fixes_only` → rev 2 fixes the Android mechanism at the root (drop the dead WebViewClient, adopt the SDK) rather than papering over it.

## Build-time watch items (not blockers)

1. The silent yearly-fallback in `checkout-session.service.ts:42-43` is still live in the ported code; S3's 503 is a committed change, not yet implemented — confirm the acceptance curl actually exercises it.
2. CSP must be validated in Razorpay test mode before declaring the feature done — if `script-src` omits `https://checkout.razorpay.com`, ALL web surfaces break, not just Android (S7).
3. When porting `NativeRazorpayCheckout`, strip DH's `VITE_RAZORPAY_KEY_ID` read (S8).
