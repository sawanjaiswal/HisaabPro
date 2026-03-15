/** Report Export Bar
 *
 * Sticky bottom bar with PDF / Excel / CSV export action buttons.
 * Disabled entirely when there is no data to export.
 */

import React from 'react'
import { FileText, Table2, FileSpreadsheet } from 'lucide-react'
import type { ExportFormat } from '../report.types'

interface ReportExportBarProps {
  onExport: (format: ExportFormat) => void
  disabled?: boolean
}

export const ReportExportBar: React.FC<ReportExportBarProps> = ({
  onExport,
  disabled = false,
}) => {
  return (
    <div className="report-export-bar" role="toolbar" aria-label="Export report">
      <span className="report-export-label">Export as</span>
      <div className="report-export-actions">
        <button
          className="report-export-btn"
          onClick={() => onExport('pdf')}
          disabled={disabled}
          aria-label="Export as PDF"
          type="button"
        >
          <FileText size={16} aria-hidden="true" />
          PDF
        </button>
        <button
          className="report-export-btn"
          onClick={() => onExport('xlsx')}
          disabled={disabled}
          aria-label="Export as Excel"
          type="button"
        >
          <Table2 size={16} aria-hidden="true" />
          Excel
        </button>
        <button
          className="report-export-btn"
          onClick={() => onExport('csv')}
          disabled={disabled}
          aria-label="Export as CSV"
          type="button"
        >
          <FileSpreadsheet size={16} aria-hidden="true" />
          CSV
        </button>
      </div>
    </div>
  )
}
