# /session-handoff — Structured Session Pause & Resume

Capture full session state so the next conversation picks up exactly where you left off.

## Usage
```
/session-handoff              # Save current session state (pause)
/session-handoff resume       # Load last handoff and continue (resume)
```

## PAUSE Mode (default)

### Step 1 — Gather State
```bash
git branch --show-current
git status --short
git log --since="midnight" --oneline --name-only
git diff --stat
git diff --cached --stat
git stash list
cat .planning/loop-tasks.json 2>/dev/null || echo "No active task list"
cat .planning/loop-progress.log 2>/dev/null | tail -20 || echo "No progress log"
```

### Step 2 — Capture Context
1. What was the user working on?
2. What's done? (file paths)
3. What's in progress? (where exactly did you stop?)
4. What's blocked?
5. What's next? (priority order)
6. Key decisions made
7. Active plan (phase/gate?)
8. Gotchas discovered

### Step 3 — Write to `.planning/HANDOFF.md`

```markdown
# Session Handoff
**Saved**: [YYYY-MM-DD HH:MM]
**Branch**: [branch name]
**Working On**: [1-line summary]

## Status
- **Phase**: [planning / building / testing / reviewing / debugging]

## Completed This Session
- [x] [description] — `file:path`

## In Progress (WHERE I STOPPED)
- [ ] [description] — stopped at: [exact state]

## Blocked
- [description] — reason — needs

## Next Steps (in order)
1. [immediate next action — be specific]

## Key Decisions
- [decision]: [rationale]

## Gotchas & Warnings
- [thing that would surprise the next session]

## Context Files to Read First
1. [most important file]
```

### Step 4 — Confirm to user with summary.

## RESUME Mode

1. `cat .planning/HANDOFF.md` (fallback: RESUME_CHECKPOINT.md)
2. Verify branch and state match
3. Read context files from handoff
4. Present status summary and continue with first next step

## Auto-Handoff
If conversation is getting long, proactively suggest `/session-handoff`.