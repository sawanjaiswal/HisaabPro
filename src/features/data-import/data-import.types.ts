/** Competitor Data Import — Type definitions */

export type ImportSource = 'VYAPAR' | 'TALLY' | 'BUSY' | 'MARG' | 'EXCEL' | 'CSV'
export type ImportDataType = 'PARTIES' | 'PRODUCTS' | 'INVOICES'
export type DataImportStatus = 'idle' | 'mapping' | 'preview' | 'importing' | 'done' | 'error'

export interface ImportSourceConfig {
  id: ImportSource
  name: string
  description: string
  acceptedFormats: string
  dataTypes: ImportDataType[]
}

export interface ImportedRow {
  id: string
  raw: Record<string, string>
  mapped: Record<string, string>
  isValid: boolean
  error?: string
}

export interface ColumnMapping {
  sourceColumn: string
  targetField: string
}

export interface DataImportResult {
  total: number
  succeeded: number
  failed: number
  dataType: ImportDataType
  errors: Array<{ row: number; reason: string }>
}
