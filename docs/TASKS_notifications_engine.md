---
status: in-progress
feature: notifications-engine
epic_scale: LARGE — ~3-4 weeks build, 17 PRs, 5 P0 security gates
created: 2026-05-07T10:51:00Z
approver: Task Manager Agent
design_plan_ref: design-plan-active.md (status: approved)

agent_assignments:
  backend-builder:
    - PR1, PR2, PR3, PR4, PR5, PR6, PR7, PR8, PR9, PR10, PR11 (server infra + APIs)
  frontend-builder:
    - PR12, PR13 (client UX)
  i18n-agent:
    - PR14 (Hindi + English for all 18 events)
  verifier-agent:
    - PR15 (curl matrix, screenshots, tsc clean)
  security-agent:
    - P0 fixes validation (PR7, PR8 webhook/broadcast review)
    - PR16 (re-audit post-implementation)
  qa-agent:
    - PR17 (acceptance criteria sign-off)

proof_gates_required:
  after_pr11_backend:
    - tsc --noEmit clean
    - curl GET /api/notifications (auth: 200) · (no auth: 401)
    - curl PUT /api/notifications/preferences (bad body: 400)
    - curl POST /api/admin/notifications/broadcast (user token: 403)
    - curl POST /api/webhooks/notifications/msg91 (bad HMAC: 401)
    - curl POST /api/webhooks/notifications/msg91 (valid HMAC: 200)
    - Quiet hours test (23:00 enqueue → 07:00 IST next day)
    - Rate cap test (11th external/day → DEAD)
    - Cost cap test (over budget → DEAD + in-app warning)
    - WhatsApp stub returns NOT_REGISTERED
    - Status: BLOCKED_NO_PROOF (until curl matrix + tsc output shown)

  after_pr13_frontend:
    - Screenshots: bell (0 unread, 1-9, 9+) at 320px + 375px
    - Screenshots: inbox (loading, error, empty, success) at 320px + 375px
    - Screenshots: preferences (loading, error, success) at 320px + 375px
    - 320px: no horizontal overflow, title 2-line, body 1-line
    - console.log clean
    - tsc --noEmit clean (re-check after frontend)
    - Status: BLOCKED_NO_PROOF (until screenshot bundle shown)

  after_pr17_qa:
    - All acceptance criteria signed off
    - P1-P2 security items verified implemented
    - Status: COMPLETED (feature merged, flag default-off)

