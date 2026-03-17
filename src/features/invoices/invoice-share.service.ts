/** Invoicing — Share & Export services
 *
 * Handles WhatsApp sharing, email sharing, shareable links, and document export.
 * All share actions create a DocumentShareLog entry on the server.
 */

import { api } from '@/lib/api'
import type {
  ShareWhatsAppResponse,
  ShareEmailResponse,
  ExportFormat,
} from './invoice.types'

// ─── Request body types ──────────────────────────────────────────────────────

export interface ShareWhatsAppRequest {
  /** 'IMAGE' renders to JPG; 'PDF' uses react-pdf */
  format: 'IMAGE' | 'PDF'
  recipientPhone: string
  message: string
}

export interface ShareEmailRequest {
  recipientEmail: string
  subject: string
  body: string
  format: 'PDF'
}

// ─── Sharing ─────────────────────────────────────────────────────────────────

/**
 * Generate and share a document via WhatsApp.
 * The API generates the image/PDF file and returns the URL + WhatsApp deep link.
 * On mobile (Capacitor), the client opens the native share sheet with the file.
 * Updates document status to SHARED. Creates a DocumentShareLog entry.
 */
export async function shareViaWhatsApp(
  id: string,
  data: ShareWhatsAppRequest
): Promise<ShareWhatsAppResponse> {
  return api<ShareWhatsAppResponse>(`/documents/${id}/share/whatsapp`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Send a document via email using the Resend integration.
 * The API generates the PDF and emails it to recipientEmail.
 * Updates document status to SHARED. Creates a DocumentShareLog entry.
 */
export async function shareViaEmail(
  id: string,
  data: ShareEmailRequest
): Promise<ShareEmailResponse> {
  return api<ShareEmailResponse>(`/documents/${id}/share/email`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/**
 * Generate a shareable public link for a document.
 * Returns a URL the recipient can open to view the document as a hosted PDF/image.
 * Creates a DocumentShareLog entry on the server.
 */
export async function getShareableLink(
  id: string
): Promise<{ url: string }> {
  return api<{ url: string }>(`/documents/${id}/share-link`, {
    method: 'POST',
  })
}

// ─── Export ──────────────────────────────────────────────────────────────────

/**
 * Export a document as PDF, JPG, or PNG.
 * Returns the raw file Blob — caller should use URL.createObjectURL() for download.
 * Optionally specify a templateId to override the business default template.
 *
 * Note: Image export must complete in < 3 seconds per the performance target.
 */
export async function exportDocument(
  id: string,
  format: ExportFormat,
  templateId?: string
): Promise<Blob> {
  const params = new URLSearchParams({ format })
  if (templateId) params.set('templateId', templateId)

  // Cannot use the typed api() helper here because the response is binary, not JSON.
  const { API_URL } = await import('@/config/app.config')

  const response = await fetch(
    `${API_URL}/documents/${id}/export?${params.toString()}`,
    {
      credentials: 'include',
    }
  )

  if (!response.ok) {
    throw new Error(`Export failed (${response.status})`)
  }

  return response.blob()
}
