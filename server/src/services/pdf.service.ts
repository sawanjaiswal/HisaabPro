/**
 * PDF Generation Service — stub interface for invoice PDFs
 * Actual rendering uses React-PDF on the frontend or a server-side renderer.
 * This provides the server-side interface so notification/share flows can attach PDFs.
 */

import logger from '../lib/logger.js'

/**
 * Generate a PDF buffer for an invoice/document.
 * TODO: Implement with server-side React-PDF renderer or headless browser.
 * The frontend currently handles PDF rendering via React-PDF (client-side).
 * This stub returns null until a server-side renderer is wired up.
 */
export async function generateInvoicePdf(
  _documentId: string,
  _businessId: string
): Promise<Buffer | null> {
  logger.info('generateInvoicePdf called — server-side PDF not yet implemented', {
    documentId: _documentId,
    businessId: _businessId,
  })
  return null
}