pr_sequence:
  pr1:
    title: "feat(notifications): schema — 5 new models + migrations"
    agent: backend-builder
    scope: |
      - server/prisma/schema.prisma: add Notification, NotificationJob, NotificationPreference, NotificationCostTally, PushToken (5 enums)
      - server/prisma/migrations/<ts>_notifications/migration.sql: additive only (5 CREATE TABLE, 3 CREATE TYPE, 9 CREATE INDEX)
    acceptance:
      - Prisma schema compiles
      - Migration runs clean on staging (backward compat verified)
      - All indexes as per ARCHITECTURE §3
      - No destructive changes (zero ALTER DROP/NOT NULL)
      - ReminderConfig, ReminderLog, CollectionCadence untouched
    depends: []
    estimate: 0.5d
    
  pr2:
    title: "feat(notifications): provider abstraction + registry"
    agent: backend-builder
    scope: |
      - server/src/features/notifications/providers/notification-provider.ts (interface + registry)
      - ProviderRegistry with isEnabled() + get() per ChannelType
      - Type exports (DispatchResult, ChannelType, ProviderRegistry)
    acceptance:
      - Interface compiles
      - Registry resolver works (unit test per channel)
      - isEnabled() check on each ChannelType
    depends: [pr1]
    estimate: 0.5d

  pr3:
    title: "feat(notifications): static templates + 18 events + i18n structure"
    agent: backend-builder
    scope: |
      - server/src/features/notifications/notification-events.ts (18 events, metadata map)
      - server/src/features/notifications/notification-types.ts (DispatchResult, RenderedTemplate, NotificationContext, BroadcastReq)
      - server/src/features/notifications/notification-errors.ts (typed error codes)
      - server/src/features/notifications/notification-template.service.ts (static template map EN+HI, render logic)
      - 18 events × 2 langs × 2+ channels = ~72 template entries seeded
    acceptance:
      - All 18 events exported as EventKey union
      - Template render() computes title+body+deepLinkUrl per event+channel+locale
      - Placeholder substitution {{key}} verified non-recursive
      - Paise→Rs formatting done server-side before template
      - No dangerouslySetInnerHTML in template output
    depends: [pr1, pr2]
    estimate: 1d

  pr4:
    title: "feat(notifications): FCM + Resend + MSG91 provider implementations"
    agent: backend-builder
    scope: |
      - server/src/features/notifications/providers/fcm.provider.ts (Firebase Admin SDK wrapper)
      - server/src/features/notifications/providers/resend.provider.ts (Resend HTTP client, PDF attachment path)
      - server/src/features/notifications/providers/msg91.provider.ts (MSG91 transactional SMS, E.164 validation)
      - Each provider: send(), isConfigured(), estimateCostPaise()
      - All env vars checked at boot (fail-closed if missing)
    acceptance:
      - Each provider implements NotificationProvider interface
      - DispatchResult returned (success, externalId, costPaise, errorCode, retryable)
      - FCM: deep-link via data.entityType + data.entityId
      - Resend: HTML render with PDF attachment support
      - MSG91: DLT template ID per event, E.164 regex validation
      - Error codes typed (INVALID_RECIPIENT, PROVIDER_DOWN, EXPIRED_TOKEN, etc.)
    depends: [pr2, pr3]
    estimate: 1d

  pr5:
    title: "feat(notifications): in-app + WhatsApp stub providers"
    agent: backend-builder
    scope: |
      - server/src/features/notifications/providers/in-app.provider.ts (DB insert + SSE fire)
      - server/src/features/notifications/providers/whatsapp.provider.ts (STUB: throws NotRegisteredError)
      - In-app: fires Notification row + SSE broadcast
      - WhatsApp: isConfigured()=false, send() throws
    acceptance:
      - In-app inserts to Notification table, returns { success: true }
      - In-app fires SSE notification:new event
      - WhatsApp send() throws NotRegisteredError
      - WhatsApp stub never reached in normal flow (guarded at dispatch)
    depends: [pr3]
    estimate: 0.5d

  pr6:
    title: "feat(notifications): queue + dispatcher + cost + rate-limit services"
    agent: backend-builder
    scope: |
      - server/src/features/notifications/notification-queue.service.ts (enqueue, claimBatch, mark*, retry policy)
      - server/src/features/notifications/notification-dispatch.service.ts (main orchestration: dedupe, quiet-hours, rate-cap, cost-cap, render, enqueue)
      - server/src/features/notifications/notification-cost.service.ts (atomic CAS for cost pre-flight + post-dispatch)
      - server/src/features/notifications/notification-rate-limit.service.ts (per-user per-day counter)
      - server/src/features/notifications/notification-quiet-hours.service.ts (IST-aware scheduling)
      - server/src/features/notifications/notification-preference.service.ts (read/write user prefs)
      - Atomic queue claims via UPDATE…FOR UPDATE SKIP LOCKED
      - Retry policy: 30s/5m/30m exponential, then DEAD
      - Cost cap check atomic, not race-prone (P1-2 fix)
      - Rate-limit atomic (P1-3 fix)
    acceptance:
      - tsc clean
      - Queue enqueue returns idempotencyKey
      - claimBatch(50) returns array, no double-claim on concurrent ticks
      - Retry backoff calculated correctly per attempt
      - Quiet hours: 23:00 enqueue → scheduledAt = 07:00+1d IST
      - Cost check returns {allowed, remainingPaise}
      - Rate-limit count atomic
      - Dedupe skips within 60s of same (userId, eventKey, channel)
    depends: [pr1, pr4, pr5]
    estimate: 2d

  pr7:
    title: "feat(notifications): webhook routes (MSG91, Resend, FCM, Aisensy stub)"
    agent: backend-builder
    scope: |
      - server/src/routes/webhooks/notifications-msg91.routes.ts (IP allowlist + HMAC, P0-4 verify-before-parse)
      - server/src/routes/webhooks/notifications-resend.routes.ts (Svix HMAC, P0-4 verify-before-parse)
      - server/src/routes/webhooks/notifications-fcm.routes.ts (Google JWT verify, cert cache fail-closed per P1-8)
      - server/src/routes/webhooks/notifications-aisensy.routes.ts (STUB: 501)
      - Each route: express.raw() mounted route-level, raw Buffer HMAC verify BEFORE JSON.parse
      - 401 on HMAC failure (P0-5), never 200
      - Status codes: 401 (sig fail), 400 (body fail), 200 (ok), 409 (replay)
      - Express rate limit 600/min per IP
      - Add WebhookReceipt model (P1-7 / PR1 migration check)
    acceptance:
      - tsc clean
      - curl POST /api/webhooks/notifications/msg91 (bad HMAC) → 401
      - curl POST /api/webhooks/notifications/msg91 (valid HMAC) → 200
      - curl POST /api/webhooks/notifications/resend (bad sig) → 401
      - curl POST /api/webhooks/notifications/fcm (bad JWT) → 401
      - Body parsing happens only after sig verify succeeds
      - Rate limit returns 429 after 600 reqs
      - No HMAC/JWT in response body ever
      - Signature failure logged to audit (provider name + timestamp, no raw body)
    depends: [pr1, pr4, pr6]
    estimate: 1.5d
    
  pr8:
    title: "feat(notifications): admin broadcast route + Zod validation"
    agent: backend-builder
    scope: |
      - server/src/routes/admin/notifications-broadcast.ts (requireSuperAdmin not requireAdmin)
      - Zod schema .strict() with tier-coercion guard per P0-1
      - targetTier enum: 'free' | 'pro' | 'business' (no 'ALL', no userIds[])
      - Broadcast body limits: title 160, body 1000, deepLinkUrl 255, https only, reject javascript:/data:
      - Server resolves user list by tier; never trusts client
      - Idempotency-Key header required, 24h cache, collision returns 409 (P2-4)
      - Admin audit log: actor, tier, count, body, idempotency key (P2-3)
      - Rate limit: 2 broadcasts per admin per 24h
    acceptance:
      - tsc clean
      - curl POST /api/admin/notifications/broadcast (bad tier 'ALL') → 400
      - curl POST /api/admin/notifications/broadcast (user token, not admin) → 403
      - curl POST /api/admin/notifications/broadcast (super admin, valid) → 200, jobs queued
      - Duplicate Idempotency-Key with same body → 200 (idempotent)
      - Duplicate Idempotency-Key with different body → 409
      - Jobs created equal to user count on target tier
      - Audit row logged with full context
    depends: [pr1, pr6]
    estimate: 1d

  pr9:
    title: "feat(notifications): user-facing endpoints (inbox, preferences, settings, SSE stream)"
    agent: backend-builder
    scope: |
      - server/src/routes/notifications.ts (user-facing GET/POST/PUT)
        - GET /api/notifications (cursor pagination, unreadCount)
        - POST /api/notifications/:id/read
        - POST /api/notifications/read-all
        - GET /api/notifications/unread-count
        - GET/PUT /api/notifications/preferences
        - GET/PUT /api/notifications/settings (quiet hours)
        - GET /api/notifications/stream (SSE)
      - server/src/lib/sse-notifications.ts (SSE registry, broadcast, heartbeat, per-IP cap)
      - Origin/Referer guard + per-IP cap 5 streams (P0-7)
      - SSE payload: { type, unreadCount } only (P2-5)
      - Rate limits: 600/min global, per-endpoint guards (P1-10)
    acceptance:
      - tsc clean
      - curl GET /api/notifications (auth) → 200 {data, nextCursor, unreadCount}
      - curl GET /api/notifications (no auth) → 401
      - curl PUT /api/notifications/preferences (bad body) → 400
      - curl POST /api/notifications/:id/read → 200
      - curl GET /api/notifications/settings → 200 {quietHoursStart, quietHoursEnd}
      - curl GET /api/notifications/stream → EventSource opens, sends heartbeat every 25s
      - SSE payload verified to contain only {type, unreadCount}
      - Cross-tenant test: user A cannot list/read user B notifications
    depends: [pr1, pr6]
    estimate: 1d

  pr10:
    title: "feat(notifications): cron integrations (queue drain, scans, retention)"
    agent: backend-builder
    scope: |
      - server/src/features/notifications/notification-cron.ts (register via cron-scheduler extension hook)
      - Drain queue (every 1 min): claimBatch(50), dispatch, mark status
      - 08:00 IST overdue scan: emit PAYMENT_OVERDUE for past-due invoices
      - 09:00 IST subscription scan: emit SUBSCRIPTION_EXPIRING_SOON
      - 02:00 IST Sunday retention purge: delete Notification > 90d, NotificationJob > 30d
      - 00:05 IST 1st-of-month cost reset: new-month rows (no-op, new key exists)
      - Advisory locks per P1-4 (pg_try_advisory_lock)
      - Stale-claim sweeper: every drain tick, UPDATE status='PROCESSING' → 'QUEUED' if claimedAt > 5min
      - Retention: batched DELETE LIMIT 5000, audit row per batch, 50% sanity guard
    acceptance:
      - tsc clean
      - Drain tick returns claimed jobs count
      - Overdue scan emits notification.manager.notify() per invoice
      - Subscription scan fires correctly at 09:00 IST
      - Retention purge batches correctly, logs audit rows
      - Advisory lock prevents concurrent cron ticks
      - Stale claim reclaim logged with worker id
    depends: [pr1, pr6, pr9]
    estimate: 1d

  pr11:
    title: "feat(notifications): wire events from invoice/payment/stock/expense services"
    agent: backend-builder
    scope: |
      - Modify existing services to call notification.manager.notify():
        - invoice.service.ts: INVOICE_CREATED on save, INVOICE_SHARED on share
        - payment.service.ts: PAYMENT_RECEIVED, PAYMENT_LINK_PAID
        - stock.service.ts: LOW_STOCK_ALERT, STOCK_OUT
        - expense.service.ts: EXPENSE_RECORDED
        - recurring.service.ts: RECURRING_INVOICE_GENERATED, RECURRING_EXPENSE_PENDING
        - subscription.service.ts: SUBSCRIPTION_EXPIRING_SOON, SUBSCRIPTION_EXPIRED (via cron)
        - ptp.service.ts: PTP_DUE_TODAY, PTP_BROKEN (via cron)
      - notification.manager.ts facade (try/catch wrapper, never throws to caller)
      - All calls pass eventKey + context (partyName, amount, invoiceNo, etc.)
      - Offline: all calls use api() + entityType (already verified in PR4-5 services)
    acceptance:
      - tsc clean
      - Invoice create → notification.manager.notify('INVOICE_CREATED', ctx)
      - Payment receive → notification.manager.notify('PAYMENT_RECEIVED', ctx)
      - Stock alert → notification.manager.notify('LOW_STOCK_ALERT', ctx)
      - All 18 events tested e2e (unit test per event emission)
      - Error in notify() swallowed, source flow unaffected
      - No new api() calls added (all mutations via facade)
    depends: [pr1-pr10]
    estimate: 1d

  proof_gate_backend:
    title: "Backend proof gate — tsc clean + curl matrix + functional tests"
    agent: verifier-agent
    scope: |
      - tsc --noEmit output (clean)
      - curl matrix:
        * GET /api/notifications (auth) → 200
        * GET /api/notifications (no auth) → 401
        * PUT /api/notifications/preferences (bad body) → 400
        * POST /api/admin/notifications/broadcast (user token) → 403
        * POST /api/webhooks/notifications/msg91 (bad HMAC) → 401
        * POST /api/webhooks/notifications/msg91 (valid HMAC) → 200
      - Functional tests:
        * Quiet hours: notification enqueued 23:00 → scheduledAt 07:00 IST+1
        * Rate cap: 11th external notif/day → DEAD with RATE_CAP_EXCEEDED
        * Cost cap: tally exceeds plan → DEAD with COST_CAP_EXCEEDED; in-app still fires
        * WhatsApp stub: send() throws NOT_REGISTERED
        * SSE: heartbeat + message broadcast
        * Webhook rate limit: > 600/min → 429
    acceptance_proof:
      - Screenshot of `tsc --noEmit` output (clean or showing no errors)
      - Screenshot of curl test results (all probes pass)
      - Screenshot of test runner output (quiet hours, rate cap, cost cap, stub tests pass)
    estimate: 0.5d
    depends: [pr1-pr11]
    blocks: pr12

  pr12:
    title: "feat(notifications): frontend components (Bell, Inbox, Preferences pages)"
    agent: frontend-builder
    scope: |
      - client/src/features/notifications/NotificationBell.tsx (icon + badge, 4 states)
      - client/src/features/notifications/NotificationsPage.tsx (inbox list, infinite scroll, 4 states)
      - client/src/features/notifications/NotificationRow.tsx (single notification row)
      - client/src/features/notifications/NotificationPreferencesPage.tsx (event×channel toggle grid, 4 states)
      - client/src/features/notifications/NotificationQuietHoursCard.tsx (start/end time pickers)
      - client/src/features/notifications/useNotifications.ts (TanStack Query hooks)
      - client/src/features/notifications/useNotificationStream.ts (EventSource + 30s polling fallback)
      - client/src/features/notifications/notifications.service.ts (api() calls, entityType)
      - client/src/features/notifications/types.ts (TS contracts)
      - App header wires NotificationBell
      - All calls via api() from @/lib/api
      - Mutations include entityType: 'notification', entityLabel
      - Reads opt in cacheReads: true (safe for non-PII)
    acceptance:
      - tsc clean
      - All 4 UI states present on each screen (loading, error, empty, success)
      - Bell badge: 0 (no badge), 1-9 (count), 9+ (capped)
      - 320px: no horizontal overflow, title 2-line, body 1-line
      - 375px: full content visible
      - Offline: bell badge reads from IndexedDB cache
      - SSE fallback: on 3 reconnect errors, switch to 30s polling
      - No console.log, no :any, no /api/api paths
      - Optimistic updates work offline
    depends: [proof_gate_backend]
    estimate: 1.5d

  pr13:
    title: "feat(notifications): admin frontend (broadcast composer + stats)"
    agent: frontend-builder
    scope: |
      - client/src/features/admin/AdminNotificationBroadcast.tsx (body composer, tier selector, dry-run, send)
      - client/src/features/admin/AdminNotificationStats.tsx (delivery stats by channel/date)
      - Both pages: 4 UI states, 320px tested
      - Tier selector: free, pro, business (no 'ALL', no typing 'free')
      - Body fields: titleEn, titleHi, bodyEn, bodyHi, deepLinkUrl
      - Dry-run preview: shows template rendered with dummy data
      - Send confirmation: "Send to N users?" + idempotency-key header
    acceptance:
      - tsc clean
      - 4 UI states per page (loading, error, empty, success)
      - 320px + 375px tested, no overflow
      - Dry-run shows correct template + recipient count
      - Send button includes idempotency-key header
      - No console.log
    depends: [proof_gate_backend]
    estimate: 1d

  proof_gate_frontend:
    title: "Frontend proof gate — screenshots + console clean + tsc"
    agent: verifier-agent
    scope: |
      - Screenshots (Bell icon + badge):
        * 0 unread (no badge)
        * 1-9 unread (badge with count)
        * 9+ unread (badge "9+")
        * All at 320px + 375px
      - Screenshots (Inbox page):
        * Loading (shimmer list)
        * Error ("Could not load. Tap to retry.")
        * Empty ("You're all caught up!")
        * Success (notification list, unread blue accent)
        * All at 320px + 375px
      - Screenshots (Preferences page):
        * Loading (shimmer toggles)
        * Error ("Could not load. Tap to retry.")
        * Success (toggle grid, some cells disabled)
        * All at 320px + 375px
      - Console log check: zero console.log, no errors in DevTools
      - tsc --noEmit clean (re-verify after frontend changes)
    acceptance_proof:
      - Screenshot bundle showing all 6 inbox states (2 widths)
      - Screenshot bundle showing all 3 preferences states (2 widths)
      - Screenshot bundle showing 3 bell states (2 widths)
      - DevTools console screenshot (clean)
      - tsc output screenshot (clean)
    estimate: 0.5d
    depends: [pr12, pr13]
    blocks: pr14

  pr14:
    title: "feat(i18n): notifications copy — English + Hindi"
    agent: i18n-agent
    scope: |
      - client/src/i18n/locales/en/notifications.json (all UI copy + 18 event templates)
      - client/src/i18n/locales/hi/notifications.json (all UI copy + 18 event templates)
      - Keys:
        * UI: page titles, button labels, empty/error states, toast messages
        * Templates: each event × channel × language (e.g. payment.overdue.sms.en)
      - All keys referenced in code exist in both locales
      - Hindi correct Devanagari, natural tone (not transliterated English)
    acceptance:
      - All keys in en.json also in hi.json (no asymmetry)
      - Template keys match notification-template.service.ts static map
      - Code references verified (grep for i18n calls)
      - No console warnings for missing keys in dev
    depends: [pr3, proof_gate_frontend]
    estimate: 0.5d

  pr15:
    title: "feat(notifications): comprehensive verification suite (tsc + curl + screenshots + functional)"
    agent: verifier-agent
    scope: |
      - Verifier script:
        * tsc --noEmit on entire codebase
        * curl matrix (all 6 endpoints, all 6 status codes)
        * Quiet hours functional test (input 23:00 → output 07:00+1)
        * Rate cap functional test (11 notifs → 11th DEAD)
        * Cost cap functional test (exceed cap → DEAD + 80% warning)
        * WhatsApp stub test (send() throws)
        * Screenshot bundle validation
        * console.log audit (zero logs)
    acceptance_proof:
      - Consolidated report:
        * tsc output (clean)
        * curl test matrix (6 probes × 2 endpoints = 12 rows, all pass)
        * Functional test suite (4 tests pass)
        * Screenshot inventory (6 UI states × 2 widths each, all present)
        * console.log audit (0 logs found)
    estimate: 1d
    depends: [pr1-pr14]
    blocks: pr16

  pr16:
    title: "security: post-implementation audit — P0-P2 fixes verification"
    agent: security-agent
    scope: |
      - Re-audit implemented code against SECURITY_AUDIT_notifications_engine.md
      - Verify all 7 P0 items implemented:
        * P0-1: Zod schema .strict() on broadcast body
        * P0-2: requireSuperAdmin guard on broadcast
        * P0-3: RESEND_WEBHOOK_SECRET env var name canonical
        * P0-4: Webhook verify-before-parse on raw body order
        * P0-5: 401 on HMAC fail, never 200
        * P0-6: PII separation in NotificationJob (no raw recipient in payload)
        * P0-7: SSE Origin/Referer guard + per-IP cap
      - Verify P1 items tracked in backlog (defer to post-launch):
        * P1-1 through P1-10 planned but may ship later
      - Code review: webhook routes, broadcast route, SSE stream
      - OWASP checklist: A01-A10 coverage
    acceptance:
      - All P0 items: ✓ implemented + ✓ tested
      - P1 items: tracked in follow-up PR list
      - Code review: no new vulns found
      - OWASP coverage: confirmed vs. audit matrix
    estimate: 1d
    depends: [pr15]
    blocks: pr17

  pr17:
    title: "qa: acceptance gates — real-device testing + flag flip decision"
    agent: qa-agent
    scope: |
      - QA checklist (from SCOPE §21):
        * Real Android/iOS device: FCM push appears in system tray
        * Deep-link works: tap → navigates to correct entity route
        * Resend email: delivered, PDF attachment present
        * MSG91 SMS: delivered to test number
        * In-app notification: appears in inbox, bell badge increments
        * Mark-all-read: clears badge to 0
        * Preference toggle: opt-out prevents channel job enqueue
        * Quiet hours: 23:00 enqueue → no send until 07:00 IST
        * Provider down: job retried 3x → DEAD; in-app still delivered
        * Cost tally: incremented post-dispatch
        * Monthly reset: cron test on staging
        * Admin broadcast: only target-tier users receive
        * Webhook HMAC: tampered payload → 401
        * Cross-tenant: user A cannot read user B data
        * 90-day purge: runs without error
        * All i18n keys: both en + hi present
      - Result: APPROVED or BLOCKED (with violations list)
      - If APPROVED: decision to flip NOTIFICATIONS_ENGINE_ENABLED=true → decision to Sawan
      - If BLOCKED: route to redo-agent with violations list
    acceptance:
      - All 15 QA checkpoints: ✓ pass
      - Screenshot evidence attached
      - P1-P2 items status (shipped vs. tracked)
      - Final sign-off: QA approved feature DONE
    estimate: 1.5d
    depends: [pr16]

