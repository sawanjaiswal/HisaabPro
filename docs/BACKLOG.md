# Backlog — resume 2026-05-09

> Snapshot at 2026-05-08 14:19 IST. Phase 4 complete (118/150). Phase 5 Epic A backend shipped, FE paused mid-scaffold. Master deployed to Render+Vercel at commit `89610b0`.

## Resume order

### 1. Phase 5 Epic A — Marketing Comms FE *(in progress, paused)*
Backend live (PR1-6 commits `3ea2cdc`..`5c2e3ca`). FE scaffolding partial in `src/features/marketing/`.

**What exists:**
- `marketing.types.ts`, `marketing.constants.ts`, `marketing.utils.ts`, `marketing.errors.ts`
- `marketing.service.ts`, `marketing-crud.service.ts`
- `hooks/useMarketingTemplates.ts`

**What's missing:**
- pages/: `MarketingHubPage`, `TemplateListPage`, `TemplateFormPage`, `CampaignListPage`, `CampaignWizardPage` (5-step), `CampaignDetailPage`, `ReminderRuleListPage`, `ReminderRuleFormPage`, `OptOutListPage`
- components/: `AudiencePicker` (reusable, with debounced segment preview), wizard step components, status badges, quiet-hours notice, DLT warning
- hooks/: `useMarketingCampaign`, `useCampaignWizard`, `useReminderRules`, `useSegmentPreview`
- nav entry under `marketing.read` perm
- i18n keys → `src/lib/translations.{en,hi}.ext27.ts`
- Opt-out chip on Party rows (small touch on existing party feature)

**Acceptance:** see `.claude/design-plan-active.md` (frontend section). 4 UI states + 320px + i18n + ≤250 LOC + entityType/entityLabel on every mutation.

**Resume command:** continue Agent `DudhHisaab-Frontend-Builder` (path is HisaabPro) with the prompt drafted earlier — pages + components + nav + i18n + opt-out chip + commit + push.

**Render env to set before launch endpoint goes live:** `MARKETING_ENABLED=true`, `AISENSY_WEBHOOK_SECRET`, `AISENSY_API_KEY`, `MSG91_WEBHOOK_TOKEN`.

---

### 2. Phase 5 Epic B — Sales workflow
Roadmap items: #122 sales pipeline · #133 BOGO/free items · #132 multiple price lists · #134 invoice custom fields.

Run `/start-epic phase-5-sales-workflow` — full ceremony (scope-writer → architect → BE → FE).

Notes:
- #122 partially exists already (estimate→sale-order→delivery→invoice models present in schema; check if conversion flow shipped). Audit before designing.
- #132 must integrate with party-wise pricing already in place (don't duplicate).
- #133 needs invoice line schema additive col (`isFreeItem Boolean`).
- #134 schema: `BusinessCustomFieldDef` + `DocumentCustomFieldValue` per-business JSONB.

---

### 3. Phase 5 Epic C — Customer-facing
#121 online store / digital catalog · #129 UPI on invoice · #130 web invoice links · #131 invite parties.

Notes:
- #121 is HIGH complexity — separate public-facing route surface, no auth, rate-limited. May warrant standalone epic.
- #130 needs signed token (HMAC) on share URL with expiry. Security review required.
- #129 — adapt DudhHisaab UPI QR component (per CLAUDE.md reuse rule).
- #131 — invite link issues a one-shot signup token bound to businessId.

---

### 4. Phase 5 Epic D — CRM + loyalty
#125 loyalty/rewards · #127 CRM basics · #128 staff performance & commission.

Notes:
- #125 schema: `LoyaltyProgram`, `LoyaltyLedger`. Points accrue on POS sale (hook into existing pos-checkout commit flow).
- #127 reuses Party model — just adds `tags`, `lastContactedAt`, `followUpAt`, `notes` (some may exist).
- #128 reuses staff/role infra; commission rule per-product or per-category.

---

### 5. Phase 6 — Staff & HR (6 features)
- #135 Staff attendance (clock-in/out, geofence optional)
- #136 Payroll
- #137 Salary slips (PDF)
- #138 Multi-firm management (tenant switcher within one user)
- #139 Advanced audit trail (who changed what, when)
- #140 Transaction PIN (4-digit PIN gate on sensitive actions)

