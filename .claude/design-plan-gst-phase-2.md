---
status: approved
feature: gst-phase-2
created: 2026-05-03T23:51:00Z
approver: Sawan
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
  - server/src/lib/env.ts
  - server/src/config/secrets.nic.ts
  - server/src/services/einvoice/einvoice.service.ts
  - server/src/services/ewaybill/ewaybill.service.ts
agents_invoked:
  - scope-writer (output: docs/SCOPE_gst_phase_2.md)
  - architect (output: docs/ARCHITECTURE_gst_phase_2.md)
  - security (output: docs/SECURITY_AUDIT_gst_phase_2.md)
  - task-manager (output: docs/TASKS_gst_phase_2.md)
acceptance:
  backend:
    - tsc clean across server + client
    - all 22 curl proofs collected (per Architecture §12)
    - all 5 security MB curl proofs collected (per Security §12)
  frontend:
    - all screenshots: loading, error, empty, success per new screen
    - 320px verified on all new screens
    - dark theme verified across all new screens
---

# GST Phase 2 (v7) — Approved Design Plan

## Overview

Complete GST billing for HisaabPro v7: schema (6 fields), tax engine (inclusive, RCM, composition), invoice form UI (tax picker, HSN search, place-of-supply), templates (GST blocks), backfill wizard, e-invoice (NIC IRP), e-way bill (NIC EWB), GSTR-1/3B export, all behind opt-in gate with full audit trail.

**12 PRs, critical path 92 hours with parallelization, shipped as feature-complete in a single v7 release.**

## Design Documents (Approved)

1. **SCOPE** (`docs/SCOPE_gst_phase_2.md`): approved 2026-05-03, all user-facing features, personas, API contracts, UX copy
2. **ARCHITECTURE** (`docs/ARCHITECTURE_gst_phase_2.md`): approved 2026-05-03, 12-PR phasing, service layer, schema migration, frontend state, acceptance gates
3. **SECURITY** (`docs/SECURITY_AUDIT_gst_phase_2.md`): approved 2026-05-03 with 5 merge-blockers MB-1..MB-5, OWASP coverage, NIC credential handling, multi-tenant isolation
4. **TASKS** (`docs/TASKS_gst_phase_2.md`): per-PR decomposition, 22 backend curl proofs, screenshot requirements, risk register, proof-gate matrix

## PR Sequence (per Architecture §10)

| # | Branch | Title | Hours | Depends | Status |
|---|--------|-------|-------|---------|--------|
| 1 | `gst/schema-migration` | gst(schema): add 6 GST fields + UQC seed | 4 | — | pending |
| 2 | `gst/settings-optingate` | gst(settings): enable GST opt-in, auto-flip on GSTIN save | 8 | 1 | pending |
| 3 | `gst/tax-engine` | gst(tax): backCalculateInclusive + RCM + composition helpers | 12 | 1, 2 | pending |
| 4 | `gst/invoice-form-ui` | gst(invoice-form): per-line tax picker + HSN typeahead + POS | 16 | 3 | pending |
| 5 | `gst/templates-gst-blocks` | gst(templates): add gstTaxSummary + gstDeclaration flags | 12 | 1, 4 | pending |
| 6 | `gst/composition-rcm` | gst(composition-rcm): composition scheme + RCM advisory | 8 | 4, 5 | pending |
| 7 | `gst/backfill-wizard` | gst(backfill): 5-step wizard + preview/execute endpoints | 16 | 3 | pending |
| 8 | `gst/einvoice-nic-irp` | gst(einvoice): NIC IRP service, MB-1..MB-5 | 24 | 1, 4, Security | pending |
| 9 | `gst/ewaybill-nic-ewb` | gst(ewaybill): NIC EWB service, MB-1..MB-5 | 16 | 1, 4, Security | pending |
| 10 | `gst/gstr1-export` | gst(gstr1): 8 builders + JSON/CSV export | 16 | 3, 6 | pending |
| 11 | `gst/gstr3b-summary` | gst(gstr3b): 11-row summary + export | 8 | 3, 6 | pending |
| 12 | `gst/polish-release` | gst(release): 320px audit, dark theme, remove feature flag | 8 | 1–11 | pending |

## Critical Path & Parallelization

- **Week 1 (PRs 1–4):** 40 hrs, sequential foundation (schema → settings → tax → form)
- **Week 2 (PRs 5, 7, 8):** 40 hrs, parallel (templates + backfill + e-invoice with Security review)
- **Week 3 (PRs 9, 6, 10):** 40 hrs (e-way bill + composition + GSTR-1)
- **Week 4 (PRs 11, 12):** 20 hrs (GSTR-3B + polish + ship)
- **Total:** 92 hours (with 3-way parallelization PRs 5/7/8 and 2-way PRs 9/6/10)

## Key Locked Decisions

| Decision | Value | Rationale |
|----------|-------|-----------|
| **Opt-in gate** | `Business.gstEnabled` Boolean | Single source of truth, auto-flips on GSTIN save |
| **Money invariant** | all paise (integers), rates in basis points | Prevents floating-point drift, NIC contract compliance |
| **Idempotency** | unique keys (EInvoice.documentId, EWayBill.documentId) | Prevents double-IRN/double-EWB on 3G retry |
| **Offline policy** | E-invoice/EWB/GSTR export MUST be online | IRN/EWB are NIC-issued, cannot be forged client-side |
| **NIC credentials** | env vars only (never hardcoded) | Security gate: rotation runbook, no code deploys needed |
| **NIC base URLs** | hardcoded consts in nic-client files | Prevents SSRF via env-derived URL |
| **Merge-blockers** | 5 curl proofs (MB-1..MB-5) before PRs #8, #9 | Security review gates all NIC integrations |

## Merge Gate Checklist

**Per-PR merge requires:**
- [ ] Code review against design docs (SCOPE, ARCHITECTURE, SECURITY, TASKS)
- [ ] `npm run enforce` clean (ESLint, patterns, money invariant)
- [ ] `tsc --noEmit` clean (server + client)
- [ ] Pre-commit hook passes
- [ ] Backend curl proofs collected (referenced in PR description)
- [ ] Frontend screenshots collected (markdown table in PR description)
- [ ] If high-risk path touched (PRs #1, #2, #8, #9): security review sign-off
- [ ] No new OFFLINE_RULES violations (Rules 1–5)

**Final v7 release merge:**
- [ ] All 12 PRs merged
- [ ] All 22 backend curl proofs on file (linked in release notes)
- [ ] All ~70 frontend screenshots on file (organized by screen + state + theme + breakpoint)
- [ ] Deployment guide (`docs/GST_v7_DEPLOYMENT.md`) written
- [ ] README updated with v7 feature summary
- [ ] CHANGELOG entry for v7.0.0
- [ ] No regressions in existing v6 invoicing (via integration tests)

---

*Approved by Sawan on 2026-05-03T23:51:00Z. Execute per TASKS document. No further design review required.*
