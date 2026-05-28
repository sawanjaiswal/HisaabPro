# HisaabPro — Deploy Checklist (turnkey)

> Goal: get `master` live on Render as a usable beta. The build is done
> (141/150 features merged). This is an **operational** runbook, not a
> coding task. Source-of-truth for env names is the code (`server/src/lib/env.ts`,
> `server/src/lib/otp.ts`, `render.yaml`) — not prose in other docs.
> Last verified against `master` HEAD `5a1b387` (2026-05-28).

---

## 0. Pre-flight (local, ~5 min)

```bash
# from repo root
git status                       # must be clean, on master
git log --oneline -1             # confirm 5a1b387 (or later)
npx tsc -b --noEmit              # FE typecheck → 0 errors
( cd server && npx tsc --noEmit ) # BE typecheck → 0 errors
node scripts/enforce.js          # → EXIT 0 (PLATFORM_SHELL warnings are pre-existing debt)
```

Confirm the 61 migrations are committed (latest: `20260528161845_add_version_optimistic_lock`):
```bash
ls server/prisma/migrations | grep -vc migration_lock   # → 61
```

---

## 1. Environment variables on Render

`render.yaml` already auto-generates the secrets marked **gen** below and
sets the **fixed** ones. You only hand-enter the `sync: false` / integration
keys. Set these in the Render dashboard → `hisaabpro-api` → Environment.

### 1a. CORE — server will not function correctly without these

| Var | Source | Notes |
|-----|--------|-------|
| `DATABASE_URL` | you (Neon pooled) | app runtime connection |
| `DIRECT_DATABASE_URL` | you (Neon direct) | used by `prisma migrate deploy` |
| `JWT_SECRET` | **gen** (render.yaml) | access-token signing |
| `JWT_REFRESH_SECRET` | **gen** | refresh-token family rotation |
| `ENCRYPTION_KEY` | **gen** | field-at-rest encryption |
| `NODE_ENV` | fixed `production` | required for SameSite=None cross-origin cookies |
| `PORT` | fixed `10000` | Render web port |
| `CORS_ORIGIN` | fixed (capacitor + localhost) | **add `https://app.hisaabpro.in` before public launch** |
| `LOG_LEVEL` | fixed `info` | |

### 1b. MINIMUM-VIABLE BETA — needed for the two flows users actually hit

**Phone-OTP login delivery** (`server/src/lib/otp.ts`) — *without these the OTP
only prints to the server log; fine for closed test, not for real users:*
| Var | Required for |
|-----|--------------|
| `MSG91_AUTH_KEY` | OTP SMS send |
| `MSG91_TEMPLATE_ID` | OTP SMS send (MSG91 Flow template) |

> ⚠️ **Drift gotcha:** OTP send uses `MSG91_TEMPLATE_ID`, but the *marketing*
> SMS path (`isMsg91Configured()` in `env.ts`) checks `MSG91_SENDER_ID`.
> They are different vars for different features — set whichever the feature
> you're enabling needs. For login-only beta you need AUTH_KEY + TEMPLATE_ID.

