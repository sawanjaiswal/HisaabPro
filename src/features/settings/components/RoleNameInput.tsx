/** Settings — Role name text input with validation error display */

import { Text } from '@/components/ui/Text'
import { useLanguage } from '@/hooks/useLanguage'
import { Input } from '@/components/ui/Input'

interface RoleNameInputProps {
  value: string
  error: string | undefined
  onChange: (value: string) => void
}

export function RoleNameInput({ value, error, onChange }: RoleNameInputProps) {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="role-name" className="text-xs font-semibold text-[var(--color-gray-600)] uppercase tracking-wider">
        {t.roleNameLabel}
      </label>
      <Input
        id="role-name"
        type="text"
        className="input"
        placeholder={t.roleNamePlaceholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={error ? 'role-name-error' : undefined}
        aria-invalid={error !== undefined}
        maxLength={80}
        autoComplete="off"
      />
      {error && (
        <Text id="role-name-error" className="input-error" role="alert">
          {error}
        </Text>
      )}
    </div>
  )
}
