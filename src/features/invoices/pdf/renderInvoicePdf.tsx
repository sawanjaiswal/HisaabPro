/** Render an invoice document to a base64 PDF, client-side (#32).
 *
 * PDF generation in this app is 100% client-side React-PDF — the server has no
 * renderer. This helper turns a loaded DocumentDetail into a base64 string the
 * email-share endpoint can attach.
 */

import { pdf } from '@react-pdf/renderer'
import { InvoicePdfDocument } from './InvoicePdfDocument'
import type { DocumentDetail } from '../invoice-document.types'

/** Uint8Array → base64 without blowing the call stack on large buffers. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export interface RenderInvoicePdfArgs {
  doc: DocumentDetail
  businessName: string
  /** Localised "Custom Details" heading — only shown if rows exist (none here). */
  customDetailsSectionLabel: string
}

/** Returns base64 (no data: prefix) — ready for ShareEmailRequest.pdfBase64. */
export async function renderInvoicePdfBase64({
  doc,
  businessName,
  customDetailsSectionLabel,
}: RenderInvoicePdfArgs): Promise<string> {
  const element = (
    <InvoicePdfDocument
      doc={doc}
      businessName={businessName}
      customFieldRows={[]}
      customDetailsSectionLabel={customDetailsSectionLabel}
    />
  )
  const blob = await pdf(element).toBlob()
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return bytesToBase64(bytes)
}
