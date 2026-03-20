/** Godowns/Warehouses — Pure utility functions */

import type { Godown } from './godown.types'

/** Format stock quantity with Indian locale grouping */
export function formatStockQuantity(qty: number): string {
  return qty.toLocaleString('en-IN')
}

/** Get display label for a godown — appends "(Default)" if applicable */
export function getGodownLabel(godown: Godown): string {
  return godown.isDefault ? `${godown.name} (Default)` : godown.name
}

/** Truncate address to a preview string */
export function truncateAddress(address: string | null, maxLen = 60): string {
  if (!address) return ''
  return address.length > maxLen ? `${address.slice(0, maxLen)}...` : address
}
