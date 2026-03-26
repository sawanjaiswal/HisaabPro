import { Hash, Calendar } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { SerialStatusBadge } from './SerialStatusBadge'
import { formatSerialDate } from '../serial-number.utils'
import type { SerialNumber } from '../serial-number.types'

interface SerialCardProps {
  serial: SerialNumber
  onClick?: (id: string) => void
}

export function SerialCard({ serial, onClick }: SerialCardProps) {
  const { t } = useLanguage()

  return (
    <button
      type="button"
      className="serial-card"
      onClick={() => onClick?.(serial.id)}
      aria-label={`${t.serialAriaPrefix} ${serial.serialNumber}, ${t.statusAriaPrefix} ${serial.status}`}
    >
      <div className="serial-card__header">
        <div className="serial-card__number">
          <Hash size={14} aria-hidden="true" />
          <span>{serial.serialNumber}</span>
        </div>
        <SerialStatusBadge status={serial.status} />
      </div>
      <div className="serial-card__footer">
        <span className="serial-card__date">
          <Calendar size={12} aria-hidden="true" />
          {formatSerialDate(serial.createdAt)}
        </span>
        {serial.soldAt && (
          <span className="serial-card__date serial-card__date--sold">
            {t.sold} {formatSerialDate(serial.soldAt)}
          </span>
        )}
      </div>
    </button>
  )
}
