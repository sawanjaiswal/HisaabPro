// Renders docs/SSOT.md from ssot.config.mjs (the machine-authoritative registry).
// Never hand-edit docs/SSOT.md — edit ssot.config.mjs and re-run this.
//   node scripts/ssot/doc.mjs
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { REGISTRY, SHARED_DIRS } from "../../ssot.config.mjs";
import { ROOT } from "./scan.mjs";

const rows = REGISTRY.map((r) => {
  const guard = r.forbidden.length ? "✅ guarded" : "discovery-only";
  return `| ${r.capability} | \`${r.module}\` | ${r.exports
    .map((e) => `\`${e}\``)
    .join(", ")} | ${guard} |`;
}).join("\n");

const guardDetail = REGISTRY.filter((r) => r.forbidden.length)
  .map(
    (r) =>
      `### ${r.capability}\n` +
      `Canon: \`${r.module}\`\n\n` +
      `Forbidden elsewhere (commit-blocked):\n` +
      r.forbidden.map((f) => `- \`/${f}/\``).join("\n") +
      `\n\n${r.note}\n`
  )
  .join("\n");

const md = `# SSOT Registry

> Generated from \`ssot.config.mjs\` by \`scripts/ssot/doc.mjs\`. Do not hand-edit.
> Check here FIRST before writing any shared util/service/hook.

Shared dirs scanned: ${SHARED_DIRS.map((d) => `\`${d}\``).join(", ")}.
Exhaustive symbol index (auto, never stale): \`.claude/ssot-index.json\`
(\`node scripts/ssot/index.mjs\`).

## Canonical modules

| capability | canonical module | exports | enforcement |
|---|---|---|---|
${rows}

## How it's enforced (no memory)

1. **Discovery** — \`.claude/ssot-index.json\` is generated from code; \`/inventory\`
   + the pre-Write surfacer read it so you never rebuild an existing module blind.
2. **Commit gate** — \`node scripts/ssot/check.mjs\` validates every row maps to
   live code and blocks any \`forbidden\` shape re-implemented outside its canon.
3. **Ratchet** — pre-existing legacy is grandfathered in \`ssot.baseline.json\` (committed);
   the violation count can only go DOWN. New drift fails the commit.
4. **Escape hatch** — \`// ssot-allow: <capability>\` (with a reason) for a
   deliberate, reviewed exception.

## Guarded capabilities

${guardDetail}
`;

writeFileSync(join(ROOT, "docs/SSOT.md"), md);
console.log("[ssot] rendered docs/SSOT.md");
