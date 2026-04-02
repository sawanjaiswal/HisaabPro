# /pr-review — Rule-Aware Code Review

Review staged or recent changes against project rules.

## Usage
```
/pr-review                 # Review uncommitted changes
/pr-review HEAD~1          # Review last commit
/pr-review HEAD~3..HEAD    # Review last 3 commits
/pr-review main..HEAD      # Review all commits on current branch
```

## Instructions

### Step 1 — Identify Changes

Determine what to review based on argument:
- No argument: `git diff` + `git diff --cached`
- Commit range: `git diff <range> --name-only` then `git diff <range>`

Categorize changed files: Backend (server/), Frontend (src/), Schema (prisma/), Config, Other.

### Step 2 — Dispatch 3 Parallel Review Agents

**Agent 1: Code Quality Review**
Read CLAUDE.md rules, then check:
- any / as any / @ts-ignore
- import type for type-only imports
- key={index} in JSX
- console.log in production
- File > 250 lines, function > 50 lines
- Hardcoded strings, missing useEffect cleanup
- Dead imports, missing error boundaries

**Agent 2: Security & API Review**
- Routes missing auth middleware / validation
- Missing ownership checks
- Secrets in responses
- Missing pagination, N+1 queries
- Missing DB transactions for multi-table writes

**Agent 3: Frontend & UX Review**
- Missing UI states (loading, error, empty, success)
- Missing ARIA labels, touch targets < 44px
- Desktop-first media queries
- Missing loading/disabled on submit buttons
- Hardcoded colors/px instead of variables/rem

### Step 3 — Cross-Boundary Check
1. API contract sync — response shape changes reflected in frontend?
2. Rename completeness — old name grep = 0 results?
3. Config SSOT — new literals already in config?

### Step 4 — Compile Report

```markdown
# PR Review — [date]

## Findings
### BLOCKERS (must fix)
### WARNINGS (should fix)
### INFO (consider)

### Cross-Boundary
- API contracts in sync: YES/NO
- Renames complete: YES/NO

## Verdict
READY TO MERGE / FIX BLOCKERS FIRST / NEEDS DISCUSSION
```

### Step 5 — Offer to fix blockers if any found.