#138 touches User model + auth → mandatory `scope-writer → architect → security`.
#139 may extend existing audit log infra (search `services/audit*` first).
#140 reuses biometric gate pattern from DudhHisaab.

---

### 6. Phase 7 — AI & Differentiators (9 remaining; #141 OCR done)
- #142 Voice entry (browser SpeechRecognition + on-device fallback)
- #143 WhatsApp bot billing (Aisensy inbound webhook → invoice draft)
- #144 Smart GST filing assistant (build on Phase 3 GST data)
- #145 Industry vertical modes (preset templates per trade)
- #146 Predictive analytics (sales/stock forecast)
- #147 Auto-reconciliation (bank statement → payment match)
- #148 Smart inventory (reorder suggestions based on velocity)
- #149 Competitor data importers (Tally/Vyapar import)
- #150 Real-time multi-user collaboration (presence + conflict resolution)

Highest leverage: #143 (lock-in), #146 (margin story), #149 (acquisition).
Highest risk: #150 (CRDT or LWW — needs architecture spike).

---

### 7. Phase 1 cred-blocked unlocks (when keys land)
Razorpay · Aisensy (also unblocks Epic A webhooks) · Resend · FCM · Capacitor biometric.

### 8. Phase 3 deferred
#89 Bank Reconciliation — was deferred from Phase 3, fits naturally with Phase 7 #147.

---

### 9. Per-vertical depth (audit 2026-05-09)

Verticals are wired (nav filtering, terminology, defaults, Jobs flow, Custom Orders flow). Gap is **depth per vertical**, not coverage. Candidates:

| Epic | Verticals | Effort | Notes |
|---|---|---|---|
| **V1 — Services time tracking on Jobs** | services, freelancer, salon, clinic | ~1 wk | Add `hoursEstimated`, `hoursActual`, `ratePerHour` on Job; hour-based invoice line type. Plumber/freelancer cannot bill hourly today. |
| **V2 — Appointments calendar** | salon, clinic | ~2 wks (HIGH) | New `Appointment` model + slot picker + availability view + link to Job. Onboarding blocker for salon/clinic. |
| **V3 — Recipe cost dashboard** | restaurant, bakery, manufacturing | ~3 days | Derive cost-per-unit from existing BOM data. UI-only; no schema. Quick win. |
| **V4 — Staff assignment + commission split** | services, bakery, tailor, manufacturing | ~2 wks | Assign staff to Jobs/Orders/POS sales; commission rules per product/category. Overlaps Phase 6 #128. |
| **V5 — Customer delivery reminders** | bakery, tailor | ~3 days | Auto-trigger marketing-comms reminder N hours before delivery slot. Requires Epic A live. |
| **V6 — Table management + KOT** | restaurant | LARGE | Out of MSME billing scope. Defer to v2 product. |
| **V7 — Prescription field** | pharmacy, clinic | trivial | Likely solvable today via generic custom fields. Validate before scoping. |

Sequencing recommendation (after Phase 5 Epic A merges):
1. V3 (3 days, no schema, big restaurant/bakery win)
2. V1 (1 wk, unblocks hourly billing — biggest current user complaint)
3. V5 (3 days, depends on Epic A)
4. V2 (2 wks, salon/clinic onboarding)
5. V4 (2 wks, overlaps Phase 6 Staff & HR — fold together)

V1, V2, V4 touch schema → mandatory `scope-writer → architect → (security if billing path) → task-manager` ceremony.

---

## Open files to remember
- `.claude/design-plan-active.md` — currently approved for `phase5-marketing-comms`. Stays valid while Epic A FE wraps. Replace before starting Epic B.
- `docs/SCOPE_phase5_marketing_comms.md` · `docs/ARCHITECTURE_phase5_marketing_comms.md` · `docs/SECURITY_AUDIT_phase5_marketing_comms.md`

## Quick commands
- Resume Epic A FE: continue the marketing FE build from scaffolding.
- Start Epic B: `/start-epic phase-5-sales-workflow`
- Roadmap: `docs/ROADMAP.md` — keep in sync after every epic.
