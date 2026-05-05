/**
 * BrokenPtpAlert — banner shown when there are broken payment promises.
 * Optional onTap navigates to the relevant party detail.
 */

import { AlertCircle, ChevronRight } from 'lucide-react'
import '../styles/aging.css'

interface Props {
  count: number
  label: string
  singleLabel: string
  /** When provided, the banner becomes tappable and calls this handler. */
  onTap?: () => void
}

export function BrokenPtpAlert({ count, label, singleLabel, onTap }: Props) {
  if (count === 0) return null

  const ptpWord = count === 1 ? singleLabel : label

  if (onTap) {
    return (
      <button
        type="button"
        className="broken-ptp-banner broken-ptp-banner--tappable"
        onClick={onTap}
        aria-label={`${count} ${ptpWord} — tap to view`}
      >
        <AlertCircle size={18} className="broken-ptp-banner__icon" aria-hidden="true" />
        <p className="broken-ptp-banner__text">
          {count} {ptpWord}
        </p>
        <ChevronRight size={16} className="broken-ptp-banner__chevron" aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="broken-ptp-banner" role="alert">
      <AlertCircle size={18} className="broken-ptp-banner__icon" aria-hidden="true" />
      <p className="broken-ptp-banner__text">
        {count} {ptpWord}
      </p>
    </div>
  )
}
