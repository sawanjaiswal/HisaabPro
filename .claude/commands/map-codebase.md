# /map-codebase — Comprehensive Codebase Analysis

Analyze the current codebase using 4 parallel agents. Produces a complete picture of stack, architecture, conventions, and concerns.

## Usage
```
/map-codebase              # Full analysis (all 4 agents)
/map-codebase quick        # Fast mode (1 agent, summary only)
```

## Instructions

### Step 1 — Create Output Directory
```bash
mkdir -p .planning/codebase
```

### Step 2 — Dispatch 4 Parallel Agents

Launch ALL 4 agents simultaneously using the Agent tool.

**Agent 1: Stack Analyzer** (subagent_type: Explore)
- Languages, versions (package.json, tsconfig)
- Frameworks with exact versions
- Database (Prisma schema, migrations)
- External services and APIs
- Build tools, testing frameworks, CI/CD
- Write to: `.planning/codebase/STACK.md`

**Agent 2: Architecture Analyzer** (subagent_type: Explore)
- Directory structure (top 3 levels, annotated)
- Application boundaries (server, frontend, shared)
- API structure, data flow, auth flow
- Database schema, shared code, entry points
- Write to: `.planning/codebase/ARCHITECTURE.md`

**Agent 3: Conventions Analyzer** (subagent_type: Explore)
- File naming, component patterns, error handling
- Validation, import, styling, state, API call patterns
- Testing, logging, config patterns
- Check CLAUDE.md, .eslintrc, prettier, tsconfig
- Write to: `.planning/codebase/CONVENTIONS.md`

**Agent 4: Concerns Analyzer** (subagent_type: Explore)
- Large files (>250 lines), type safety gaps
- Security concerns, performance risks
- Dead code, dependency risks, missing tests
- TODO/FIXME/HACK comments
- Write to: `.planning/codebase/CONCERNS.md`

### Step 3 — Verify & Generate Summary
Verify all 4 files exist. Read all and write unified `.planning/codebase/SUMMARY.md` with quick stats, architecture summary, key conventions, top concerns, recommended reading order.

### Step 4 — Report to User
Print concise summary. Highlight top 3 concerns.

## Quick Mode
If "quick" passed, use single Explore agent → only SUMMARY.md.