pr_dependencies_graph: |
  PR1 (schema)
    ↓
  PR2 (provider interface) ←────────┐
    ↓                               │
  PR3 (events + templates) ────┐   │
    ↓                          │   │
  PR4 (FCM/Resend/MSG91) ←─────┴───┤
    ↓                              │
  PR5 (in-app + WA stub) ──┐      │
    ↓                      │      │
  PR6 (queue+dispatch+costs)←─────┤
    ↓                              │
  PR7 (webhooks) ←─────────────────┤
    ↓                              │
  PR8 (admin broadcast)            │
    ↓                              │
  PR9 (user endpoints + SSE)       │
    ↓                              │
  PR10 (crons) ←──────────────────┘
    ↓
  PR11 (wire events)
    ↓
  PROOF GATE (Backend)
    ↓
  PR12 (frontend Bell/Inbox/Prefs)
    ↓
  PR13 (admin frontend)
    ↓
  PROOF GATE (Frontend)
    ↓
  PR14 (i18n)
    ↓
  PR15 (verifier suite)
    ↓
  PR16 (security re-audit)
    ↓
  PR17 (QA + flag-flip decision)

workflow_notes: |
  1. All PRs are backend-first (server infra + APIs), then frontend in parallel
     with i18n, then verification suite, then security re-audit, then QA.
  2. Two proof gates are HARD STOPS:
     - After PR11: Backend must pass curl matrix + tsc + functional tests
       before frontend can start.
     - After PR13: Frontend must pass screenshot + console + tsc requirements
       before verifier suite can assemble final report.
  3. P0 security fixes from SECURITY_AUDIT_notifications_engine.md are baked
     into PR7, PR8, PR9, PR10. P1-P2 are tracked as deferred items in backlog.
  4. Feature flag NOTIFICATIONS_ENGINE_ENABLED=false at deploy; QA gates
     sign-off → Sawan decision → flag flip to true (no forced auto-flip).
  5. Existing ReminderConfig/ReminderLog/CollectionCadence untouched;
     old notification.service.ts stub deleted only AFTER all callers migrated.

