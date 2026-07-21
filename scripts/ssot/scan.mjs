// Pure scan helpers for the SSOT toolkit. No side effects beyond reading files.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const ROOT = process.cwd();

// Recursively list source files under a dir (skips node_modules/dist/.next).
export function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next" || name === "dist") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|mjs|js)$/.test(name) && !/\.test\.|\.d\.ts$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

export function rel(p) {
  return relative(ROOT, p).split("\\").join("/");
}

// Extract exported symbol names from a source file.
//
// Two forms, both of which are part of a module's real export surface:
//   1. declaration exports — `export function foo`, `export class Bar`
//   2. export lists / re-exports — `export { A, B as C }`,
//      `export type { D } from './d'`
//
// Form 2 matters because splitting an oversized module keeps its public
// surface intact by re-exporting from the new file. Recognising only form 1
// would report a symbol as "no longer exported" purely because it moved.
export function exportsOf(file) {
  const src = readFileSync(file, "utf8");
  const names = new Set();

  const declRe =
    /export\s+(?:async\s+)?(?:function|const|class|interface|type)\s+([A-Za-z0-9_]+)/g;
  let m;
  while ((m = declRe.exec(src))) names.add(m[1]);

  const listRe = /export\s+(?:type\s+)?\{([^}]*)\}/g;
  while ((m = listRe.exec(src))) {
    for (const entry of m[1].split(",")) {
      // `X as Y` exports the name Y; a bare `X` exports X.
      const name = entry.trim().split(/\s+as\s+/).pop()?.trim();
      if (name && /^[A-Za-z0-9_]+$/.test(name)) names.add(name);
    }
  }

  return [...names];
}

// Every line in `file` matching `pattern` (RegExp source string), with line nums.
export function grepFile(file, patternSrc) {
  const src = readFileSync(file, "utf8");
  const re = new RegExp(patternSrc);
  const hits = [];
  src.split("\n").forEach((line, i) => {
    if (re.test(line)) hits.push({ line: i + 1, text: line.trim() });
  });
  return hits;
}
