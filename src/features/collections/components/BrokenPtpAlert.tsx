/**
 * BrokenPtpAlert — amber warning banner for broken payment promises.
 * Soft amber tint, AlertTriangle icon, left accent border.
 */

import { AlertTriangle, ChevronRight } from 'lucide-react'
import '../styles/aging.css'
import { Button } from '@/components/ui/Button'

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
  const text = `${count} ${ptpWord}`

  if (onTap) {
    return (
      <Button variant="none"
        type="button"
        className="broken-ptp-banner broken-ptp-banner--tappable"
        onClick={onTap}
        aria-label={`${text} — tap to view`}
      >
        <AlertTriangle size={16} className="broken-ptp-banner__icon" aria-hidden="true" />
        <p className="broken-ptp-banner__text">{text} — tap to review</p>
        <ChevronRight size={16} className="broken-ptp-banner__chevron" aria-hidden="true" />
      </Button>
    )
  }

  return (
    <div className="broken-ptp-banner" role="alert">
      <AlertTriangle size={16} className="broken-ptp-banner__icon" aria-hidden="true" />
      <p className="broken-ptp-banner__text">{text}</p>
    </div>
  )
}
