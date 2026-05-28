verdict: PASS

# Security Critique — Razorpay cross-platform UPI checkout (rev 2 re-audit)

Audit date: 2026-05-28 (revision 2). Scope: design plan
`.claude/design-plan-active--razorpay-upi-crossplatform--bare-091634.md` + already-ported backend.
Method: OWASP Top 10 + DudhHisaab live-incident regression checks, re-traced against the real source files (not the plan's self-description).

**Verdict rationale:** The single MUST_FIX from rev 1 (MF-1, money-out via unvalidated `couponCode`→`offer_id`) is resolved in the plan with a server-side resolve-and-validate design that maps to existing, verified code paths. All three SHOULD_FIX items are addressed as specified (SF-1 CSP added; SF-2 intent-redirection surface eliminated, not relocated; SF-3 status route tenant-scoped). The three previously-satisfied OK items are preserved. No money-out and no cross-tenant gap remains in the design. **PASS.**

This is a design-plan PASS: it clears the epic gate. Implementation must still match the plan — the acceptance curls (lines 55-64) are the build-time proof, especially the "unknown/expired couponCode → dropped, never forwards raw input as offer_id" and "cross-tenant id in URL ignored" cases.

---

## Rev-1 → rev-2 disposition

| ID | rev-1 tier | rev-2 status | Verified against |
|----|-----------|--------------|------------------|
| MF-1 | MUST_FIX (BLOCK) | **RESOLVED** | old vuln live at `checkout-session.service.ts:126`; fix design mirrors trusted mapping `redemption.ts:159-168` + validity gate `redemption.ts:95-99`; `Coupon.razorpayOfferId` exists `schema.prisma:2576` |
| SF-1 | SHOULD_FIX | **RESOLVED** | `index.html:1-19` confirmed had NO CSP meta; plan §7:178-183 adds tight policy |
| SF-2 | SHOULD_FIX | **N/A (surface removed)** | plan §2,§6,§7:191 drop `shouldOverrideUrlLoading` entirely; native plugin handles UPI |
| SF-3 | SHOULD_FIX | **RESOLVED** | auth-scoping pattern verified at `subscription.ts:43` (`req.user!.businessId`, URL param ignored) |
| OK-1/2/3 | satisfied | **PRESERVED** | result allowlist `:156-161`; FSM-SSOT; PII scrub unchanged |

---

## Tiered findings (rev 2)

| ID | Tier | Concern | Evidence (file:line) | Required action |
|----|------|---------|----------------------|-----------------|
| MF-1 | RESOLVED | Coupon money-out closed. Plan §4(b)/§7 replace raw `offer_id: input.couponCode` with server-side `prisma.coupon.findUnique({ where:{code}, select:{razorpayOfferId, ...validity} })`, run existing validity checks, and forward the **resolved** `razorpayOfferId`; unknown/expired/not-offer-linked codes are dropped — raw input is never forwarded. Trusted mapping (`razorpayOfferId` column) and validity logic both exist in code. | old vuln `checkout-session.service.ts:126`; trusted resolve `redemption.ts:159-168`; validity gate `redemption.ts:95-99` (status/expiry/plan-filter/min-amount); `schema.prisma:2576` | None for the gate. **Build-time:** the fetch MUST include the validity gate (status `ACTIVE`, `validUntil` not passed), not just the bare `findUnique` select at `:159-162` — the plan text and acceptance line 58 require this; assert it with the "unknown/expired → dropped" curl. |
| SF-1 | RESOLVED | Tight CSP `<meta http-equiv>` added to `index.html`: `script-src 'self' https://checkout.razorpay.com; connect-src 'self' https://*.razorpay.com https://api.razorpay.com; frame-src https://*.razorpay.com https://api.razorpay.com; img-src 'self' data: blob:`. No `unsafe-inline`/wildcard `https:` for script-src. | `index.html:1-19` (no CSP today); plan §7:178-183 | None. Verify checkout.js subresource origins in Razorpay test mode and add only what breaks (stay within `*.razorpay.com`). |
| SF-2 | N/A | Intent-redirection surface eliminated. `shouldOverrideUrlLoading` WebViewClient dropped; Android uses native `capacitor-razorpay` (UPI handled internally). No `Intent.parseUri`, no scheme allowlist, no `allowNavigation` for `upi:`/`intent:` in app code. `MainActivity.java` stays config-only `BridgeActivity` (PLATFORM_SHELL C3 intact). `capacitor.config.ts` unchanged — the rev-1 FE-2 `allowNavigation` widening is no longer introduced. | plan §2:101/§2:109-115, §6:164-171, §7:191 | None. Surface is gone, not relocated. |
| SF-3 | RESOLVED | New `GET /subscription/checkout/status` derives `businessId` from `req.user!.businessId` only (verbatim copy of `:43` pattern), never path/query/body. Returns only `{subscriptionState, planTier}` — no mandateId/PII. | correct pattern `subscription.ts:43`; plan §4:141, §7:184 | None. Assert with the "cross-tenant id in URL ignored" curl (acceptance line 59). Note the existing `GET /subscription` returns `mandateId` in its select (`:56`) — the new route's narrower projection is correct; do NOT reuse that select. |
| OK-1 | satisfied | `razorpayKeyId` publishable-only; `RAZORPAY_KEY_SECRET` never in result. Result is a 4-field explicit allowlist; plan adds publishable `RAZORPAY_KEY_ID`. | `checkout-session.service.ts:156-161` | Keep the result an explicit allowlist; never spread the Razorpay SDK response object. |
| OK-2 | satisfied | Entitlement server-SSOT. Activation written only by webhook→FSM writer; RS256 JWT signed server-side. FE poll is UX-only; activation requires `subscriptionState === 'ACTIVE'` (not `subscription.activated`). | plan §3:125-134 | Status endpoint must return the FSM `subscriptionState`, never a Razorpay-derived flag. |
| OK-3 | satisfied | checkout.js prefill PII stays client-side; server logger + Sentry scrub phone/email + Razorpay IDs. | plan §7:188-189 | If FE adds breadcrumb/analytics on the checkout page, ensure name/phone/email are not captured in FE Sentry. |
| FE-1 | FUTURE_EPIC | Webhook HMAC + idempotency + replay already correct (timingSafeEqual on raw bytes, fail-closed when secret unset). | n/a | None this epic. |

---

## Summary

- **MF-1 resolved** — money-out vector closed by server-side coupon resolution to a trusted `razorpayOfferId`; the design maps to existing validated code, not a hand-wave.
- **SF-1 / SF-2 / SF-3 all addressed** — CSP added, intent-redirection surface removed (native plugin), status route tenant-scoped.
- **OK-1/2/3 preserved** — publishable key only, server-SSOT entitlement, PII scrubbing.
- **No remaining BLOCK/REVISE finding.** Verdict: **PASS**.

Build-time gates that carry the design's safety (enforce these in QA, not the plan gate):
1. Coupon resolve includes the validity check (status ACTIVE + not expired), not just `findUnique` — curl: unknown/expired code → dropped, no `offer_id` forwarded.
2. Status route ignores any businessId in the URL/query/body — curl: cross-tenant id → own tenant's state returned.
3. CSP allowlist verified against checkout.js's real subresource origins in test mode before ship.