**Payments / subscription** (`server/src/lib/env.ts`) — *monetization is inert
until set; app still works in free tier without them:*
| Var | Required for |
|-----|--------------|
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | checkout |
| `RAZORPAY_WEBHOOK_SECRET` | webhook signature verify |
| `RAZORPAY_PLAN_PRO` / `RAZORPAY_PLAN_BUSINESS` / `RAZORPAY_PLAN_PRO_MAX` | plan IDs (monthly) |
| `RAZORPAY_PLAN_<TIER>_YEARLY` | only if you sell yearly — a missing yearly plan returns 503 (won't mis-bill) |
| `ENTITLEMENT_PRIVATE_KEY` / `ENTITLEMENT_PUBLIC_KEY` | RS256 PEM, offline entitlement JWT |

### 1c. OPTIONAL — degrade gracefully (log a warning, never crash boot)

| Feature | Vars |
|---------|------|
| Email invoice PDF / reminders (Resend) | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET` |
| WhatsApp marketing + #143 bot (Aisensy) | `AISENSY_API_KEY`, `AISENSY_WEBHOOK_SECRET` (≥32 chars), `MARKETING_ENABLED=true` |
| SMS marketing webhook (MSG91) | `MSG91_SENDER_ID`, `MSG91_MARKETING_WEBHOOK_TOKEN` (≥32 chars) |
| Push notifications (FCM) | `FIREBASE_SERVICE_ACCOUNT_JSON` (base64) |
| Receipt OCR (#141) | `ANTHROPIC_API_KEY` (else returns OCR_UNAVAILABLE) |
| Bot/abuse gate | `TURNSTILE_SECRET_KEY` |
| E-invoice / e-way (NIC) | `NIC_ENV` (sandbox\|prod), `NIC_IRP_USERNAME`, `NIC_EWB_USERNAME` — stub mode when absent |

### 1d. Frontend build env (Vite — wherever the FE is hosted)
| Var | Value |
|-----|-------|
| `VITE_API_URL` | `https://api.hisaabpro.in` (or the Render URL) |
| `VITE_APP_ENV` | `production` |
| `VITE_TURNSTILE_SITE_KEY` | if Turnstile enabled |

---

## 2. Deploy

`render.yaml` is a Blueprint: build runs `npm install && npx prisma generate
&& npx prisma migrate deploy`, start runs `npm run start:prod` (tsx), health
check hits `/api/health`, `autoDeploy: true` on push to the deploy branch.

```bash
# 1. Set env vars from §1 in the Render dashboard FIRST.
# 2. Trigger deploy:
git push origin master        # autoDeploy picks it up
#    — or — Render dashboard → Manual Deploy → Deploy latest commit
```

Migrations run automatically in `buildCommand`. If you prefer to run them
out-of-band first (recommended for the money-column migrations
`20260527010000`..`030000` which add→backfill→drop):
```bash
cd server && DATABASE_URL="$DIRECT_DATABASE_URL" npx prisma migrate deploy
```

---

## 3. Smoke test (post-deploy)

```bash
API=https://api.hisaabpro.in ./scripts/smoke-deploy.sh
```
(script committed alongside this doc). Expected: health 200, unauth routes 401,
CSRF-guarded mutations 403, no 5xx.

Manual golden-path on a browser/device:
- [ ] Register + login (email/password works without MSG91; OTP needs §1b)
- [ ] Create a party, a product, an invoice → PDF renders
- [ ] Record a payment
- [ ] Open the same invoice in two tabs → edit both → second save shows the
      **#150 conflict dialog** (reload / overwrite) + presence avatar
- [ ] Offline: kill network mid-save → queued toast → reconnect → syncs

---

## 4. Launch toggles (flip before PUBLIC launch — fine to leave for closed test)

- [ ] `ALLOW_DEV_LOGIN=false` (or remove) — render.yaml ships it `true`,
      which keeps `admin/admin123` devLogin active. **Must disable for public.**
- [ ] `CORS_ORIGIN` — add the real web origin (`https://app.hisaabpro.in`).
- [ ] Phase 6 rollout flags per `docs/ROLLOUT_PHASE6.md` if ramping Staff/HR:
      `FEATURE_STAFF_HR=false`, `FEATURE_TRANSACTION_PIN=true`.

---

## 5. Real-device validation (one pass, can't be done in CI)

```bash
npx cap sync android
# open Android Studio → run on a physical phone (Rs 8-15K target device)
```
- [ ] Edge-to-edge: header below status bar, BottomNav above gesture pill
- [ ] Voice entry (#142) — mic permission + transcript parse
- [ ] Barcode scanner — camera permission + scan
- [ ] Thermal print (58/80mm) if a printer is on hand

---

## Known gotchas

- **tsc is skipped in the Render build** (`render.yaml` comment) — server runs
  via `tsx` because of accumulated non-blocking type errors at the app boundary.
  Local `cd server && tsc --noEmit` is the real gate; keep it green.
- **MSG91 var drift** (§1b) — login vs marketing use different MSG91 vars.
- **Money migrations** `20260527*` are add→backfill→drop sequenced; run them
  in order (migrate deploy does this) and never out of sequence.
- **`hisaabpro` branch** is 0 commits ahead of `master`; deploy from `master`.
