// ─── Permission Key Helpers ───────────────────────────────────────────────────

/**
 * Builds the canonical dot-separated permission key used throughout the app.
 * e.g. formatPermissionKey('invoicing', 'view') → "invoicing.view"
 */
export function formatPermissionKey(module: string, action: string): string {
  return `${module}.${action}`
}

/**
 * Splits a dot-separated key back into its module and action parts.
 * Unknown keys return empty strings so callers can filter gracefully.
 */
export function parsePermissionKey(key: string): {
  module: string
  action: string
} {
  const dotIndex = key.indexOf('.')
  if (dotIndex === -1) return { module: key, action: '' }
  return {
    module: key.slice(0, dotIndex),
    action: key.slice(dotIndex + 1),
  }
}

/**
 * Given a flat permissions array and a module key, counts how many of that
 * module's possible actions are granted compared to how many exist in the
 * provided allModuleActions list.
 *
 * @param permissions  - e.g. ["invoicing.view", "invoicing.create"]
 * @param moduleKey    - e.g. "invoicing"
 * @param totalActions - total number of actions for that module
 */
export function getPermissionCount(
  permissions: string[],
  moduleKey: string,
  totalActions: number,
): { granted: number; total: number } {
  const granted = permissions.filter((p) =>
    p.startsWith(`${moduleKey}.`),
  ).length
  return { granted, total: totalActions }
}
