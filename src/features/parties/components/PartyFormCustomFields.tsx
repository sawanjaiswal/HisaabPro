/** Party form — Custom Fields section.
 *
 * Reads PARTY-scoped CustomFieldDefinitions and renders an input per def.
 * Type-switched UI: TEXT / MULTILINE / NUMBER / DATE / DROPDOWN.
 *
 * Server contract: all values are stored as strings (party schema enforces
 * `value: z.string().min(1)`). NUMBER / DATE inputs stringify before save —
 * the form-hook strips empty values before submit.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { Input } from '@/components/ui/Input'
import { DateField } from '@/components/ui/DateField'
import { Textarea } from '@/components/ui/Textarea'
import { Select, SelectItem } from '@/components/ui/Select'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { getPartyCustomFields, type CustomFieldDefinition } from '../party-custom-field.service'
import type { PartyFormData } from '../party.types'

interface Props {
  form: PartyFormData
  onUpdate: <K extends keyof PartyFormData>(key: K, value: PartyFormData[K]) => void
}

type LoadState = 'loading' | 'error' | 'ready'

export function PartyFormCustomFields({ form, onUpdate }: Props) {
  const { t } = useLanguage()
  const [defs, setDefs] = useState<CustomFieldDefinition[]>([])
  const [status, setStatus] = useState<LoadState>('loading')

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    getPartyCustomFields(controller.signal)
      .then(rows => {
        const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder)
        setDefs(sorted)
        setStatus('ready')
      })
      .catch(err => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
      })
    return () => controller.abort()
  }, [])

  const valueByFieldId = useMemo(() => {
    const map = new Map<string, string>()
    for (const cf of form.customFields) map.set(cf.fieldId, cf.value)
    return map
  }, [form.customFields])

  const setValue = useCallback(
    (fieldId: string, value: string) => {
      const next = form.customFields.filter(cf => cf.fieldId !== fieldId)
      if (value !== '') next.push({ fieldId, value })
      onUpdate('customFields', next)
    },
    [form.customFields, onUpdate],
  )

  if (status === 'loading') {
    return (
      <div className="space-y-4">
        <Skeleton height="3.5rem" borderRadius="var(--radius-md)" count={3} />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <ErrorState
        title={t.couldNotLoadParty}
        message={t.checkConnectionRetry}
        onRetry={() => window.location.reload()}
      />
    )
  }

  if (defs.length === 0) {
    return (
      <EmptyState
        title={t.noCustomFields}
        description={t.noCustomFieldsDescription}
      />
    )
  }

  return (
    <div className="card space-y-4">
      <h3 className="section-title py-0 section-title--mb-3">{t.customFields}</h3>

      {defs.map(def => {
        const raw = valueByFieldId.get(def.id) ?? ''
        return (
          <div key={def.id} className="space-y-1.5">
            <label className="label" htmlFor={`cf-${def.id}`}>
              {def.name}
              {def.required && (
                <span className="ml-1" style={{ color: 'var(--color-error-500)' }}>*</span>
              )}
            </label>

            {def.fieldType === 'TEXT' && (
              <Input
                id={`cf-${def.id}`}
                type="text"
                className="input"
                value={raw}
                onChange={e => setValue(def.id, e.target.value)}
                maxLength={500}
              />
            )}

            {def.fieldType === 'MULTILINE' && (
              <Textarea
                id={`cf-${def.id}`}
                className="input"
                value={raw}
                onChange={e => setValue(def.id, e.target.value)}
                maxLength={2000}
                rows={4}
              />
            )}

            {def.fieldType === 'NUMBER' && (
              <Input
                id={`cf-${def.id}`}
                type="number"
                inputMode="decimal"
                className="input"
                value={raw}
                onChange={e => setValue(def.id, e.target.value)}
                onKeyDown={e => {
                  if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault()
                }}
              />
            )}

            {def.fieldType === 'DATE' && (
              <DateField
                id={`cf-${def.id}`}
                type="date"
                className="input"
                value={raw}
                onChange={e => setValue(def.id, e.target.value)}
              />
            )}

            {def.fieldType === 'DROPDOWN' && (
              <Select
                value={raw || undefined}
                onValueChange={v => setValue(def.id, v ?? '')}
                ariaLabel={def.name}
                placeholder={t.selectOption}
              >
                {def.options.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </Select>
            )}
          </div>
        )
      })}
    </div>
  )
}
