#!/usr/bin/env bash
#
# Activate a design plan for the high-risk-path gate.
#
# The gate (~/.claude/hooks/check-plan-required.cjs) reads exactly one file,
# .claude/design-plan-active.md, and that file is gitignored — so with two Claude
# sessions running, the second one to write it destroys the first one's plan with
# no history to recover from. This script makes .claude/plans/ the source of
# truth and design-plan-active.md a derived copy.
#
# Usage:
#   scripts/plan-activate.sh <feature>     # activate .claude/plans/<feature>.md
#   scripts/plan-activate.sh --list        # show available plans + what's active
#   scripts/plan-activate.sh <feature> -f  # activate even if the current active
#                                          # plan is unsaved (it is backed up)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLANS="$ROOT/.claude/plans"
ACTIVE="$ROOT/.claude/design-plan-active.md"

die() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

active_feature() {
  [ -f "$ACTIVE" ] || return 0
  sed -n 's/^feature:[[:space:]]*//p' "$ACTIVE" | head -1
}

if [ "${1:-}" = "--list" ] || [ $# -eq 0 ]; then
  echo "Plans in .claude/plans/:"
  for f in "$PLANS"/*.md; do
    [ -e "$f" ] || continue
    b="$(basename "$f" .md)"
    [ "$b" = "README" ] && continue
    printf '  %s\n' "$b"
  done
  printf '\nActive: %s\n' "$(active_feature || echo '(none)')"
  exit 0
fi

FEATURE="$1"
FORCE="${2:-}"
SRC="$PLANS/$FEATURE.md"
[ -f "$SRC" ] || die "No such plan: $SRC"

# Refuse to discard an active plan that is not already saved in .claude/plans/.
# This is the whole point of the script: the failure mode is silent data loss,
# and the only cheap defence is checking before the copy, not after.
if [ -f "$ACTIVE" ]; then
  CUR="$(active_feature)"
  if [ -n "$CUR" ] && [ "$CUR" != "$FEATURE" ]; then
    if ! [ -f "$PLANS/$CUR.md" ] || ! cmp -s "$ACTIVE" "$PLANS/$CUR.md"; then
      if [ "$FORCE" != "-f" ] && [ "$FORCE" != "--force" ]; then
        die "Refusing to overwrite the active plan '$CUR' — it differs from
.claude/plans/$CUR.md (or has never been saved there). Another session may be
mid-epic on it.

  Save it:  cp .claude/design-plan-active.md .claude/plans/$CUR.md
  Then:     scripts/plan-activate.sh $FEATURE
  Or:       scripts/plan-activate.sh $FEATURE -f   # backs up, then overwrites"
      fi
      BACKUP="$PLANS/$CUR.clobbered-$(date +%Y%m%d-%H%M%S).md"
      cp "$ACTIVE" "$BACKUP"
      printf '\033[33mforced — previous active plan saved to %s\033[0m\n' "$(basename "$BACKUP")"
    fi
  fi
fi

cp "$SRC" "$ACTIVE"
printf '\033[32mactive plan: %s\033[0m\n' "$FEATURE"
sed -n 's/^status:[[:space:]]*/  status: /p' "$ACTIVE" | head -1
