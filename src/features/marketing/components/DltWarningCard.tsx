/** DltWarningCard — SMS DLT compliance warning */

import { useLanguage } from '@/hooks/useLanguage'

interface Props {
  hasDltId: boolean
  isRegistered: boolean
}

export function DltWarningCard({ hasDltId, isRegistered }: Props) {
  const { t } = useLanguage()
  if (hasDltId && isRegistered) return null

  const message = !hasDltId ? t.marketingDltMissingMsg : t.marketingDltUnregisteredMsg

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        gap: '10px',
        padding: '12px 14px',
        borderRadius: '10px',
        background: 'var(--color-warning-50, #fef9c3)',
        border: '1px solid var(--color-warning-200, #fde68a)',
        color: 'var(--color-warning-800, #78350f)',
        fontSize: '13px',
        lineHeight: '1.5',
        marginBottom: '16px',
      }}
    >
      <span style={{ flexShrink: 0, marginTop: '2px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </span>
      <span>{message}</span>
    </div>
  )
}
