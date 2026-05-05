/**
 * BrokenPtpAlert — banner shown when there are broken payment promises.
 */

import { AlertCircle } from 'lucide-react'
import '../styles/aging.css'

interface Props {
  count: number
  label: string
  singleLabel: string
}

export function BrokenPtpAlert({ count, label, singleLabel }: Props) {
  if (count === 0) return null

  const ptpWord = count === 1 ? singleLabel : label

  return (
    <div className="broken-ptp-banner" role="alert">
      <AlertCircle size={18} className="broken-ptp-banner__icon" aria-hidden="true" />
      <p className="broken-ptp-banner__text">
        {count} {ptpWord}
      </p>
    </div>
  )
}
