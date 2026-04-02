---
description: Smart router — classifies task complexity and routes to the right model + workflow
---

# /do — Smart Task Router

Classify the user's command and route efficiently.

**Command:** $ARGUMENTS

## Step 1 — Classify

Read the command and classify:

| Class | Criteria | Model | Approach |
|-------|----------|-------|----------|
| **MECHANICAL** | rename, delete, move, format, add import, fix typo, translation, grep, remove console.log, add aria-label, lint fix | Skip AI — run script | `node scripts/enforce.js` or direct Bash/Edit |
| **SIMPLE** | 1-3 file change, no API, no DB, CSS tweak, constant change, copy fix | haiku subagent | Agent with model: "haiku" |
| **CODE** | build feature, refactor, fix bug, add endpoint, write test, component | sonnet subagent | Agent with model: "sonnet" |
| **ARCHITECTURE** | design, security audit, threat model, migration, system design, plan | main (opus) | Handle directly |

## Step 2 — Route

### MECHANICAL
Do NOT spawn an agent. Run the command directly:
- Lint fix → `node scripts/enforce.js --fix`
- Rename → Edit tool directly
- Remove console.log → `node scripts/fixers/fix-console-log.js`
- Health check → `node scripts/health-report.js`

### SIMPLE
Spawn ONE haiku agent with a clear, specific prompt. Example:
```
Agent(model: "haiku", prompt: "In /Users/sawanjaiswal/Projects/HisaabPro, rename X to Y. Update all imports. Run tsc --noEmit to verify.")
```

### CODE
Spawn ONE sonnet agent. Include context:
```
Agent(model: "sonnet", prompt: "In /Users/sawanjaiswal/Projects/HisaabPro, [task]. Follow CLAUDE.md rules. Run node scripts/enforce.js after code changes.")
```

### ARCHITECTURE
Handle in main conversation (opus). Use /f for features, direct analysis for reviews.

## Step 3 — Post-Route

After completion, ALWAYS run:
```bash
node scripts/enforce.js --fix
```
This catches anything the agent missed. Zero tokens, 15 seconds.

## Rules
- NEVER use opus subagents (main conversation is already opus)
- NEVER spawn more than 1 subagent for /do
- If the task is ambiguous, default to SIMPLE (haiku) — cheaper to retry than to overspend
- Always run enforce.js as the last step