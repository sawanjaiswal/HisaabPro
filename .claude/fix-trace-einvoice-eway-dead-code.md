---
symptom: BACKLOG item 6 flagged src/features/e-invoice/* and src/features/e-way-bill/* (5 files) as a design-system violation needing a full rebuild (raw hex, hand-rolled sheet, ~14 missing i18n keys)
root_cause_file: src/features/e-invoice/**, src/features/e-way-bill/** (entire module)
root_cause_reason: these two folders are orphaned dead code from before the i18n/design-token standardization pass — the app's real e-invoice/e-way-bill UI lives at src/features/documents/components/{EInvoiceCard,EWayBillCard,ComplianceCancelForm,EWayBillGenerateForm,EWayBillPartBForm}.tsx, wired into EComplianceSection.tsx, and already fully complies with the design system. "Fixing" the flagged files would have patched code that never renders.
---
## 5-whys
1. Why did the audit flag these 5 files as needing a rebuild? — they contain raw hex colors, a hand-rolled bottom sheet instead of `<Drawer>`, and hardcoded English strings with no `t.*` keys.
2. Why does live-app behavior not show these violations to users? — because these components are never imported by any route, page, or the actual compliance UI (`EComplianceSection.tsx`) — confirmed via `grep -rl "EInvoiceCard\|EWayBillCard" src` returning only `EComplianceSection.tsx`, which imports from `./EInvoiceCard` / `./EWayBillCard` relative to `documents/components/`, not from `e-invoice/` or `e-way-bill/`.
3. Why do two parallel implementations exist? — `git log` shows `documents/components/*` was introduced by `7095be5 feat: full i18n compliance + design system standardization across all features` and `991a930 refactor(design): P1 button codemod`, i.e. a rewrite. The old `e-invoice/`/`e-way-bill/` folders were never deleted when the rewrite landed.
4. Why wasn't the old module deleted at rewrite time? — no evidence of intent to keep both; this looks like an oversight during the rewrite/migration, not a deliberate parallel-implementation decision.
5. Why did a UI/UX audit flag the dead files instead of the live ones? — the audit tool/process walked the feature directory tree by grep for raw hex/hardcoded strings without first confirming which files are actually reachable from a route — a process gap (unrelated to design-system logic itself), not a code defect.

## Hypothesis
The correct "fix" for item 6 is not a rebuild — it's deleting the orphaned `src/features/e-invoice/` and `src/features/e-way-bill/` directories entirely (0 external references confirmed), since the live implementation at `src/features/documents/components/` already meets every checklist item (PAGE_AUDIT_CHECKLIST.md — tokens, `<Button>`, i18n) that the dead code was flagged for violating.

## Verification
- `grep -rln "features/e-invoice\|features/e-way-bill" src` outside those two folders → zero matches (dead code, confirmed unreachable).
- Live components (`documents/components/EInvoiceCard.tsx`, `EWayBillCard.tsx`, `ComplianceCancelForm.tsx`, `EWayBillGenerateForm.tsx`, `EWayBillPartBForm.tsx`) — grepped for raw hex/`rgba(`/`window.confirm`/`alert(` → zero matches; all use `t.*` translation keys (18-30 occurrences each).
- FE tsc clean after deletion.
- `node scripts/enforce.js` clean after deletion.
