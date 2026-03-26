/** Report Export Bar
 *
 * Sticky bottom bar with PDF / Excel / CSV export action buttons.
 * Disabled entirely when there is no data to export.
 */

import React from 'react'
import { FileText, FileSpreadsheet } from 'lucide-react'
import type { ExportFormat } from '../report.types'
import { useLanguage } from '@/hooks/useLanguage'

interface ReportExportBarProps {
  onExport: (format: ExportFormat) => void
  disabled?: boolean
}

export const ReportExportBar: React.FC<ReportExportBarProps> = ({
  onExport,
  disabled = false,
}) => {
  const { t } = useLanguage()
    return (
    <div className="report-export-bar" role="toolbar" aria-label={t.exportReport}>
      <span className="report-export-label">{t.exportAs}</span>
      <div className="report-export-actions">
        <button
          className="report-export-btn"
          onClick={() => onExport('CSV')}
          disabled={disabled}
          aria-label={t.exportAsCsv}
          type="button"
        >
          <FileSpreadsheet size={16} aria-hidden="true" />
          CSV
        </button>
        <button
          className="report-export-btn"
          onClick={() => onExport('PDF')}
          disabled={disabled}
          aria-label={t.exportAsPdf}
          type="button"
        >
          <FileText size={16} aria-hidden="true" />
          PDF
        </button>
      </div>
    </div>
  )
}
