/** Label Sheet Preview — HTML grid renderer for on-screen + window.print() preview
 *
 * Uses BarcodeDisplay SVG (DOM-safe). LabelPDF handles the React-PDF path.
 * Memoised by (format, template, items, qtyMap) to avoid re-renders on unrelated state.
 */

import { useMemo, memo } from 'react'
import { BarcodeDisplay } from '../components/BarcodeDisplay'
import { SHEETS, expandToCells, paginateCells } from './label-layout'
import { formatProductPrice } from '../product.utils'
import type { LabelItem, LabelTemplate, SheetFormat } from './label-print.types'

interface LabelSheetPreviewProps {
  items: LabelItem[]
  qtyMap: Record<string, number>
  sheetFormat: SheetFormat
  templateOverride: LabelTemplate | 'per-product'
}

function resolveTemplate(item: LabelItem, override: LabelTemplate | 'per-product'): LabelTemplate {
  return override === 'per-product' ? item.template : override
}

interface CellProps {
  item: LabelItem
  template: LabelTemplate
  cellW: number
  cellH: number
}

function LabelCellInner({ item, template, cellW, cellH }: CellProps) {
  const showBarcode = !!item.barcode && !!item.barcodeFormat
  const showName   = template === 'standard'
  const showPrice  = template === 'standard' || template === 'compact'

  return (
    <div
      className="label-cell"
      style={{ width: `${cellW}mm`, height: `${cellH}mm` }}
      aria-label={item.name}
    >
      {showBarcode ? (
        <BarcodeDisplay
          value={item.barcode!}
          format={item.barcodeFormat!}
          compact
        />
      ) : (
        <span className="label-cell-no-barcode">No barcode</span>
      )}
      {showName && (
        <p className="label-cell-name">{item.name}</p>
      )}
      {showPrice && (
        <p className="label-cell-price">{formatProductPrice(item.salePrice)}</p>
      )}
    </div>
  )
}

const LabelCell = memo(LabelCellInner)

function LabelSheetPreviewInner({
  items,
  qtyMap,
  sheetFormat,
  templateOverride,
}: LabelSheetPreviewProps) {
  const spec = SHEETS[sheetFormat]

  const pages = useMemo(() => {
    const cells = expandToCells(items, qtyMap)
    return paginateCells(cells, spec)
  }, [items, qtyMap, spec])

  return (
    <div className="label-preview-root" role="region" aria-label="Label sheet preview">
      {pages.map((rows, pageIdx) => (
        <div
          key={pageIdx}
          className="label-sheet"
          data-format={sheetFormat}
          aria-label={`Page ${pageIdx + 1}`}
          style={{
            width: `${spec.page.w}mm`,
            minHeight: `${spec.page.h}mm`,
            padding: `${spec.margin}mm`,
          }}
        >
          {rows.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className="label-row"
              style={{ gap: `${spec.gap}mm`, marginBottom: rowIdx < rows.length - 1 ? `${spec.gap}mm` : 0 }}
            >
              {row.map((cell, colIdx) => (
                <LabelCell
                  key={`${pageIdx}-${rowIdx}-${colIdx}-${cell.id}`}
                  item={cell}
                  template={resolveTemplate(cell, templateOverride)}
                  cellW={spec.cell.w}
                  cellH={spec.cell.h}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export const LabelSheetPreview = memo(LabelSheetPreviewInner)
