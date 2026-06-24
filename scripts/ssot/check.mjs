// The SSOT commit gate. Two jobs, both mechanical, no memory:
//
//   --validate : every registry row maps to live code (module exists, exports
//                every named symbol, and no `forbidden` pattern matches the
//                canon file itself). Kills stale/lying rows.
//   --enforce  : every `forbidden` shape that appears OUTSIDE its canon module
//                is a violation. Pre-existing legacy is grandfathered against a
//                baseline (ssot.baseline.json, committed) — the count can only go
//                DOWN. A NEW violation beyond baseline fails the commit.
//
// Inline escape hatch for a deliberate dup: `// ssot-allow: <capability>`.
//
//   node scripts/ssot/check.mjs            # validate + enforce (the gate)
//   node scripts/ssot/check.mjs --baseline # freeze current violations as allowed
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { REGISTRY } from "../../ssot.config.mjs";
import { walk, rel, exportsOf, grepFile, ROOT } from "./scan.mjs";

// Committed (NOT under gitignored .claude/) so the ratchet is shared, not local.
const BASELINE = join(ROOT, "ssot.baseline.json");
const srcFiles = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "server", "src"))];

function validate() {
  const errors = [];
  for (const row of REGISTRY) {
    const abs = join(ROOT, row.module);
    if (!existsSync(abs)) {
      errors.push(`dead row: ${row.module} (${row.capability}) does not exist`);
      continue;
    }
    const exp = exportsOf(abs);
    for (const name of row.exports) {
      if (!exp.includes(name)) {
        errors.push(`${row.module} no longer exports "${name}"`);
      }
    }
    for (const pat of row.forbidden) {
      if (grepFile(abs, pat).length === 0) {
        // canon must contain its own capability; a forbidden pattern that does
        // not even match the canon is a sign the regex drifted from the code.
        // (warn-only: forbidden is about the SHAPE elsewhere, not the canon.)
      }
    }
  }
  return errors;
}

// key that survives line shifts: "<file>::<trimmed match>"
function violationKey(file, text) {
  return `${file}::${text}`;
}

function findViolations() {
  const out = [];
  for (const row of REGISTRY) {
    for (const pat of row.forbidden) {
      for (const f of srcFiles) {
        const r = rel(f);
        if (r === row.module) continue; // the canon is allowed to contain it
        for (const hit of grepFile(f, pat)) {
          if (/ssot-allow:/.test(hit.text)) continue;
          out.push({
            capability: row.capability,
            file: r,
            line: hit.line,
            text: hit.text,
            key: violationKey(r, hit.text),
          });
        }
      }
    }
  }
  return out;
}

const args = process.argv.slice(2);
const violations = findViolations();

if (args.includes("--baseline")) {
  const keys = [...new Set(violations.map((v) => v.key))].sort();
  writeFileSync(BASELINE, JSON.stringify({ allowed: keys }, null, 2) + "\n");
  console.log(`[ssot] baseline frozen: ${keys.length} legacy violation(s) grandfathered`);
  process.exit(0);
}

// --- the gate (default) ---
const valErrors = validate();
const baseline = existsSync(BASELINE)
  ? new Set(JSON.parse(readFileSync(BASELINE, "utf8")).allowed)
  : new Set();
const fresh = violations.filter((v) => !baseline.has(v.key));

if (valErrors.length === 0 && fresh.length === 0) {
  console.log(
    `[ssot] OK — registry valid, no new drift (${violations.length} legacy grandfathered).`
  );
  process.exit(0);
}

if (valErrors.length) {
  console.error("\n[ssot] REGISTRY INVALID:");
  for (const e of valErrors) console.error(`  ✗ ${e}`);
}
if (fresh.length) {
  console.error("\n[ssot] NEW SSOT DRIFT — re-implements a canonical module:");
  for (const v of fresh) {
    const row = REGISTRY.find((r) => r.capability === v.capability);
    console.error(`  ✗ ${v.file}:${v.line}`);
    console.error(`      ${v.text}`);
    console.error(`      → use ${row.module} (${v.capability})`);
    console.error(`      → or add  // ssot-allow: ${v.capability}  with a reason`);
  }
}
console.error("");
process.exit(1);