p1_deferred_tracking: |
  The following P1 items from SECURITY_AUDIT_notifications_engine.md are
  KNOWN and TRACKED but deferred to post-launch Phase 2 PRs:
  
  - P1-1: Stale-claim sweeper (worker crash recovery)
  - P1-2: Atomic CAS for cost-cap (currently two-step, race-prone)
  - P1-3: Atomic rate-limit (currently racy, needs transaction)
  - P1-4: Cron advisory locks (pg_try_advisory_lock pattern)
  - P1-5: Retention purge guard rails (batch limits, audit, sanity checks)
  - P1-6: PushToken at-rest encryption decision
  - P1-7: WebhookReceipt model (or cache, TBD)
  - P1-8: FCM JWT cert cache fail-closed
  - P1-9: MSG91 IP+HMAC dual-factor (currently IP-only)
  - P1-10: Rate limits on push-token + preferences endpoints
  
  Decision: Ship MVP with 7 P0 fixes + limited P1 coverage. P1 items tracked
  separately in post-launch backlog. QA will note which P1 items are
  outstanding and expected for Phase 2.

risk_summary: |
  Risks and mitigations (from ARCHITECTURE §16 + SECURITY P1-P2):
  
  | Risk | Likelihood | Impact | Mitigation | Ship blocker? |
  |------|---|---|---|---|
  | DB queue cannot keep up | LOW | MED | Tunable batch size; Bull upgrade ready | NO |
  | Quiet-hours DST bug (n/a IST) | LOW | LOW | Locked to Asia/Kolkata; unit tests | NO |
  | FCM cert cache miss | MED | HIGH | fail-closed, fetch sync, reject if unavailable | P1 (defer) |
  | Webhook HMAC race | LOW | MED | Svix timestamp + dedupe (WebhookReceipt) | P1 (defer) |
  | Cost tally race | LOW | MED | Atomic CAS (P1-2); design correct but impl TBD | P1 (defer) |
  | Admin broadcast scope creep | LOW | HIGH | Zod .strict(), Tier enum, server-side resolve | P0 (included) |
  | Cross-tenant SSE leak | LOW | HIGH | Origin/Referer guard + per-IP cap, payload shape locked | P0 (included) |
  | PushToken plaintext at rest | LOW | HIGH | Encryption decision required (P1-6) | P1 (defer) |
  
  Go/no-go for MVP: **GO** if all P0 items pass verification, P1 items tracked
  for Phase 2, QA sign-off obtained, and Sawan approves flag flip.

