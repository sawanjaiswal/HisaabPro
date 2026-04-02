# /loop-task — Fresh-Context Task Loop with Quality Gates

Execute a task list where each task runs in a fresh agent context. Has REAL quality gates, rollback on failure, overcook protection, and cost awareness.

## Usage
```
/loop-task                           # Interactive — asks what to build
/loop-task path/to/tasks.json        # Execute from task file
/loop-task --max 5                   # Limit to 5 iterations
/loop-task --dry-run                 # Show plan without executing
```

## Instructions

You are running an autonomous task loop. Follow these steps exactly:

### Step 1 — Load or Create Task List

**If task file provided**: Read it. Expected format:
```json
{
  "project": "Feature name",
  "tasks": [
    {
      "id": 1,
      "title": "Short description",
      "description": "Detailed spec of what to implement",
      "dependencies": [],
      "status": "pending",
      "quality_checks": ["tsc", "build", "test"],
      "files_to_touch": ["src/routes/feature.ts", "src/pages/Feature.tsx"]
    }
  ],
  "settings": {
    "max_iterations": 10,
    "quality_gates": ["tsc --noEmit", "npm run build"],
    "rollback_on_failure": true
  }
}
```

**If no file provided**: Ask the user what they want to build. Then:
1. Break it into atomic tasks (each completable in one agent session)
2. Identify dependencies between tasks
3. Define quality checks per task
4. Write the task file to `.planning/loop-tasks.json`
5. Show the task list to the user for approval before executing

### Step 2 — Pre-Loop Validation

Before starting the loop:
```bash
# Ensure clean git state
git status --porcelain
# If dirty, ask user to commit or stash first

# Verify quality gates pass BEFORE starting
npx tsc --noEmit
npm run build
# If either fails, STOP. Don't start a loop on a broken codebase.

# Create a safety branch
git checkout -b loop/[feature-name]-[timestamp]
```

### Step 3 — Execute Loop

For each pending task (in dependency order):

**3a. Select next task**
- Pick the highest-priority task whose dependencies are all "completed"
- If no task is eligible (all blocked by dependencies), report deadlock and stop

**3b. Dispatch fresh agent**
Launch an Agent (subagent_type: general-purpose) with this prompt:
```
You are executing ONE task in a loop. Complete it and stop.

TASK: [title]
DESCRIPTION: [description]
FILES TO TOUCH: [files_to_touch]

CONTEXT:
- Project: /Users/sawanjaiswal/Projects/HisaabPro
- Project rules: Read CLAUDE.md for all coding standards
- Previously completed tasks: [list completed task titles]
- Progress log: Read .planning/loop-progress.log for context from previous iterations

INSTRUCTIONS:
1. Read ALL files you'll modify top-to-bottom before editing
2. Implement the task following project conventions
3. Run quality checks: [quality_checks]
4. If checks pass, report SUCCESS
5. If checks fail, report FAILURE with the error output

DO NOT:
- Touch files not listed in files_to_touch (unless absolutely necessary, explain why)
- Add features beyond the task description
- Refactor surrounding code unless the task requires it
- Skip quality checks

REPORT FORMAT:
STATUS: SUCCESS or FAILURE
FILES_MODIFIED: [list]
FILES_CREATED: [list]
QUALITY_CHECKS: [check]: PASS/FAIL
NOTES: [anything the next iteration should know]
```

**3c. Process agent result**

If SUCCESS:
```bash
# Verify quality gates independently (don't trust agent's self-report)
npx tsc --noEmit
npm run build

# If gates pass:
git add [modified files]
git commit -m "loop: [task title]

Task [id]/[total] — [description summary]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

# Update task status
echo "[timestamp] Task [id] COMPLETED: [title]" >> .planning/loop-progress.log
```

If FAILURE:
```bash
git checkout -- .  # Revert changes from failed task
echo "[timestamp] Task [id] FAILED: [error summary]" >> .planning/loop-progress.log
# If failed 2 times → skip task, log as BLOCKED, continue to next
# If 3 consecutive failures across any tasks → STOP LOOP, report to user
```

**3d. Overcook protection**
After each iteration, check:
- Total iterations > max_iterations? → STOP
- Same task failed 2x? → Mark BLOCKED, skip
- 3 consecutive failures? → STOP
- All tasks completed? → STOP (success)

### Step 4 — Post-Loop Report

```markdown
# Loop Execution Report

## Summary
- Feature: [name]
- Tasks: [completed]/[total] completed, [blocked] blocked, [pending] remaining
- Iterations: [count]/[max]
- Commits: [count]

## Task Results
| # | Task | Status | Commit |
|---|------|--------|--------|

## Blocked Tasks (need manual intervention)

## Next Steps
- [ ] Review commits on branch loop/[feature]
- [ ] Fix blocked tasks manually
- [ ] Merge branch when satisfied
```

### Step 5 — User Decision
Ask: "Loop complete. [N]/[total] tasks done on branch `loop/[feature]`. Options:
1. **Review** — walk through each commit
2. **Continue** — fix blocked tasks and resume
3. **Merge** — squash merge to current branch
4. **Discard** — delete the loop branch"

## Safety Rules
- ALWAYS create a safety branch
- ALWAYS verify quality gates independently
- ALWAYS rollback failed tasks
- ALWAYS stop after max_iterations
- ALWAYS stop after 3 consecutive failures