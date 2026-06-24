// Generates .claude/ssot-index.json — the EXHAUSTIVE, machine-owned discovery
// layer. Derived purely from code (every exported symbol in the shared dirs +
// who imports it), so it cannot go stale. /inventory and the pre-Write surfacer
// read this to answer "does a module for X already exist?" without memory.
//
//   node scripts/ssot/index.mjs
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SHARED_DIRS } from "../../ssot.config.mjs";
import { walk, rel, exportsOf, ROOT } from "./scan.mjs";

const sharedFiles = SHARED_DIRS.flatMap((d) => walk(join(ROOT, d)));

// symbol -> { module, importers: [] }
const symbols = {};
for (const f of sharedFiles) {
  for (const name of exportsOf(f)) {
    symbols[name] = { symbol: name, module: rel(f), importers: [] };
  }
}

// Resolve importers across the whole src tree.
const allFiles = walk(join(ROOT, "src"));
for (const f of allFiles) {
  const src = readFileSync(f, "utf8");
  const importRe = /import\s+(?:type\s+)?\{([^}]+)\}/g;
  let m;
  while ((m = importRe.exec(src))) {
    for (const raw of m[1].split(",")) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (symbols[name] && symbols[name].module !== rel(f)) {
        symbols[name].importers.push(rel(f));
      }
    }
  }
}

const index = {
  generated: "run `node scripts/ssot/index.mjs` to refresh",
  sharedDirs: SHARED_DIRS,
  symbolCount: Object.keys(symbols).length,
  symbols: Object.values(symbols)
    .map((s) => ({ ...s, importers: [...new Set(s.importers)].sort() }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol)),
};

mkdirSync(join(ROOT, ".claude"), { recursive: true });
writeFileSync(
  join(ROOT, ".claude/ssot-index.json"),
  JSON.stringify(index, null, 2) + "\n"
);
console.log(
  `[ssot] index: ${index.symbolCount} shared symbols across ${SHARED_DIRS.length} dirs → .claude/ssot-index.json`
);
