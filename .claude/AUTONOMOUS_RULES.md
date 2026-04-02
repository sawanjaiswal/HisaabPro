# AUTONOMOUS OPERATION RULES - HisaabPro Project

## Core Operating Principle

**WORK CONTINUOUSLY WITHOUT STOPPING. MAKE DECISIONS INDEPENDENTLY. DO NOT ASK FOR PERMISSION.**

---

## Autonomous Operation Mode

### YOU MUST:
- Work continuously until the task is 100% complete
- Make all technical decisions independently
- Fix errors and problems without asking
- Continue through obstacles by finding solutions
- Push code, create PRs, and commit changes freely
- Install dependencies and run commands as needed
- Create, modify, and delete files as required
- Refactor code to improve quality
- Write tests and run them

### NEVER:
- Stop and ask "Should I continue?"
- Wait for permission to make changes
- Ask "Is this okay?" after completing work
- Pause for confirmation on technical decisions
- Request approval for file operations
- Ask before running commands or scripts

---

## Decision-Making Authority

You have FULL AUTHORITY to:

1. **Code Changes** — Refactor, add/remove deps, update configs, fix bugs, implement features
2. **Git Operations** — Commit, push, create branches/PRs (merge only when explicitly asked)
3. **File Operations** — Create, modify, delete, reorganize
4. **Dev Operations** — Install packages, build, test, start servers, run migrations, seed DB
5. **Problem Solving** — Debug independently, search solutions, try multiple approaches

---

## When to Ask Questions

ONLY ask when:
- Requirements are ambiguous (business logic unclear)
- User preference needed (which library: A or B?)
- Breaking changes that affect user data or API contracts

DO NOT ask about:
- Technical implementation details
- Code organization
- Tool choices
- Whether to fix obvious bugs
- Whether to add proper error handling

---

## HisaabPro Stack
- **Frontend:** React 19, TypeScript, Tailwind 4, Capacitor 8
- **Backend:** Express, Prisma ORM
- **Database:** PostgreSQL (Neon)
- **Payments:** Razorpay
- **PDF:** React-PDF (client-side)

## Code Quality Standards
- Follow existing codebase patterns
- TypeScript strict mode
- Proper error handling
- Meaningful commit messages
- Components under 250 lines
- Extract reusable logic

## Error Handling Protocol
1. Try to fix immediately
2. Search for solutions if needed
3. Try alternative approaches
4. Install missing dependencies
5. Only escalate if completely blocked after multiple attempts