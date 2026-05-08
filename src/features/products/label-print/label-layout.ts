/** Label Layout — pure sheet math constants and helpers (no React, no DOM) */

import type { SheetFormat, LabelItem } from './label-print.types'

// ─── Sheet specifications (all dimensions in mm) ──────────────────────────────

export interface SheetSpec {
  page:   { w: number; h: number }
  cols:   number
  rows:   number
  cell:   { w: number; h: number }
  gap:    number
  margin: number
  pageLabel: string
}

export const SHEETS: Record<SheetFormat, SheetSpec> = {
  THERMAL_40x30: {
    page:     { w: 40, h: 30 },
    cols:     1,
    rows:     1,
    cell:     { w: 38, h: 28 },
    gap:      0,
    margin:   1,
    pageLabel: 'Thermal 40×30mm',
  },
  A4_3x8: {
    page:     { w: 210, h: 297 },
    cols:     3,
    rows:     8,
    cell:     { w: 65, h: 35 },
    gap:      2,
    margin:   6.5,
    pageLabel: 'A4 — 24 per sheet',
  },
  A5_2x5: {
    page:     { w: 148, h: 210 },
    cols:     2,
    rows:     5,
    cell:     { w: 69, h: 40 },
    gap:      2,
    margin:   4,
    pageLabel: 'A5 — 10 per sheet',
  },
}

/** 1mm = 2.83465pt — for React-PDF which uses points */
export const MM_TO_PT = 2.83465

export function pt(mm: number): number {
  return Math.round(mm * MM_TO_PT * 100) / 100
}

// ─── Cell expansion ───────────────────────────────────────────────────────────

/**
 * Expand label items by their qty map into a flat array of cells.
 * A product with qty=3 occupies 3 consecutive cells.
 */
export function expandToCells(
  items: LabelItem[],
  qtyMap: Record<string, number>,
): LabelItem[] {
  return items.flatMap((item) => {
    const qty = Math.max(1, Math.min(99, qtyMap[item.id] ?? 1))
    return Array.from({ length: qty }, () => item)
  })
}

// ─── Page count ───────────────────────────────────────────────────────────────

export function pageCount(cells: number, spec: SheetSpec): number {
  const perPage = spec.cols * spec.rows
  return Math.max(1, Math.ceil(cells / perPage))
}

/** Split flat cell array into pages then rows within each page. */
export function paginateCells(cells: LabelItem[], spec: SheetSpec): LabelItem[][][] {
  const perPage = spec.cols * spec.rows
  const pages: LabelItem[][][] = []
  for (let p = 0; p < cells.length; p += perPage) {
    const pageSlice = cells.slice(p, p + perPage)
    const rows: LabelItem[][] = []
    for (let r = 0; r < pageSlice.length; r += spec.cols) {
      rows.push(pageSlice.slice(r, r + spec.cols))
    }
    pages.push(rows)
  }
  return pages.length ? pages : [[[]]]
}
