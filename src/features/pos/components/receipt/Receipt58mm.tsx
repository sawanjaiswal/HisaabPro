/** POS — 58mm thermal receipt (React-PDF, 32-char, Courier 8pt) */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { Divider, Row, Money, Center, TruncateText } from './ReceiptPrimitives'
import { formatReceiptDate } from '../../utils/pos.format'
import { paiseToInrNumeric } from '../../utils/pos.format'
import type { PosSaleDTO } from '../../types/pos.types'

const LINE_WIDTH = 32
const FONT_SIZE  = 8
const LINE_H     = 10

const styles = StyleSheet.create({
  page: {
    fontFamily:  'Courier',
    fontSize:    FONT_SIZE,
    lineHeight:  LINE_H / FONT_SIZE,
    padding:     4,
    paddingBottom: 16,
    backgroundColor: '#fff',
  },
  section: {
    marginBottom: 2,
  },
  itemRow: {
    flexDirection: 'row',
    flexWrap:      'nowrap',
  },
  itemName: {
    flex:     1,
    fontSize: FONT_SIZE,
  },
  itemAmt: {
    fontSize:  FONT_SIZE,
    minWidth:  40,
    textAlign: 'right',
  },
})

interface Props {
  sale:         PosSaleDTO
  businessName: string
  address?:     string
  gstin?:       string
  gstEnabled?:  boolean
}

export function Receipt58mm({ sale, businessName, address, gstin, gstEnabled }: Props) {
  const customer = sale.walkInName ?? sale.partyName ?? 'Walk-in Customer'

  return (
    <Document>
      <Page
        size={{ width: 163.7, height: 'auto' }}  // 58mm in pts
        style={styles.page}
        wrap={false}
      >
        {/* Header */}
        <View style={styles.section}>
          <Center bold fontSize={10}>
            {businessName.slice(0, LINE_WIDTH)}
          </Center>
          {address && (
            <Center fontSize={7}>{address.slice(0, LINE_WIDTH * 2)}</Center>
          )}
          {gstin && gstEnabled && (
            <Center fontSize={7}>GSTIN: {gstin}</Center>
          )}
        </View>

        <Divider />

        {/* Receipt meta */}
        <View style={styles.section}>
          <Row left="Receipt:" right={sale.receiptNumber} fontSize={FONT_SIZE} />
          <Row left="Date:"    right={formatReceiptDate(sale.createdAt)} fontSize={FONT_SIZE} />
          <Row left="Customer:" right={customer.slice(0, 15)} fontSize={FONT_SIZE} />
        </View>

        <Divider dashed />

        {/* Items */}
        <View style={styles.section}>
          {sale.items.map((item, i) => {
            const itemTotal = item.lineTotal
            return (
              <View key={i}>
                <View style={styles.itemRow}>
                  <TruncateText text={item.productName} maxChars={20} fontSize={FONT_SIZE} />
                  <Text style={styles.itemAmt}>{paiseToInrNumeric(itemTotal)}</Text>
                </View>
                <Text style={{ fontSize: 7, color: '#555' }}>
                  {item.quantity} x {paiseToInrNumeric(item.unitPrice)}
                  {item.discount > 0 ? ` -${paiseToInrNumeric(item.discount)}` : ''}
                  {gstEnabled && item.hsnCode ? ` [${item.hsnCode}]` : ''}
                </Text>
              </View>
            )
          })}
        </View>

        <Divider />

        {/* Totals */}
        <View style={styles.section}>
          <Money label="Subtotal"  paise={sale.subtotal}          fontSize={FONT_SIZE} />
          {sale.totalDiscount > 0 && (
            <Money label="Discount"  paise={-sale.totalDiscount}  fontSize={FONT_SIZE} />
          )}
          {gstEnabled && (
            <>
              {sale.totalCgst > 0 && <Money label="CGST" paise={sale.totalCgst} fontSize={FONT_SIZE} />}
              {sale.totalSgst > 0 && <Money label="SGST" paise={sale.totalSgst} fontSize={FONT_SIZE} />}
              {sale.totalIgst > 0 && <Money label="IGST" paise={sale.totalIgst} fontSize={FONT_SIZE} />}
            </>
          )}
          <Divider />
          <Money label="TOTAL" paise={sale.grandTotal} bold fontSize={9} />
        </View>

        {/* Payment */}
        <View style={styles.section}>
          {sale.paymentBreakdown.map((p, i) => (
            <Row
              key={i}
              left={`Paid (${p.mode})`}
              right={paiseToInrNumeric(p.amountPaise)}
              fontSize={FONT_SIZE}
            />
          ))}
        </View>

        <Divider />

        {/* Footer */}
        <Center fontSize={7}>Thank you. Visit again!</Center>
        {sale.status === 'VOIDED' && (
          <Center bold fontSize={9}>*** VOIDED ***</Center>
        )}
      </Page>
    </Document>
  )
}
