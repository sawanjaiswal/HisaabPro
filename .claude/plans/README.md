# `.claude/plans/` — per-feature design plans

## The problem this directory solves

The high-risk-path gate (`~/.claude/hooks/check-plan-required.cjs`) reads exactly
one file: `<project>/.claude/design-plan-active.md`. That file is gitignored
(`.gitignore:59`), so it has no history.

With one Claude session that is fine. With two — one on a backend epic, one on a
design sweep — the second session to start writes its plan into that path and the
first session's plan is **gone**, unrecoverably. That happened on 2026-07-22:
the `scoped-prisma-shadow` plan was overwritten by `party-detail-mockup-parity`
while the backend session was mid-epic.

## The arrangement

- **`.claude/plans/<feature>.md` is the source of truth.** Tracked in git, one
  file per feature, they accumulate instead of replacing each other.
- **`.claude/design-plan-active.md` is a derived copy** of whichever plan is
  currently active. It stays gitignored. Treat it as a build artifact — never the
  only copy of anything.

Activating a plan:

```sh
./scripts/plan-activate.sh scoped-prisma-shadow
```

The script refuses to overwrite an active plan whose content is not already saved
in this directory, so a session switch can never silently discard the other
session's work. `--force` overrides it, deliberately noisy.

## Running two sessions at once

The gate is a single global slot; this directory makes switching cheap, it does
not make the slot concurrent. In practice:

- Only one session at a time can hold the gate. Whoever needs to edit a
  high-risk path activates their plan, makes the edit, and says so.
- **Most work does not need the gate at all.** Only the paths in
  `~/.claude/rules/HIGH_RISK_PATHS.md` (schema, auth, billing, env, admin,
  tenant-isolation, hook chain) trigger it. A design sweep over feature pages and
  components touches none of them, so a design session normally never needs to
  activate anything.
- Both sessions still share one `tsc` and one pre-commit run. Stage your own
  paths (`git add <files>`) rather than `git add -A`, or you will commit the
  other session's half-finished file.

## Frontmatter the gate requires

`status: approved` · `created:` (ISO, < 90 days) · `agents_invoked:` listing every
agent required by every matched pattern, each with `(output: <path>)` pointing at
a file that exists and is newer than `created:` minus 1h · an `acceptance:` block
with at least `backend:` or `frontend:`.
