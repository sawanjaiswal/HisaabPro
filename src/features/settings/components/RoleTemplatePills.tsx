/** Settings — Template pills for cloning permissions from system roles (create mode only) */

import type { Role } from '../settings.types'
import { SYSTEM_ROLE_NAMES } from '../role.constants'

const TEMPLATE_NAMES = [...SYSTEM_ROLE_NAMES] as const

interface RoleTemplatePillsProps {
  systemRoles: Role[]
  onCloneTemplate: (role: Role) => void
  onClearPermissions: () => void
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-gray-600)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

export function RoleTemplatePills({
  systemRoles,
  onCloneTemplate,
  onClearPermissions,
}: RoleTemplatePillsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <p style={LABEL_STYLE}>Start from Template</p>
      <div className="role-template-pills">
        {TEMPLATE_NAMES.map((name) => {
          const templateRole = systemRoles.find((r) => r.name === name)
          return (
            <button
              key={name}
              type="button"
              className="role-template-pill"
              onClick={() => {
                if (templateRole !== undefined) {
                  onCloneTemplate(templateRole)
                }
              }}
              disabled={templateRole === undefined}
              aria-label={`Use ${name} template`}
            >
              {name}
            </button>
          )
        })}
        <button
          type="button"
          className="role-template-pill"
          onClick={onClearPermissions}
          aria-label="Start from blank — no permissions"
        >
          Blank
        </button>
      </div>
    </div>
  )
}
