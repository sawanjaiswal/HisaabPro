/** Document Custom Fields — settings API service (#134)
 *
 * Wraps /api/custom-fields filtered to entityType=DOCUMENT.
 */

import { api } from '@/lib/api'

export type CustomFieldType = 'TEXT' | 'MULTILINE' | 'NUMBER' | 'DATE' | 'DROPDOWN'

export type ApplicableDocumentType =
  | 'INVOICE'
  | 'ESTIMATE'
  | 'SALE_ORDER'
  | 'DELIVERY_CHALLAN'

export interface DocumentCustomFieldDef {
  id: string
  name: string
  fieldType: CustomFieldType
  options: string[]
  required: boolean
  showOnInvoice: boolean
  entityType: 'DOCUMENT'
  documentTypes: ApplicableDocumentType[]
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreateDocumentCustomFieldInput {
  name: string
  fieldType: CustomFieldType
  options?: string[]
  required?: boolean
  documentTypes?: ApplicableDocumentType[]
  sortOrder?: number
}

export interface UpdateDocumentCustomFieldInput {
  name?: string
  options?: string[]
  required?: boolean
  documentTypes?: ApplicableDocumentType[]
  sortOrder?: number
}

interface FieldsResponse { fields: DocumentCustomFieldDef[] }
interface FieldResponse  { field:  DocumentCustomFieldDef }

export async function listDocumentCustomFields(
  signal?: AbortSignal,
): Promise<DocumentCustomFieldDef[]> {
  const res = await api<FieldsResponse>('/custom-fields?entityType=DOCUMENT', { signal })
  return res.fields
}

export async function createDocumentCustomField(
  data: CreateDocumentCustomFieldInput,
): Promise<DocumentCustomFieldDef> {
  const res = await api<FieldResponse>('/custom-fields', {
    method: 'POST',
    body: JSON.stringify({ ...data, entityType: 'DOCUMENT' }),
    entityType: 'custom-field',
    entityLabel: data.name,
  })
  return res.field
}

export async function updateDocumentCustomField(
  id: string,
  data: UpdateDocumentCustomFieldInput,
): Promise<DocumentCustomFieldDef> {
  const res = await api<FieldResponse>(`/custom-fields/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    entityType: 'custom-field',
    entityLabel: data.name ?? 'Custom field update',
  })
  return res.field
}

export async function deleteDocumentCustomField(id: string): Promise<void> {
  await api(`/custom-fields/${id}`, {
    method: 'DELETE',
    entityType: 'custom-field',
    entityLabel: 'Delete custom field',
  })
}
