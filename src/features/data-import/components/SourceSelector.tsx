/** Source Selector — Choose competitor app to import from */

import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { IMPORT_SOURCES, DATA_TYPE_LABELS } from '../data-import.constants'
import type { ImportSource, ImportDataType } from '../data-import.types'

interface SourceSelectorProps {
  dataType: ImportDataType
  onDataTypeChange: (type: ImportDataType) => void
  onSelectFile: (file: File, source: ImportSource, dataType: ImportDataType) => void
}

const DATA_TYPES: ImportDataType[] = ['PARTIES', 'PRODUCTS', 'INVOICES']

export function SourceSelector({ dataType, onDataTypeChange, onSelectFile }: SourceSelectorProps) {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const handleFile = (source: ImportSource, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onSelectFile(file, source, dataType)
    e.target.value = ''
  }

  return (
    <div className="data-import-source">
      <h2 className="data-import-title">Import Data</h2>
      <p className="data-import-description">
        Import your existing data from another billing app or spreadsheet
      </p>

      {/* Data type selector */}
      <div className="data-import-type-bar">
        <span className="data-import-type-label">Import:</span>
        <div className="pill-tabs" role="tablist">
          {DATA_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              className={`pill-tab${dataType === t ? ' active' : ''}`}
              onClick={() => onDataTypeChange(t)}
              aria-selected={dataType === t}
            >
              {DATA_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Source cards */}
      <div className="data-import-sources" role="list" aria-label="Import sources">
        {IMPORT_SOURCES.filter((s) => s.dataTypes.includes(dataType)).map((src) => (
          <button
            key={src.id}
            type="button"
            className="data-import-source-card"
            onClick={() => fileRefs.current[src.id]?.click()}
            role="listitem"
          >
            <div className="data-import-source-info">
              <span className="data-import-source-name">{src.name}</span>
              <span className="data-import-source-desc">{src.description}</span>
            </div>
            <Upload size={18} className="data-import-source-icon" aria-hidden="true" />
            <input
              ref={(el) => { fileRefs.current[src.id] = el }}
              type="file"
              accept={src.acceptedFormats}
              onChange={(e) => handleFile(src.id, e)}
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
