/** Settings — Role name text input with validation error display */

interface RoleNameInputProps {
  value: string
  error: string | undefined
  onChange: (value: string) => void
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-gray-600)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

export function RoleNameInput({ value, error, onChange }: RoleNameInputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <label htmlFor="role-name" style={LABEL_STYLE}>
        Role Name
      </label>
      <input
        id="role-name"
        type="text"
        className="input"
        placeholder="e.g. Senior Cashier"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={error ? 'role-name-error' : undefined}
        aria-invalid={error !== undefined}
        maxLength={80}
        autoComplete="off"
      />
      {error && (
        <p id="role-name-error" className="input-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
