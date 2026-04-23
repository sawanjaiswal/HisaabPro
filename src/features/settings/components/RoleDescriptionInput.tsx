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
    <div className="role-description-input">
      <label htmlFor="role-description" style={LABEL_STYLE}>
        {t.descriptionOptional}{' '}
        <span className="role-description-optional">
          {t.optionalSuffix}
        </span>
      </label>
      <textarea
        id="role-description"
        className="input input-textarea"
        placeholder={t.roleDescPlaceholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={200}
      />
    </div>
  )
}
