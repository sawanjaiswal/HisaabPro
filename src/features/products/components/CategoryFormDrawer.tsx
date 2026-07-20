/** Category create / rename sheet (mockup #53's "+" action).
 *
 * One field. Categories carry a colour too, but it is assigned server-side on
 * create and never surfaced in the mockup, so the sheet does not invent a
 * picker for it.
 */

import React, { useEffect, useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/hooks/useLanguage'
import type { Category } from '../product.types'

interface CategoryFormDrawerProps {
  /** A Category renames it; 'new' creates; null keeps the sheet closed. */
  editing: Category | 'new' | null
  onClose: () => void
  onSave: (name: string) => Promise<void>
  isSaving: boolean
}

export const CategoryFormDrawer: React.FC<CategoryFormDrawerProps> = ({
  editing,
  onClose,
  onSave,
  isSaving,
}) => {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Reseed whenever the sheet opens on a different target.
  useEffect(() => {
    setName(editing && editing !== 'new' ? editing.name : '')
    setError(null)
  }, [editing])

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t.categoryNameRequired)
      return
    }
    await onSave(trimmed)
  }

  return (
    <Drawer
      open={editing !== null}
      onClose={onClose}
      title={editing === 'new' ? t.addCategory : t.renameCategory}
      size="sm"
      footer={
        <div className="category-form-actions">
          <Button variant="outline" size="md" onClick={onClose} disabled={isSaving}>
            {t.cancel}
          </Button>
          <Button variant="primary" size="md" onClick={() => void submit()} loading={isSaving}>
            {t.save}
          </Button>
        </div>
      }
    >
      <Input
        label={t.categoryName}
        value={name}
        onChange={(e) => { setName(e.target.value); setError(null) }}
        placeholder={t.categoryNamePlaceholder}
        error={error ?? undefined}
        autoFocus
      />
    </Drawer>
  )
}
