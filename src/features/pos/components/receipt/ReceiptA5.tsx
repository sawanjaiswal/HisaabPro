/** POS — A5 portrait standard receipt (React-PDF, 14pt body) */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { Divider, Row, Money, Center } from './ReceiptPrimitives'
import { formatDisplayDate, formatDisplayTime, paiseToInrNumeric } from '../../utils/pos.format'
import type { PosSaleDTO } from '../../types/pos.types'

const BODY_SIZE = 10
const HDR_SIZE  = 13

const styles = StyleSheet.create({
  page: {
    fontFamily:    'Helvetica',
    fontSize:      BODY_SIZE,
    padding:       24,
    paddingBottom: 40,
    backgroundColor: '#fff',
  },
  header: {
    marginBottom: 12,
    textAlign:    'center',
  },
  bizName: {
    fontSize:   HDR_SIZE + 4,
    fontWeight: 'bold',
    textAlign:  'center',
    marginBottom: 3,
  },
  subHeader: {
    fontSize:  BODY_SIZE - 1,
    color:     '#555',
    textAlign: 'center',
  },
  metaBlock: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginBottom:   8,
    borderTopWidth: 0.5,
    borderTopColor: '#ccc',
    paddingTop:     6,
  },
  metaLeft: {
    flex:     1,
    fontSize: BODY_SIZE - 1,
  },
  metaRight: {
    flex:      1,
    fontSize:  BODY_SIZE - 1,
    textAlign: 'right',
  },
  tableHeader: {
    flexDirection:    'row',
    backgroundColor:  '#f0f0f0',
    paddingVertical:  3,
    paddingHorizontal: 4,
    borderTopWidth:   0.5,
    borderTopColor:   '#ccc',
  },
  colItem: {
    flex:     2,
    fontSize: BODY_SIZE - 1,
    fontWeight: 'bold',
  },
  colQty: {
    width:     40,
    textAlign: 'right',
    fontSize:  BODY_SIZE - 1,
    fontWeight: 'bold',
  },
  colRate: {
    width:     55,
    textAlign: 'right',
    fontSize:  BODY_SIZE - 1,
    fontWeight: 'bold',
  },
  colAmt: {
    width:     65,
    textAlign: 'right',
    fontSize:  BODY_SIZE - 1,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection:    'row',
    paddingVertical:  2,
    paddingHorizontal: 4,
    borderBottomWidth: 0.25,
    borderBottomColor: '#eee',
  },
  totalsBlock: {
    marginTop:    8,
    paddingLeft:  120,
  },
  footer: {
    position: 'absolute',
    bottom:   20,
    left:     24,
    right:    24,
    textAlign: 'center',
    fontSize:  9,
    color:    '#888',
  },
  voidedBanner: {
    position:        'absolute',
    top:             80,
    left:            60,
    right:           60,
    textAlign:       'center',
    fontSize:        40,
    color:           'rgba(200,0,0,0.15)',
    fontWeight:      'bold',
    transform:       'rotate(-30deg)',
  },
})

interface Props {
  sale:         PosSaleDTO
  businessName: string
  address?:     string
  gstin?:       string
  gstEnabled?:  boolean
}

export function ReceiptA5({ sale, businessName, address, gstin, gstEnabled }: Props) {
  const customer = sale.walkInName ?? sale.partyName ?? 'Walk-in Customer'

  return (
    <Document>
      <Page size="A5" orientation="portrait" style={styles.page}>
        {/* Voided watermark */}
        {sale.status === 'VOIDED' && (
          <Text style={styles.voidedBanner}>VOIDED</Text>
        )}

        {/* Header */}
        <Text style={styles.bizName}>{businessName}</Text>
        {address && <Text style={styles.subHeader}>{address}</Text>}
        {gstin && gstEnabled && <Text style={styles.subHeader}>GSTIN: {gstin}</Text>}
        <Center bold fontSize={BODY_SIZE}>Tax Invoice</Center>

        <View style={{ height: 8 }} />

        {/* Meta */}
        <View style={styles.metaBlock}>
          <View style={{ flex: 1 }}>
            <Text style={styles.metaLeft}>Receipt: <Text style={{ fontWeight: 'bold' }}>{sale.receiptNumber}</Text></Text>
            <Text style={styles.metaLeft}>Date: {formatDisplayDate(sale.createdAt)}</Text>
            <Text style={styles.metaLeft}>Time: {formatDisplayTime(sale.createdAt)}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.metaRight}>Customer: {customer}</Text>
            {sale.walkInPhone && (
              <Text style={styles.metaRight}>Phone: {sale.walkInPhone}</Text>
            )}
          </View>
        </View>

        {/* Items table */}
        <View style={styles.tableHeader}>
          <Text style={styles.colItem}>Item</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colRate}>Rate</Text>
          {gstEnabled && <Text style={styles.colRate}>Tax</Text>}
          <Text style={styles.colAmt}>Amount</Text>
        </View>

        {sale.items.map((item, i) => {
          const tax = item.cgst + item.sgst + item.igst
          return (
            <View key={i} style={styles.tableRow}>
              <View style={{ flex: 2 }}>
                <Text style={{ fontSize: BODY_SIZE - 1 }}>{item.productName}</Text>
                {gstEnabled && item.hsnCode && (
                  <Text style={{ fontSize: 8, color: '#888' }}>HSN: {item.hsnCode}</Text>
                )}
              </View>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colRate}>{paiseToInrNumeric(item.unitPrice)}</Text>
              {gstEnabled && (
                <Text style={styles.colRate}>{tax > 0 ? paiseToInrNumeric(tax) : '—'}</Text>
              )}
              <Text style={styles.colAmt}>{paiseToInrNumeric(item.lineTotal)}</Text>
            </View>
          )
        })}

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <Money label="Subtotal"   paise={sale.subtotal}       fontSize={BODY_SIZE} />
          {sale.totalDiscount > 0 && (
            <Money label="Discount" paise={sale.totalDiscount}  fontSize={BODY_SIZE} />
          )}
          {gstEnabled && (
            <>
              {sale.totalCgst > 0 && <Money label="CGST" paise={sale.totalCgst} fontSize={BODY_SIZE} />}
              {sale.totalSgst > 0 && <Money label="SGST" paise={sale.totalSgst} fontSize={BODY_SIZE} />}
              {sale.totalIgst > 0 && <Money label="IGST" paise={sale.totalIgst} fontSize={BODY_SIZE} />}
            </>
          )}
          <View style={{ borderTopWidth: 0.5, borderTopColor: '#000', marginTop: 2 }} />
          <Money label="Grand Total" paise={sale.grandTotal} bold fontSize={BODY_SIZE + 1} />
        </View>

        {/* Payment */}
        <View style={{ marginTop: 8 }}>
          {sale.paymentBreakdown.map((p, i) => (
            <Row
              key={i}
              left={`Payment (${p.mode})`}
              right={paiseToInrNumeric(p.amountPaise)}
              fontSize={BODY_SIZE - 1}
            />
          ))}
        </View>

        <Divider />

        {/* Footer */}
        <Text style={styles.footer}>
          Thank you for shopping with us!
          {sale.cashierName ? `  Cashier: ${sale.cashierName}` : ''}
        </Text>
      </Page>
    </Document>
  )
}
