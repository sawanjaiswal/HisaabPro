/** POS — 80mm thermal receipt (React-PDF, 48-char, Courier 9pt) */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { Divider, Row, Money, Center, TruncateText } from './ReceiptPrimitives'
import { formatReceiptDate } from '../../utils/pos.format'
import { paiseToInrNumeric } from '../../utils/pos.format'
import type { PosSaleDTO } from '../../types/pos.types'

const FONT_SIZE = 9
const LINE_H    = 11

const styles = StyleSheet.create({
  page: {
    fontFamily:    'Courier',
    fontSize:      FONT_SIZE,
    lineHeight:    LINE_H / FONT_SIZE,
    padding:       6,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  section: {
    marginBottom: 3,
  },
  itemRow: {
    flexDirection: 'row',
    flexWrap:      'nowrap',
    marginBottom:  1,
  },
  itemName: {
    flex:    1,
    fontSize: FONT_SIZE,
  },
  itemQty: {
    width:     40,
    textAlign: 'right',
    fontSize:  FONT_SIZE,
  },
  itemAmt: {
    width:     56,
    textAlign: 'right',
    fontSize:  FONT_SIZE,
  },
  taxRow: {
    flexDirection: 'row',
    marginLeft:    8,
  },
  taxLabel: {
    flex:     1,
    fontSize: 7.5,
    color:    '#555',
  },
  taxAmt: {
    fontSize:  7.5,
    color:     '#555',
    textAlign: 'right',
    minWidth:  50,
  },
})

interface Props {
  sale:         PosSaleDTO
  businessName: string
  address?:     string
  gstin?:       string
  gstEnabled?:  boolean
}

export function Receipt80mm({ sale, businessName, address, gstin, gstEnabled }: Props) {
  const customer = sale.walkInName ?? sale.partyName ?? 'Walk-in Customer'

  return (
    <Document>
      <Page
        size={{ width: 226.8, height: 'auto' }}  // 80mm in pts
        style={styles.page}
        wrap={false}
      >
        {/* Header */}
        <View style={styles.section}>
          <Center bold fontSize={12}>{businessName.slice(0, 48)}</Center>
          {address && <Center fontSize={8}>{address.slice(0, 80)}</Center>}
          {gstin && gstEnabled && <Center fontSize={8}>GSTIN: {gstin}</Center>}
          <Center fontSize={7.5}>Tax Invoice</Center>
        </View>

        <Divider />

        {/* Meta */}
        <View style={styles.section}>
          <Row left="Receipt No." right={sale.receiptNumber}              fontSize={FONT_SIZE} />
          <Row left="Date & Time" right={formatReceiptDate(sale.createdAt)} fontSize={FONT_SIZE} />
          <Row left="Customer"    right={customer.slice(0, 22)}           fontSize={FONT_SIZE} />
          {sale.walkInPhone && (
            <Row left="Phone" right={sale.walkInPhone} fontSize={FONT_SIZE} />
          )}
        </View>

        <Divider dashed />

        {/* Items header */}
        <View style={styles.itemRow}>
          <Text style={styles.itemName}>Item</Text>
          <Text style={styles.itemQty}>Qty</Text>
          <Text style={styles.itemAmt}>Amount</Text>
        </View>
        <Divider dashed />

        {/* Items */}
        <View style={styles.section}>
          {sale.items.map((item, i) => (
            <View key={i} style={{ marginBottom: 3 }}>
              <View style={styles.itemRow}>
                <TruncateText text={item.productName} maxChars={30} fontSize={FONT_SIZE} />
                <Text style={styles.itemQty}>{item.quantity}</Text>
                <Text style={styles.itemAmt}>{paiseToInrNumeric(item.lineTotal)}</Text>
              </View>
              <View style={styles.taxRow}>
                <Text style={styles.taxLabel}>
                  @{paiseToInrNumeric(item.unitPrice)}
                  {item.discount > 0 ? ` disc -${paiseToInrNumeric(item.discount)}` : ''}
                  {gstEnabled && item.hsnCode ? ` HSN:${item.hsnCode}` : ''}
                </Text>
              </View>
              {gstEnabled && (item.cgst > 0 || item.igst > 0) && (
                <View style={styles.taxRow}>
                  {item.cgst > 0 && (
                    <Text style={styles.taxLabel}>
                      CGST: {paiseToInrNumeric(item.cgst)}  SGST: {paiseToInrNumeric(item.sgst)}
                    </Text>
                  )}
                  {item.igst > 0 && (
                    <Text style={styles.taxLabel}>
                      IGST: {paiseToInrNumeric(item.igst)}
                    </Text>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>

        <Divider />

        {/* Totals */}
        <View style={styles.section}>
          <Money label="Subtotal"    paise={sale.subtotal}       fontSize={FONT_SIZE} />
          {sale.totalDiscount > 0 && (
            <Money label="Discount (-)" paise={sale.totalDiscount} fontSize={FONT_SIZE} />
          )}
          {gstEnabled && (
            <>
              {sale.totalCgst > 0 && <Money label={`CGST`} paise={sale.totalCgst} fontSize={FONT_SIZE} />}
              {sale.totalSgst > 0 && <Money label={`SGST`} paise={sale.totalSgst} fontSize={FONT_SIZE} />}
              {sale.totalIgst > 0 && <Money label={`IGST`} paise={sale.totalIgst} fontSize={FONT_SIZE} />}
              {sale.totalCess > 0 && <Money label={`Cess`} paise={sale.totalCess} fontSize={FONT_SIZE} />}
            </>
          )}
          <Divider />
          <Money label="GRAND TOTAL" paise={sale.grandTotal} bold fontSize={10} />
        </View>

        {/* Payment breakdown */}
        <View style={styles.section}>
          {sale.paymentBreakdown.map((p, i) => (
            <Row
              key={i}
              left={`Paid via ${p.mode}`}
              right={paiseToInrNumeric(p.amountPaise)}
              fontSize={FONT_SIZE}
            />
          ))}
        </View>

        <Divider />
        <Center fontSize={8}>Thank you for your business!</Center>
        {sale.status === 'VOIDED' && (
          <Center bold fontSize={10}>*** VOIDED ***</Center>
        )}
      </Page>
    </Document>
  )
}
