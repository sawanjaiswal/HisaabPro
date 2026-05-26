/**
 * Phase 7 · 7.1D PR-D3 — S9 audit homogeneity assertion.
 *
 * Defends against parallel-array drift inside `emit*ImportedBatch`
 * helpers: a developer adds a new array to the batch shape and forgets
 * to push to it inside the chunk loop. The drift silently misaligns
 * the (id, sourceIndex, code) tuples in the audit ledger — replays
 * yield phantom rows.
 *
 * This is a tiny single-export module so the cap on `audit-emit.ts`
 * doesn't grow with every new entity in Phase 7. It also keeps the
 * import surface narrow for callers that ONLY need the assertion.
 *
 * Authority: SECURITY_AUDIT_PHASE7_IMPORT_7_1D.md §1 S9.
 */

/**
 * Throws when any pair of arrays in `arrays` has a different length.
 * Treats `{}` and `{a:[],b:[]}` as valid (vacuously homogeneous).
 */
export function assertEqualLengths(
  arrays: Record<string, ReadonlyArray<unknown>>,
): void {
  const entries = Object.entries(arrays)
  if (entries.length === 0) return
  const [firstName, firstArr] = entries[0]
  const want = firstArr.length
  for (const [name, arr] of entries) {
    if (arr.length !== want) {
      throw new Error(
        `audit-emit: parallel-array length mismatch — ${firstName}=${want} vs ${name}=${arr.length}`,
      )
    }
  }
}
