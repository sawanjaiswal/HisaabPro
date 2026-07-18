# Golden Path — one feature, Phase 0→4, end to end

> The single worked example. When unsure how the workflow actually runs,
> pattern-match against this. Feature used: **"Add Expense" form page** — small
> enough to show every phase, real enough to be representative.

---

## Phase 0 — INIT (once per session)

```bash
touch /Users/sawanjaiswal/Projects/HisaabPro/.claude/design-session-active
```

Load `.claude/design-system.config.cjs`, then say:
> "Config loaded (N banned patterns, M components). Tokens ready."

## Phase 0.5 — INVENTORY SCAN

```bash
ls src/components/ui/          # → Button, Input, Card, Badge, Drawer, … (exist)
ls src/components/feedback/    # → EmptyState, ErrorState, Skeleton, Spinner
grep -rnE "variant:\s*['\"]" src/components/ui/Button.tsx   # confirm variants
```

Result pasted into the plan's `## Inventory`. Conclusion: Button/Input/Card/
ErrorState all exist. **Nothing new needs building.**

## Phase 0.75 — VARIANT-FIRST

No row maps to `NONE`. The amount field is the FIELD TEMPLATE "Amount Field"
(a raw number input by design exception, not a new component). No fork needed —
recorded in the plan.

## Phase 1 — ANALYZE (COMPONENT MAP)

| UI Element | Component | Props/Variant | Notes |
|------------|-----------|---------------|-------|
| Page shell | FORM PAGE template | `max-w-md mx-auto` | `page-templates.md` |
| Amount | Amount Field template | rupee prefix, block e/E/+/- | paise on wire |
| Category | Select (grid buttons) | 4 tinted options | icon-square tint |
| Note | Input | `maxLength={140}` | optional |
| Save | Button | `variant="primary" loading` | fullWidth |
| Error | ErrorState | `message` | top of form |

0 rows map to NONE → scope is right, proceed.

## Phase 2 — PLAN (gate)

Write `.claude/design-plan-active.md` with `status: draft`:

```markdown
---
status: draft
task: Add Expense form
createdAt: 2026-07-19T00:00:00Z
approvedAt:
---
## Checklist: Add Expense form
- [ ] src/features/expenses/expense-form.types.ts
- [ ] src/features/expenses/expense-form.constants.ts   # category options
- [ ] src/features/expenses/useExpenseForm.ts           # hook (validation+submit)
- [ ] src/features/expenses/components/CategorySelect.tsx
- [ ] src/features/expenses/AddExpensePage.tsx

## Design tokens
- Colors: --color-gray-50 (page), --color-primary-600 (CTA), --color-error-500
- Radius: --radius-md input, --radius-sm button
- FS: --fs-xl title, --fs-sm label, --fs-df body

## UI components: Button(primary,loading), Input, ErrorState, EmptyState(n/a)
## Translation keys: t.addExpense, t.amount, t.category, t.note, t.save, t.saving — EN + HI
## 4 UI states: submit-loading (button), error (ErrorState), empty (n/a form), success (toast+nav)
```

**Show the checklist. WAIT for user "approved".** Then rewrite with
`status: approved` + `approvedAt`. Only now do Phase-3 writes pass the gate.

## Phase 3 — BUILD (6-layer split, each ≤250 lines)

Scaffold stubs first (imports+exports), then fill. Order: types → constants →
hook → components → page. Copy the **FORM PAGE** skeleton from
`page-templates.md`; paste the **Amount Field** + **Select (grid buttons)**
templates; use the **HOOK SKELETON** for `useExpenseForm.ts`. Every string is
`t.*`; every colour a `var(--color-*)`; amount stored in **paise** (integer).

Offline (per `OFFLINE_RULES.md`): the submit calls `api('/expenses', { method:
'POST', body, entityType: 'expense', entityLabel: category })` and tolerates the
optimistic `{}` return — toast + invalidate, don't deref `.id`.

## Phase 4 — VERIFY (falsifiable close-out)

```bash
npx tsc -b --noEmit && echo "TSC_OK"
node scripts/enforce.js && echo "ENFORCE_OK"
node .claude/skills/hp-design/check-refs.mjs && echo "REFS_OK"
```

Then walk the POST-BUILD CHECKLIST in `SKILL.md`. **Done = all three `*_OK`
printed + every checklist box ticked + all 4 UI states present.** If any command
prints a non-baseline error, fix and re-run — never mark done on prose alone.

---

## What this example proves
- The gate is real: no `src/**` write lands until the plan is `approved`.
- Reuse-first: a whole feature shipped touching **zero** new UI primitives.
- Verify is a command, not a claim — the three `*_OK` lines are the proof.
