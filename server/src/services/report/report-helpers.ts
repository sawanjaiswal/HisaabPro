/**
 * Shared helpers for report services.
 */

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function formatPaise(paise: number): string {
  return (paise / 100).toFixed(2)
}

export function formatExportDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

export function groupItems(
  items: Array<{ date: string; partyName: string; amount: number; paid: number; balance: number }>,
  groupBy: string,
) {
  const groups = new Map<string, typeof items>()

  for (const item of items) {
    let key: string
    if (groupBy === 'party') {
      key = item.partyName
    } else if (groupBy === 'month') {
      key = item.date.substring(0, 7) // "YYYY-MM"
    } else if (groupBy === 'day') {
      key = item.date.substring(0, 10) // "YYYY-MM-DD"
    } else {
      key = 'All'
    }
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }

  return Array.from(groups.entries()).map(([key, groupItems]) => ({
    key,
    label: key,
    invoiceCount: groupItems.length,
    totalAmount: groupItems.reduce((s, i) => s + i.amount, 0),
    totalPaid: groupItems.reduce((s, i) => s + i.paid, 0),
    totalOutstanding: groupItems.reduce((s, i) => s + i.balance, 0),
    items: groupItems,
  }))
}

export function groupPayments(
  items: Array<{ date: string; partyName: string; mode: string; amount: number; type: string }>,
  groupBy: string,
) {
  const groups = new Map<string, typeof items>()

  for (const item of items) {
    let key: string
    if (groupBy === 'party') key = item.partyName
    else if (groupBy === 'mode') key = item.mode
    else if (groupBy === 'day') key = item.date.substring(0, 10)
    else key = 'All'

    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }

  return Array.from(groups.entries()).map(([key, groupItems]) => ({
    key,
    label: key,
    totalReceived: groupItems.filter(i => i.type === 'in').reduce((s, i) => s + i.amount, 0),
    totalPaid: groupItems.filter(i => i.type === 'out').reduce((s, i) => s + i.amount, 0),
    count: groupItems.length,
    items: groupItems,
  }))
}