timeline_estimate: |
  Sequential critical path (assume 1 dev working alone):
  
  PR1 (schema)             0.5d  → day 0.5
  PR2 (interface)          0.5d  → day 1
  PR3 (events+templates)   1d    → day 2
  PR4 (FCM/Resend/MSG91)   1d    → day 3
  PR5 (in-app+stub)        0.5d  → day 3.5
  PR6 (queue+dispatch)     2d    → day 5.5
  PR7 (webhooks)           1.5d  → day 7
  PR8 (admin broadcast)    1d    → day 8
  PR9 (user endpoints)     1d    → day 9
  PR10 (crons)             1d    → day 10
  PR11 (wire events)       1d    → day 11
  Proof gate (backend)     0.5d  → day 11.5
  PR12 (frontend)          1.5d  → day 13
  PR13 (admin frontend)    1d    → day 14
  Proof gate (frontend)    0.5d  → day 14.5
  PR14 (i18n)              0.5d  → day 15
  PR15 (verifier)          1d    → day 16
  PR16 (security audit)    1d    → day 17
  PR17 (QA)                1.5d  → day 18.5
  
  **Total: ~18.5 days = ~3.7 weeks** (4 dev-weeks with typical interrupts).
  
  Parallelization (if 3 devs):
  - Dev 1: PR1-11 (backend critical path, 11d)
  - Dev 2: PR12-13 (frontend, after proof_gate, 2d) + PR14 (1d)
  - Dev 3: PR15-16 (verification + audit, 2d after PRs done)
  → Compression to ~2 weeks wall-clock.

