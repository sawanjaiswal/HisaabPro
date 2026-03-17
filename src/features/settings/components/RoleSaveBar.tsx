/** Settings — Sticky save bar for role builder form */

interface RoleSaveBarProps {
  isEditMode: boolean
  isSubmitting: boolean
  onSave: () => void
}

export function RoleSaveBar({ isEditMode, isSubmitting, onSave }: RoleSaveBarProps) {
  return (
    <div className="role-save-bar">
      <button
        type="button"
        className="role-save-button"
        onClick={onSave}
        disabled={isSubmitting}
        aria-label={isEditMode ? 'Save role changes' : 'Create role'}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? 'Saving...' : 'Save Role'}
      </button>
    </div>
  )
}
