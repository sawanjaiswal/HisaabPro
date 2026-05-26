# HisaabPro — Beta Launch Plan

> **Created:** 2026-05-26 · **Owner:** Sawan · **Target launch:** 2026-06-09 (T+14d)
> **Goal:** 5–10 friendly SMB users on Play Store Internal Track, daily-active, billing real customers.
> **Strategy:** Land #149 importers + activate the 8 cred-blocked features + ship to Play Store. No new horizontal features. No vertical packs.

---

## Why this sequence

132/150 features are Done on master. 8 more are code-complete and blocked only on third-party credentials. 1 (#149 importers) is on `epic/phase-7-import` through PR-D2a — finishing it unblocks Vyapar/Tally migration, which is the #1 friction for SMB switchers. Everything else (Phase 7 finish, vertical packs) is post-launch growth — grinding more features without real users is the trap.

**Definition of "beta launched":**
- Play Store Internal Track build live, signed, versionCode locked
- 5 paying or non-paying SMB users invited via Play Console
- Razorpay live keys active → at least 1 real subscription processed
- WhatsApp Cloud sender verified → at least 1 invoice sent via WA
- Crash-free sessions ≥ 99% over 72h on installed devices
- Sawan can see daily-active in admin dashboard

---

## Workstreams (parallel where possible)

### W1 — Land importers (#149) → master

**Branch:** `epic/phase-7-import` (21 commits ahead, PR-D2a merged)
**Remaining:** PR-D2b (payments importer finish) + PR-D3 (UI polish, dry-run preview, error CSV download)
**Owner:** Backend agent → Frontend agent → QA
**Gates:**
- [ ] PR-D2b: payments parser handles Vyapar + Tally + generic Excel; idempotency via `ImportJobRow.sourceRowHash`
- [ ] PR-D3: `/import` page shows dry-run preview, row-level error table, "download errors as CSV"
- [ ] `npm run enforce` clean, `tsc -b --noEmit` clean
- [ ] Curl trio: 200 happy / 401 unauth / 400 malformed CSV
- [ ] Screenshots: 4 UI states at 320px (loading import, partial-fail, all-success, empty)
- [ ] Merge `epic/phase-7-import` → master (squash)
**Estimate:** 3–5 days
**Exit:** `#149` flips from In-Progress to Done in §24 matrix

### W2 — Activate cred-blocked features

For each, the code is shipped — the work is procurement + env wiring + smoke test. Done in parallel since vendors have independent lead times.

| # | Feature | Action | Lead time | Smoke test |
|---|---------|--------|-----------|------------|
| 2 | Razorpay Subscriptions | Switch test keys → live keys; verify webhook signing key in prod env | 1 day (account already KYC'd) | Subscribe Sawan's number to ₹1 plan, confirm webhook lands |
| 4 | Notifications engine (SMS+Email providers) | **SMS: MSG91** (DLT-registered sender ID + template approval; trial credits cover beta). **Email: Resend** (3k/mo free forever, 100/day). Wire keys in `lib/env.ts` | 2-3 days SMS · 1 day email | Trigger payment-received notification end-to-end |
| 30 | GST e-invoice (IRP) | Register GSTIN on NIC IRP sandbox → prod; install API access | 5-7 days (NIC approval) | Generate IRN for one B2B invoice |
| 32 | E-way bill | Same IRP creds extend to EWB API | Same as #30 | Generate EWB for one ≥₹50k invoice |
| 42 | UPI Intent / Razorpay UPI collect | Razorpay UPI activation (separate from subs) | 2 days | Receive ₹10 payment via QR |
| 47 | WhatsApp Cloud API | Meta Business verification + phone number + template approval | 7-14 days (longest pole) | Send invoice template to Sawan |
| 59 | Biometric (Capacitor) | `npm i @capacitor/biometric-auth` + iOS/Android wiring; re-run `cap sync` | 1 day | Lock app, fingerprint unlock on test device |
| 123/124 | Marketing providers (Brevo/Mailchimp) | OAuth app credentials, redirect URI in prod | 2 days | Push 1 contact list to provider |

**Owner:** Sawan (procurement) + Backend agent (env wiring) + QA (smoke)
**Critical path:** #47 WhatsApp (14d lead time) — start day 1.
**Exit:** All 8 flip from `[B]` → `[x]` in HISAABPRO.md feature list.

### W3 — Android release pipeline (Play Store Internal Track)

**Owner:** `android-release` subagent
**Steps:**
1. `cap sync` clean against current master
2. Bump `versionCode` (current → +1) + `versionName` (`1.0.0-beta.1`)
3. Verify signing key in `~/.android/keystores/` matches prior release (no key drift)
4. Generate signed AAB: `./gradlew bundleRelease`
5. Upload to Play Console → Internal Testing track
6. Add 10 testers to Internal Testing email allowlist
7. Roll out 100% to internal testers
8. Verify install via Play Store link on a real device
**Gates:**
- [ ] AAB size < 50 MB
- [ ] Manifest permission diff vs prior release reviewed (no surprise adds)
- [ ] Pre-launch report from Play Console green (no critical crashes)
- [ ] Tested on Android 11 (min) + Android 14 (target) + one Android 15 device (edge-to-edge regression)
**Estimate:** 1 day (assuming no signing-key drift)
**Exit:** Internal-track URL Sawan can share.

### W4 — Pre-launch stabilization

**Owner:** `/health` + `/qa` + manual smoke
**Sequence:**
1. `node scripts/manifest-score.js --brief` → must be ≥ current baseline
2. `node scripts/system-health.js --gold-standard --brief` → must pass
3. `npm run enforce` + `tsc -b --noEmit` clean across full tree
4. `/qa` on top 5 user paths: signup → onboarding → create party → create invoice → record payment → see dashboard
5. Lighthouse on landing page (already shipped page) — Performance/Accessibility/Best-Practices/SEO all ≥ 90
6. **Offline smoke**: airplane mode, create invoice + payment, reconnect, watch queue drain
7. **PIN gate smoke**: lock app, wrong PIN 5x, see lockout, recover via WhatsApp OTP
8. **Subscription smoke**: trial → expired → reactivated (test mode is fine here)
**Exit:** All gates green + screenshots saved in `/tmp/beta-launch-evidence/`.

### W5 — Beta user recruitment & onboarding

**Owner:** Sawan
**List of 10 candidates** (to be filled in by Sawan):
1. _____
2. _____
3. _____
... 10. _____

**Onboarding kit** (Sawan to produce):
- WhatsApp message template with Play Store link + 60-second video walkthrough
- Migration helper: "send me your Vyapar/Tally export, I'll prep your data" (uses #149)
- Feedback channel: WhatsApp group OR Discord OR direct line
- Bug bounty (informal): "find me a bug in week 1, I'll buy you coffee"

**Exit:** 5+ active accounts created in prod by T+14d.

---

## Timeline (gantt-ish)

```
Day 0 (today, 2026-05-26)
  ├─ Sawan: kick off #47 WhatsApp Cloud Business verification     ← critical path
  ├─ Sawan: kick off #30 NIC IRP registration                     ← second-longest pole
  └─ Backend agent: start W1 PR-D2b

Day 1-3
  ├─ W1 PR-D2b ships
  ├─ W2: Razorpay live keys swap + smoke (#2)
  └─ W2: Biometric Capacitor install (#59)

Day 3-5
  ├─ W1 PR-D3 ships → merge #149 to master
  ├─ W2: SMS+Email providers wired (#4)
  └─ W2: Marketing providers OAuth (#123/#124)

Day 5-8
  ├─ W4 stabilization sweep
  └─ W2: UPI activation (#42)

Day 7-10
  ├─ W3 Android release pipeline
  ├─ W2: #30 + #32 IRP approval arrives → wire & smoke
  └─ W5: write onboarding kit, finalize 10-candidate list

Day 10-14
  ├─ W2: #47 WhatsApp template approval arrives → activate
  ├─ Play Store internal track live
  ├─ W5: invite 5 testers, watch crash reports
  └─ Daily standup: review feedback, hot-fix as needed
```

**Slack:** 2 days at end for the inevitable.

---

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| WhatsApp Cloud verification rejected | Medium | Have MSG91 SMS as fallback for OTP/notifications; WA can ship in v1.1 |
| NIC IRP approval delayed beyond 14d | Medium | Mark #30/#32 as `[B]` and launch without them; B2B users without GST e-invoice are still served |
| Razorpay live keys reveal a webhook bug not caught in test mode | Low | Razorpay test mode → live mode is a flip-of-keys, well-tested codepath |
| Android 15 edge-to-edge regression on a tester device | Medium | Test on real Android 15 device BEFORE upload; PLATFORM_SHELL.md already enforces inset discipline |
| Importer #149 corrupts user data on first real migration | Low | Dry-run preview is in PR-D3; backup migrations table tracks every import for rollback |
| 5/10 testers churn after week 1 due to a real bug | Medium | Daily check of crash reports + WhatsApp feedback group; hotfix within 24h SLA |

---

## Out of scope (defer to post-beta)

- Phase 7 horizontal features #142–#148, #150 (multi-currency, advanced reports, audit log, etc.)
- Vertical packs V1–V7
- iOS app (`npx cap add ios` not run yet)
- Hindi translation pass (English-first beta is fine for Indian SMBs)
- Public Play Store launch (Internal Track only)

---

## After beta (post-2026-06-09)

Don't plan this in detail yet. Sequence will be re-decided after 2 weeks of real user data:

- If churn high → stabilize, polish, fix what users hit
- If churn low + feature requests cluster → build top 3 missing features
- If a specific vertical cluster (e.g., 3/10 testers are pharmacies) → ship that vertical pack first
- If billing conversion looks good → expand Play Store track to Closed Beta (100 users)

---

## Tracking

Each workstream's status will be updated in this file under a `## Status` section as it progresses. Daily 1-line entry: `YYYY-MM-DD | W<n> | <one-line update>`.

## Status

- 2026-05-26 15:30 | W1 | PR-D2b dispatched (4 payment parsers + normalizer + dedup)
- 2026-05-26 15:46 | W1 | PR-D2b shipped `c3a5b4b` — 22/22 tests, tsc clean, 13 files ≤250L
- 2026-05-26 15:47 | W1 | PR-D3 dispatched (commit ladder + Σ-guard + S9 audit)
- 2026-05-26 18:18 | W1 | PR-D3 shipped `1a10701` — 14/14 tests (incl. 50×Rs250 → 40+10 Σ-overflow split), tsc clean, no new enforce violations
- 2026-05-26 18:21 | W1 | PR-D4 dispatched (routes + 13 integration tests + enforce extensions)
- 2026-05-26 18:30 | W1 | PR-D4 shipped `a5425a7` — 13/13 tests (9 real + 4 describe.todo for live-pg harness); audit-coverage + Promise.all-ban enforce rules live; `?importJobId=` filter on /api/payments
- 2026-05-26 18:33 | W1 | PR-D5 dispatched (frontend: EntityPicker 4-tile, PaymentRowCard, banners, i18n EN/HI)
- 2026-05-26 18:48 | W1 | PR-D5 shipped `37651d7` — EntityPicker 4-tile, PaymentRowCard chips, ResumeFromInvoicesBanner, EN+HI i18n
- 2026-05-26 18:52 | W1 | **#149 MERGED to master via `9a3c98e` (`--no-ff`)** — Phase 7 importers complete. Post-merge `npm install` + `prisma generate` restored tsc=0; enforce at baseline (2 pre-existing oversized files). W1 exit gate met: `#149` flipped In-Progress → Done in §24.
