/** Competitor Data Import — State hook */

import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/useToast'
import { createParty } from '@/features/parties/party-crud.service'
import { parseCsvText, autoDetectMappings, applyMappings } from './data-import.utils'
import { MAX_FILE_SIZE_MB } from './data-import.constants'
import type {
  ImportSource,
  ImportDataType,
  DataImportStatus,
  ImportedRow,
  ColumnMapping,
  DataImportResult,
} from './data-import.types'

export function useDataImport() {
  const toast = useToast()
  const [status, setStatus] = useState<DataImportStatus>('idle')
  const [source, setSource] = useState<ImportSource | null>(null)
  const [dataType, setDataType] = useState<ImportDataType>('PARTIES')
  const [headers, setHeaders] = useState<string[]>([])
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [rows, setRows] = useState<ImportedRow[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [importResult, setImportResult] = useState<DataImportResult | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // ─── File parsing ────────────────────────────────────────────────────────
  const parseFile = useCallback(async (file: File, selectedSource: ImportSource, selectedType: ImportDataType) => {
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Maximum ${MAX_FILE_SIZE_MB}MB.`)
      setStatus('error')
      return
    }

    setSource(selectedSource)
    setDataType(selectedType)
    setStatus('mapping')
    setError(null)

    try {
      const text = await file.text()
      const { headers: h, rows: r } = parseCsvText(text)

      if (h.length === 0 || r.length === 0) {
        setError('Could not parse file. Ensure it has headers and data rows.')
        setStatus('error')
        return
      }

      setHeaders(h)
      setRawRows(r)

      // Auto-detect column mappings
      const autoMappings = autoDetectMappings(h, selectedType)
      setMappings(autoMappings)

      // Apply mappings to get preview
      const mapped = applyMappings(r, autoMappings)
      setRows(mapped)
      setStatus('preview')
    } catch {
      setError('Failed to read file.')
      setStatus('error')
    }
  }, [])

  // ─── Update mapping ──────────────────────────────────────────────────────
  const updateMapping = useCallback((sourceColumn: string, targetField: string) => {
    setMappings((prev) => {
      const existing = prev.findIndex((m) => m.sourceColumn === sourceColumn)
      if (existing >= 0) {
        if (!targetField) return prev.filter((_, i) => i !== existing)
        const updated = [...prev]
        updated[existing] = { sourceColumn, targetField }
        return updated
      }
      if (targetField) return [...prev, { sourceColumn, targetField }]
      return prev
    })
  }, [])

  // Apply updated mappings
  const applyUpdatedMappings = useCallback(() => {
    const mapped = applyMappings(rawRows, mappings)
    setRows(mapped)
  }, [rawRows, mappings])

  // ─── Execute import ──────────────────────────────────────────────────────
  const executeImport = useCallback(async () => {
    const validRows = rows.filter((r) => r.isValid)
    if (validRows.length === 0) return

    setStatus('importing')
    setProgress(0)

    const result: DataImportResult = {
      total: validRows.length,
      succeeded: 0,
      failed: 0,
      dataType,
      errors: [],
    }

    // Currently only supports PARTIES import
    if (dataType === 'PARTIES') {
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i]
        try {
          await createParty({
            name: row.mapped.name ?? '',
            phone: row.mapped.phone ?? undefined,
            email: row.mapped.email ?? undefined,
            type: (row.mapped.type?.toUpperCase() === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER'),
            tags: ['imported'],
            creditLimit: 0,
            creditLimitMode: 'WARN',
            addresses: [],
          })
          result.succeeded++
        } catch {
          result.failed++
          result.errors.push({ row: i + 1, reason: `Failed to create ${row.mapped.name}` })
        }
        setProgress(i + 1)
      }
    } else {
      // Products and Invoices import — to be implemented with backend support
      toast.info(`${dataType} import requires backend support. Coming soon!`)
      result.failed = validRows.length
    }

    setImportResult(result)
    setStatus('done')
  }, [rows, dataType, toast])

  // ─── Reset ───────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setStatus('idle')
    setSource(null)
    setHeaders([])
    setMappings([])
    setRows([])
    setRawRows([])
    setImportResult(null)
    setProgress(0)
    setError(null)
  }, [])

  const validCount = rows.filter((r) => r.isValid).length

  return {
    status, source, dataType, headers, mappings, rows, importResult, progress, error, validCount,
    setDataType, parseFile, updateMapping, applyUpdatedMappings, executeImport, reset,
  }
}
