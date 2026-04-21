/** Settings — Role description textarea (optional field) */

import { useLanguage } from '@/hooks/useLanguage'

interface RoleDescriptionInputProps {
  value: string
  onChange: (value: string) => void
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--fs-xs)',
  fontWeight: 600,
  color: 'var(--color-gray-600)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

export function RoleDescriptionInput({ value, onChange }: RoleDescriptionInputProps) {
  const { t } = useLanguage()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <label htmlFor="role-description" style={LABEL_STYLE}>
        {t.descriptionOptional}{' '}
        <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--color-gray-400)' }}>
          {t.optionalSuffix}
        </span>
      </label>
      <textarea
        id="role-description"
        className="input"
        placeholder={t.roleDescPlaceholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={200}
        style={{ resize: 'vertical', minHeight: '80px' }}
      />
    </div>
  )
}
