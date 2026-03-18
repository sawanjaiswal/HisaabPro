/** Mapping Preview — Review column mappings and data before import */

import { CheckCircle, AlertTriangle } from 'lucide-react'
import { getTargetFields } from '../data-import.utils'
import type { ImportedRow, ColumnMapping, ImportDataType } from '../data-import.types'

interface MappingPreviewProps {
  headers: string[]
  mappings: ColumnMapping[]
  rows: ImportedRow[]
  dataType: ImportDataType
  validCount: number
  onUpdateMapping: (sourceColumn: string, targetField: string) => void
  onApply: () => void
  onConfirm: () => void
  onBack: () => void
}

export function MappingPreview({
  headers, mappings, rows, dataType, validCount,
  onUpdateMapping, onApply, onConfirm, onBack,
}: MappingPreviewProps) {
  const targetFields = getTargetFields(dataType)
  const invalidCount = rows.filter((r) => !r.isValid).length

  return (
    <div className="mapping-preview">
      {/* Column mapping */}
      <div className="mapping-section">
        <h3 className="mapping-section-title">Column Mapping</h3>
        <p className="mapping-section-desc">Map your file columns to HisaabPro fields</p>

        <div className="mapping-grid">
          {headers.map((header) => {
            const current = mappings.find((m) => m.sourceColumn === header)
            return (
              <div key={header} className="mapping-row">
                <span className="mapping-source">{header}</span>
                <span className="mapping-arrow" aria-hidden="true">→</span>
                <select
                  className="mapping-target"
                  value={current?.targetField ?? ''}
                  onChange={(e) => {
                    onUpdateMapping(header, e.target.value)
                    // Debounced apply happens via effect
                  }}
                >
                  <option value="">Skip</option>
                  {targetFields.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>

        <button type="button" className="btn btn-secondary btn-sm" onClick={onApply}>
          Apply Mapping
        </button>
      </div>

      {/* Data preview */}
      <div className="mapping-section">
        <h3 className="mapping-section-title">Preview ({rows.length} rows)</h3>
        <div className="mapping-stats">
          <span className="mapping-stat mapping-stat-valid">
            <CheckCircle size={14} aria-hidden="true" />
            {validCount} valid
          </span>
          {invalidCount > 0 && (
            <span className="mapping-stat mapping-stat-invalid">
              <AlertTriangle size={14} aria-hidden="true" />
              {invalidCount} invalid
            </span>
          )}
        </div>

        <div className="mapping-preview-list">
          {rows.slice(0, 20).map((row) => (
            <div key={row.id} className={`mapping-preview-row${!row.isValid ? ' invalid' : ''}`}>
              <span className="mapping-preview-name">{row.mapped.name || '(no name)'}</span>
              {row.mapped.phone && <span className="mapping-preview-detail">{row.mapped.phone}</span>}
              {row.error && <span className="mapping-preview-error">{row.error}</span>}
            </div>
          ))}
          {rows.length > 20 && (
            <span className="mapping-preview-more">+{rows.length - 20} more rows</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mapping-actions">
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={onConfirm}
          disabled={validCount === 0}
        >
          Import {validCount} {validCount === 1 ? 'Record' : 'Records'}
        </button>
        <button type="button" className="btn btn-ghost btn-md" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  )
}
