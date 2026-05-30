/** AudiencePicker — segment filter builder with live count preview */

import { useLanguage } from '@/hooks/useLanguage'
import { Select, SelectItem } from '@/components/ui/Select'
import type { SegmentFilter } from '../marketing.types'
import { useSegmentPreview } from '../hooks/useSegmentPreview'
import { Input } from '@/components/ui/Input'

interface Props {
  value: SegmentFilter
  onChange: (filter: SegmentFilter) => void
}

export function AudiencePicker({ value, onChange }: Props) {
  const { t } = useLanguage()
  const { preview, loading, error, tooLarge } = useSegmentPreview(value)

  const update = <K extends keyof SegmentFilter>(key: K, val: SegmentFilter[K] | undefined) => {
    if (val === undefined || val === '' || val === null) {
      const next = { ...value }
      delete next[key]
      onChange(next)
    } else {
      onChange({ ...value, [key]: val })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Party type */}
      <div>
        <label style={labelStyle} htmlFor="seg-party-type">{t.marketingPartyType}</label>
        <Select
          value={value.partyType ?? 'CUSTOMER'}
          onValueChange={(v) => update('partyType', v as SegmentFilter['partyType'])}
          ariaLabel={t.marketingPartyType}
        >
          <SelectItem value="CUSTOMER">{t.marketingPartyCustomer}</SelectItem>
          <SelectItem value="SUPPLIER">{t.marketingPartySupplier}</SelectItem>
          <SelectItem value="BOTH">{t.marketingPartyBoth}</SelectItem>
        </Select>
      </div>

      {/* Tags */}
      <div>
        <label style={labelStyle} htmlFor="seg-tags">{t.marketingTagsLabel}</label>
        <Input
          id="seg-tags"
          type="text"
          placeholder={t.marketingTagsPh}
          value={value.tags?.join(', ') ?? ''}
          onChange={(e) => {
            const tags = e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean)
            update('tags', tags.length > 0 ? tags : undefined)
          }}
          style={inputStyle}
        />
      </div>

      {/* City */}
      <div>
        <label style={labelStyle} htmlFor="seg-city">{t.marketingCityLabel}</label>
        <Input
          id="seg-city"
          type="text"
          placeholder={t.marketingCityPh}
          value={value.cityContains ?? ''}
          onChange={(e) => update('cityContains', e.target.value || undefined)}
          maxLength={60}
          style={inputStyle}
        />
      </div>

      {/* Inactive days */}
      <div>
        <label style={labelStyle} htmlFor="seg-inactive">{t.marketingInactiveDaysLabel}</label>
        <Input
          id="seg-inactive"
          type="number"
          min={0}
          max={3650}
          placeholder={t.marketingInactiveDaysPh}
          value={value.inactiveDays ?? ''}
          onChange={(e) => update('inactiveDays', e.target.value ? parseInt(e.target.value, 10) : undefined)}
          style={inputStyle}
        />
      </div>

      {/* Outstanding */}
      <div>
        <label style={labelStyle} htmlFor="seg-outstanding">{t.marketingOutstandingLabel}</label>
        <Input
          id="seg-outstanding"
          type="number"
          min={0}
          placeholder={t.marketingOutstandingPh}
          value={value.outstandingGtePaise != null ? Math.floor(value.outstandingGtePaise / 100) : ''}
          onChange={(e) => {
            const rupees = parseInt(e.target.value, 10)
            update('outstandingGtePaise', Number.isFinite(rupees) && rupees >= 0 ? rupees * 100 : undefined)
          }}
          style={inputStyle}
        />
      </div>

      {/* Birthday this week */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: 'var(--color-gray-700)' }}>
        <Input
          type="checkbox"
          checked={value.birthdayThisWeek ?? false}
          onChange={(e) => update('birthdayThisWeek', e.target.checked || undefined)}
          style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary-600)' }}
        />
        {t.marketingBirthdayThisWeek}
      </label>

      {/* Preview chip */}
      <div style={{ marginTop: '4px' }}>
        {loading && (
          <span style={chipStyle('var(--color-gray-400)')}>{t.marketingCountingRecipients}</span>
        )}
        {!loading && error && (
          <span style={chipStyle('var(--color-error-600)', 'var(--color-error-50)')}>{error}</span>
        )}
        {!loading && !error && preview != null && (
          <span style={chipStyle(
            tooLarge ? 'var(--color-error-700)' : 'var(--color-primary-700)',
            tooLarge ? 'var(--color-error-50)' : 'var(--color-primary-50)',
          )}>
            {tooLarge
              ? t.marketingTooLargeChip
              : `~${preview.count.toLocaleString('en-IN')} ${t.marketingApproxCustomers}`
            }
          </span>
        )}
        {!loading && !error && preview == null && (
          <span style={chipStyle('var(--color-gray-400)')}>{t.marketingEnterFilters}</span>
        )}
      </div>
    </div>
  )
}

function chipStyle(color: string, bg = 'var(--color-gray-100)'): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '999px',
    background: bg,
    color,
    fontSize: '13px',
    fontWeight: 600,
    border: `1px solid ${color}30`,
  }
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-gray-700)',
  marginBottom: '6px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid var(--color-gray-300)',
  fontSize: '14px',
  color: 'var(--color-gray-800)',
  background: 'white',
  boxSizing: 'border-box',
}

