/**
 * upi-intent.utils — build a `upi://pay?...` deep-link from server-provided
 * mandate parameters. FE-side only; server is SSOT for parameter content.
 */

export interface UpiIntentParams {
  pa: string // payee VPA
  pn: string // payee name
  am: string // amount
  tn?: string // note
  tr?: string // ref/txn id
  cu?: string // currency, default INR
}

export function buildUpiIntent(p: UpiIntentParams): string {
  const params = new URLSearchParams()
  params.set('pa', p.pa)
  params.set('pn', p.pn)
  params.set('am', p.am)
  params.set('cu', p.cu ?? 'INR')
  if (p.tn) params.set('tn', p.tn)
  if (p.tr) params.set('tr', p.tr)
  return `upi://pay?${params.toString()}`
}
