/** Label PDF — React-PDF Document for barcode label printing
 *
 * Uses canvas-encoded PNG barcodes (NOT BarcodeDisplay SVG — React-PDF has no DOM).
 * Consumes pt() helper from label-layout for mm→pt conversion.
 */

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import { generateBarcodePngDataUrl } from '@/lib/barcode-png'
import { SHEETS, pt, expandToCells, paginateCells } from './label-layout'
import { formatProductPrice } from '../product.utils'
import type { LabelItem, LabelTemplate, SheetFormat } from './label-print.types'

interface LabelPDFProps {
  items: LabelItem[]
  qtyMap: Record<string, number>
  sheetFormat: SheetFormat
  templateOverride: LabelTemplate | 'per-product'
}

function resolveTemplate(item: LabelItem, override: LabelTemplate | 'per-product'): LabelTemplate {
  return override === 'per-product' ? item.template : override
}

function LabelCell({
  item,
  template,
  cellW,
  cellH,
}: {
  item: LabelItem
  template: LabelTemplate
  cellW: number
  cellH: number
}) {
  const barcodeUrl = item.barcode && item.barcodeFormat
    ? generateBarcodePngDataUrl(item.barcode, item.barcodeFormat, { width: Math.round(cellW * 0.85), height: Math.round(cellH * 0.5) })
    : null

  const styles = StyleSheet.create({
    cell: {
      width: pt(cellW),
      height: pt(cellH),
      borderWidth: 0.5,
      borderColor: '#e0e0e0',
      borderStyle: 'solid',
      padding: pt(1),
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    },
    barcodeImg: {
      width: pt(cellW * 0.9),
      height: pt(cellH * 0.48),
      objectFit: 'contain',
    },
    name: {
      fontSize: 7,
      fontFamily: 'Helvetica',
      color: '#111',
      textAlign: 'center',
      marginTop: 2,
      maxHeight: 18,
      overflow: 'hidden',
    },
    price: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: '#111',
      marginTop: 1,
    },
    noBarcode: {
      fontSize: 6,
      color: '#aaa',
      textAlign: 'center',
    },
  })

  return (
    <View style={styles.cell}>
      {barcodeUrl ? (
        <Image src={barcodeUrl} style={styles.barcodeImg} />
      ) : (
        <Text style={styles.noBarcode}>No barcode</Text>
      )}
      {template === 'standard' && (
        <Text style={styles.name}>{item.name}</Text>
      )}
      {(template === 'standard' || template === 'compact') && (
        <Text style={styles.price}>{formatProductPrice(item.salePrice)}</Text>
      )}
    </View>
  )
}

export function LabelPDF({ items, qtyMap, sheetFormat, templateOverride }: LabelPDFProps) {
  const spec = SHEETS[sheetFormat]
  const cells = expandToCells(items, qtyMap)
  const pages = paginateCells(cells, spec)

  const pageStyle = StyleSheet.create({
    page: {
      backgroundColor: '#fff',
      padding: pt(spec.margin),
      display: 'flex',
      flexDirection: 'column',
    },
    row: {
      display: 'flex',
      flexDirection: 'row',
      marginBottom: pt(spec.gap),
    },
    cellGap: {
      width: pt(spec.gap),
    },
  })

  return (
    <Document title="HisaabPro Labels">
      {pages.map((rows, pageIdx) => (
        <Page
          key={pageIdx}
          size={sheetFormat === 'THERMAL_40x30' ? [pt(spec.page.w), pt(spec.page.h)] : (sheetFormat === 'A5_2x5' ? 'A5' : 'A4')}
          orientation="portrait"
          style={pageStyle.page}
        >
          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={pageStyle.row} wrap={false}>
              {row.map((cell, colIdx) => (
                <View key={colIdx} style={{ display: 'flex', flexDirection: 'row' }}>
                  {colIdx > 0 && <View style={pageStyle.cellGap} />}
                  <LabelCell
                    item={cell}
                    template={resolveTemplate(cell, templateOverride)}
                    cellW={spec.cell.w}
                    cellH={spec.cell.h}
                  />
                </View>
              ))}
            </View>
          ))}
        </Page>
      ))}
    </Document>
  )
}