---

## Proof Gate Checklist (BACKEND)

**Status: BLOCKED_NO_PROOF** until evidence shown.

Required evidence after PR11:

[ ] **tsc output**
    File: `/Users/sawanjaiswal/Projects/HisaabPro/<path>/tsc-output.txt`
    Command: `tsc --noEmit > tsc-output.txt 2>&1`
    Expected: "0 errors" or clean run

[ ] **curl matrix**
    File: `/Users/sawanjaiswal/Projects/HisaabPro/<path>/curl-results.txt`
    6 critical endpoints tested:
    - GET /api/notifications (auth) → 200
    - GET /api/notifications (no auth) → 401
    - PUT /api/notifications/preferences (bad body) → 400
    - POST /api/admin/notifications/broadcast (user token) → 403
    - POST /api/webhooks/notifications/msg91 (bad HMAC) → 401
    - POST /api/webhooks/notifications/msg91 (valid HMAC) → 200

[ ] **Functional tests**
    File: `/Users/sawanjaiswal/Projects/HisaabPro/<path>/test-results.txt`
    - Quiet hours test: notification 23:00 → scheduledAt 07:00+1
    - Rate cap test: 11th → DEAD
    - Cost cap test: over budget → DEAD + warning
    - WhatsApp stub: send() throws NOT_REGISTERED

