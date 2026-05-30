/** Settings — Sticky save bar for role builder form */

import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'

interface RoleSaveBarProps {
  isEditMode: boolean
  isSubmitting: boolean
  onSave: () => void
}

export function RoleSaveBar({ isEditMode, isSubmitting, onSave }: RoleSaveBarProps) {
  const { t } = useLanguage()
  return (
    <div className="role-save-bar">
      <Button variant="none"
        type="button"
        className="role-save-button"
        onClick={onSave}
        disabled={isSubmitting}
        aria-label={isEditMode ? t.saveRoleChanges : t.createRole}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? t.saving : t.saveRole}
      </Button>
    </div>
  )
}
