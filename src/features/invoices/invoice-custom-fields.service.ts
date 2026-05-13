/** Invoice — Custom Field defs + values service (#134)
 *
 * Defs are scoped to one document type (INVOICE/ESTIMATE/SALE_ORDER/DELIVERY_CHALLAN).
 * Values live keyed by fieldDefId in a JSONB column server-side.
 */

import { api } from '@/lib/api'
import type {
  ApplicableDocumentType,
  DocumentCustomFieldDef,
} from '@/features/settings/document-custom-fields.service'

interface DefsResponse  { fields: DocumentCustomFieldDef[] }
interface ValuesResponse { values: Array<{ fieldDefId: string; valueJson: unknown }> }

/** List custom-field defs that apply to a given document type. */
export async function listCustomFieldDefsForDocType(
  docType: ApplicableDocumentType,
  signal?: AbortSignal,
): Promise<DocumentCustomFieldDef[]> {
  const res = await api<DefsResponse>(
    `/custom-fields?entityType=DOCUMENT&documentType=${docType}`,
    { signal },
  )
  return res.fields
}

/** Fetch saved custom-field values for an existing document. */
export async function getDocumentCustomFieldValues(
  documentId: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const res = await api<ValuesResponse>(
    `/documents/${documentId}/custom-fields`,
    { signal },
  )
  const out: Record<string, unknown> = {}
  for (const row of res.values ?? []) {
    out[row.fieldDefId] = row.valueJson
  }
  return out
}