**Gate status changes to PASS when all three files present + content verified.**

---

## Proof Gate Checklist (FRONTEND)

**Status: BLOCKED_NO_PROOF** until evidence shown.

Required evidence after PR13:

[ ] **Screenshots**
    Path: `/Users/sawanjaiswal/Projects/HisaabPro/docs/screenshots-notifications/`
    Contents:
    - bell-0-unread-320px.png
    - bell-0-unread-375px.png
    - bell-1-9-unread-320px.png
    - bell-1-9-unread-375px.png
    - bell-9plus-unread-320px.png
    - bell-9plus-unread-375px.png
    - inbox-loading-320px.png
    - inbox-loading-375px.png
    - inbox-error-320px.png
    - inbox-error-375px.png
    - inbox-empty-320px.png
    - inbox-empty-375px.png
    - inbox-success-320px.png
    - inbox-success-375px.png
    - prefs-loading-320px.png
    - prefs-loading-375px.png
    - prefs-error-320px.png
    - prefs-error-375px.png
    - prefs-success-320px.png
    - prefs-success-375px.png

[ ] **console.log audit**
    File: `/Users/sawanjaiswal/Projects/HisaabPro/<path>/console-audit.txt`
    Command: `grep -r "console\.log" client/src/features/notifications/ || echo "✓ clean"`
    Expected: "✓ clean"

[ ] **tsc --noEmit**
    File: `/Users/sawanjaiswal/Projects/HisaabPro/<path>/tsc-frontend-output.txt`
    Command: `tsc --noEmit > tsc-frontend-output.txt 2>&1`
    Expected: "0 errors"

**Gate status changes to PASS when all three conditions met + screenshots reviewed.**

---

## Proof Gate Checklist (QA / APPROVAL)

**Status: PENDING** until PR16 + PR17 complete.

Required evidence after PR17:

[ ] **QA Sign-Off**
    File: `/Users/sawanjaiswal/Projects/HisaabPro/docs/QA_SIGN_OFF_notifications_engine.md`
    Contents:
    - All 15 QA checkpoints: ✓ pass
    - Screenshots attached (real device, real SMS/email)
    - P1 items status (tracked, deferred to Phase 2)
    - Final verdict: **APPROVED FOR PRODUCTION** or **BLOCKED**

[ ] **Security Re-Audit**
    File: Already exists: `docs/SECURITY_AUDIT_notifications_engine.md`
    PR16 verifies all 7 P0 items implemented + no new vulns.

**Gate status: APPROVED only after both QA sign-off + Sawan flag-flip decision.**

---
