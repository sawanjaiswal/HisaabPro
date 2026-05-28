/** CheckRow (#144) — one fired rule: severity pill, copy, affected-doc links. */

import { Link } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import type { GstCheck } from '../gst-validation.types'
import { CHECK_META, SEVERITY_META } from '../gst-validation.constants'

interface CheckRowProps {
  check: GstCheck
}

export function CheckRow({ check }: CheckRowProps) {
  const { t } = useLanguage()
  const meta = CHECK_META[check.id]
  const sev = SEVERITY_META[check.severity]

  return (
    <li className={`gstv-check gstv-check--${sev.modifier}`}>
      <div className="gstv-check__head">
        <span className="gstv-check__title">{t[meta.titleKey]}</span>
        <span className={`gstv-sev gstv-sev--${sev.modifier}`}>{t[sev.labelKey]}</span>
      </div>
      <p className="gstv-check__desc">{t[meta.descKey]}</p>

      <div className="gstv-check__count">
        {check.count} {t.gstReadinessDocsAffected}
      </div>

      <ul className="gstv-check__docs">
        {check.documents.map((doc) => (
          <li key={doc.id}>
            <Link
              to={ROUTES.INVOICE_DETAIL.replace(':id', doc.id)}
              className="gstv-check__doc-link"
            >
              {doc.documentNumber}
            </Link>
          </li>
        ))}
      </ul>
    </li>
  )
}
