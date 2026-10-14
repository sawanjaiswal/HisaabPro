/** Settings — Template pills for cloning permissions from system roles (create mode only) */

import { Text } from '@/components/ui/Text'
import type { Role } from '../settings.types'
import { useLanguage } from '@/hooks/useLanguage'
import { SYSTEM_ROLE_NAMES } from '../role.constants'
import { Button } from '@/components/ui/Button'

const TEMPLATE_NAMES = [...SYSTEM_ROLE_NAMES] as const

interface RoleTemplatePillsProps {
  systemRoles: Role[]
  onCloneTemplate: (role: Role) => void
  onClearPermissions: () => void
}

export function RoleTemplatePills({
  systemRoles,
  onCloneTemplate,
  onClearPermissions,
}: RoleTemplatePillsProps) {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col gap-2">
      <Text className="text-xs font-semibold text-[var(--color-gray-600)] uppercase tracking-wider">{t.startFromTemplate}</Text>
      <div className="flex flex-wrap gap-2">
        {TEMPLATE_NAMES.map((name) => {
          const templateRole = systemRoles.find((r) => r.name === name)
          return (
            <Button
              key={name}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (templateRole !== undefined) {
                  onCloneTemplate(templateRole)
                }
              }}
              disabled={templateRole === undefined}
              aria-label={`${t.useTemplatePrefix} ${name} ${t.useTemplateSuffix}`}
            >
              {name}
            </Button>
          )
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClearPermissions}
          aria-label={t.startFromBlankDesc}
        >
          {t.blankLabel}
        </Button>
      </div>
    </div>
  )
}
