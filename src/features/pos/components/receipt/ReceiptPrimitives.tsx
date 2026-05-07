/** POS — Shared React-PDF receipt primitives */

import { Text, View, StyleSheet } from '@react-pdf/renderer'
import { paiseToInrNumeric } from '../../utils/pos.format'

const styles = StyleSheet.create({
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#000',
    marginVertical:    2,
  },
  dashedDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#000',
    borderBottomStyle: 'dashed',
    marginVertical:    2,
  },
  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    flexWrap:       'nowrap',
  },
  rowLeft: {
    flex:       1,
    textAlign:  'left',
  },
  rowRight: {
    textAlign:  'right',
    minWidth:   50,
  },
  moneyText: {
    textAlign:  'right',
    minWidth:   60,
  },
})

// ─── Divider ─────────────────────────────────────────────────────────────────

export function Divider({ dashed = false }: { dashed?: boolean }) {
  return <View style={dashed ? styles.dashedDivider : styles.divider} />
}

// ─── Row (left + right aligned pair) ─────────────────────────────────────────

interface RowProps {
  left:      string
  right:     string
  bold?:     boolean
  fontSize?: number
}

export function Row({ left, right, bold = false, fontSize = 8 }: RowProps) {
  const fontWeight = bold ? 'bold' : 'normal'
  return (
    <View style={styles.row}>
      <Text style={{ ...styles.rowLeft,  fontSize, fontWeight }}>{left}</Text>
      <Text style={{ ...styles.rowRight, fontSize, fontWeight }}>{right}</Text>
    </View>
  )
}

// ─── Money (paise → INR right-aligned) ───────────────────────────────────────

interface MoneyProps {
  label:     string
  paise:     number
  bold?:     boolean
  fontSize?: number
}

export function Money({ label, paise, bold = false, fontSize = 8 }: MoneyProps) {
  return (
    <Row
      left={label}
      right={paiseToInrNumeric(paise)}
      bold={bold}
      fontSize={fontSize}
    />
  )
}

// ─── Truncate (smart truncation for monospace lines) ─────────────────────────

interface TruncateProps {
  text:       string
  maxChars:   number
  fontSize?:  number
}

export function TruncateText({ text, maxChars, fontSize = 8 }: TruncateProps) {
  const display = text.length > maxChars ? text.slice(0, maxChars - 1) + '…' : text
  return <Text style={{ fontSize }}>{display}</Text>
}

// ─── Center text ─────────────────────────────────────────────────────────────

interface CenterProps {
  children:  string | string[]
  fontSize?: number
  bold?:     boolean
}

export function Center({ children, fontSize = 8, bold = false }: CenterProps) {
  return (
    <Text
      style={{
        textAlign:  'center',
        fontSize,
        fontWeight: bold ? 'bold' : 'normal',
      }}
    >
      {children}
    </Text>
  )
}
