/** Invoice Templates — API service layer
 *
 * All network calls for template CRUD and invoice settings.
 * Uses the api() helper which handles auth, timeout, and error normalisation.
 * Every GET passes the caller's AbortSignal so stale requests are cancelled.
 *
 * Response shape from the server is always { success, data } — api() unwraps
 * to `data` directly, so functions here just return the typed value.
 */

import { api } from '@/lib/api'
import type {
  InvoiceTemplate,
  TemplateSummary,
  TemplateFormData,
  InvoiceSettings,
} from './template.types'

// ─── Template list ────────────────────────────────────────────────────────────

/**
 * Fetch all templates for the current business.
 * Returns lightweight summaries — config payload is excluded for performance.
 * Use getTemplate() to load full config for the editor.
 */
export async function getTemplates(signal?: AbortSignal): Promise<TemplateSummary[]> {
  return api<TemplateSummary[]>('/templates', { signal })
}

// ─── Template detail ──────────────────────────────────────────────────────────

/**
 * Fetch the full template including config and printSettings.
 * Used when opening the template editor or generating a PDF preview.
 */
export async function getTemplate(id: string, signal?: AbortSignal): Promise<InvoiceTemplate> {
  return api<InvoiceTemplate>(`/templates/${id}`, { signal })
}

// ─── Template create ──────────────────────────────────────────────────────────

/**
 * Create a new template from the given form data.
 * The baseTemplate field determines the page size family (A4, thermal, etc.).
 * Returns the persisted template with server-assigned id and timestamps.
 */
export async function createTemplate(data: TemplateFormData): Promise<InvoiceTemplate> {
  return api<InvoiceTemplate>('/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── Template update ──────────────────────────────────────────────────────────

/**
 * Update an existing template. Accepts partial TemplateFormData —
 * only the supplied fields are merged on the server.
 * Returns the full updated template.
 */
export async function updateTemplate(
  id: string,
  data: Partial<TemplateFormData>,
): Promise<InvoiceTemplate> {
  return api<InvoiceTemplate>(`/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// ─── Template delete ──────────────────────────────────────────────────────────

/**
 * Soft-delete a template. The template is marked deletedAt on the server
 * and excluded from future list responses.
 * The default template cannot be deleted — the server will return a 400.
 */
export async function deleteTemplate(id: string): Promise<void> {
  return api<void>(`/templates/${id}`, { method: 'DELETE' })
}

// ─── Template duplicate ───────────────────────────────────────────────────────

/**
 * Create a copy of an existing template.
 * The server clones the config/printSettings and appends " (Copy)" to the name.
 * The new template is NOT set as default for any document types.
 * Returns the newly created template.
 */
export async function duplicateTemplate(id: string): Promise<InvoiceTemplate> {
  return api<InvoiceTemplate>(`/templates/${id}/duplicate`, { method: 'POST' })
}

// ─── Set default template ─────────────────────────────────────────────────────

/**
 * Mark this template as the default for the given document types.
 * Any previous default for those types is superseded.
 * Pass an empty array to clear all default assignments for this template.
 *
 * Returns the updated id and defaultForTypes array (not the full template)
 * so the list view can update without a full refetch.
 */
export async function setDefaultTemplate(
  id: string,
  documentTypes: string[],
): Promise<{ id: string; defaultForTypes: string[] }> {
  return api<{ id: string; defaultForTypes: string[] }>(`/templates/${id}/set-default`, {
    method: 'POST',
    body: JSON.stringify({ documentTypes }),
  })
}

// ─── Invoice settings ─────────────────────────────────────────────────────────

/**
 * Fetch the business-level invoice settings (round-off + decimal precision).
 * These are global and not tied to any specific template.
 */
export async function getInvoiceSettings(signal?: AbortSignal): Promise<InvoiceSettings> {
  return api<InvoiceSettings>('/invoice-settings', { signal })
}

/**
 * Persist updated invoice settings.
 * Sends the full InvoiceSettings object — server does a full replace.
 * Returns the saved settings (useful for confirming server-applied defaults).
 */
export async function updateInvoiceSettings(data: InvoiceSettings): Promise<InvoiceSettings> {
  return api<InvoiceSettings>('/invoice-settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}
