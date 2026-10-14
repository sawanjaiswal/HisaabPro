/** AudiencePicker — segment filter builder with live count preview */

import { useLanguage } from '@/hooks/useLanguage'
import { Select, SelectItem } from '@/components/ui/Select'
import type { SegmentFilter } from '../marketing.types'
import { useSegmentPreview } from '../hooks/useSegmentPreview'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Checkbox'
import { Badge } from '@/components/ui/Badge'

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
    <div className="flex flex-col gap-4">
      {/* Party type */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5" htmlFor="seg-party-type">{t.marketingPartyType}</label>
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
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5" htmlFor="seg-tags">{t.marketingTagsLabel}</label>
        <Input
          id="seg-tags"
          type="text"
          placeholder={t.marketingTagsPh}
          value={value.tags?.join(', ') ?? ''}
          onChange={(e) => {
            const tags = e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean)
            update('tags', tags.length > 0 ? tags : undefined)
          }}
        />
      </div>

      {/* City */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5" htmlFor="seg-city">{t.marketingCityLabel}</label>
        <Input
          id="seg-city"
          type="text"
          placeholder={t.marketingCityPh}
          value={value.cityContains ?? ''}
          onChange={(e) => update('cityContains', e.target.value || undefined)}
          maxLength={60}
        />
      </div>

      {/* Inactive days */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5" htmlFor="seg-inactive">{t.marketingInactiveDaysLabel}</label>
        <Input
          id="seg-inactive"
          type="number"
          min={0}
          max={3650}
          placeholder={t.marketingInactiveDaysPh}
          value={value.inactiveDays ?? ''}
          onChange={(e) => update('inactiveDays', e.target.value ? parseInt(e.target.value, 10) : undefined)}
        />
      </div>

      {/* Outstanding */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5" htmlFor="seg-outstanding">{t.marketingOutstandingLabel}</label>
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
        />
      </div>

      {/* Birthday this week */}
      <div className="pt-1">
        <Checkbox
          checked={value.birthdayThisWeek ?? false}
          onCheckedChange={(checked) => update('birthdayThisWeek', Boolean(checked) || undefined)}
          label={t.marketingBirthdayThisWeek}
        />
      </div>

      {/* Preview chip */}
      <div className="mt-1">
        {loading && (
          <Badge variant="secondary">{t.marketingCountingRecipients}</Badge>
        )}
        {!loading && error && (
          <Badge variant="danger">{error}</Badge>
        )}
        {!loading && !error && preview != null && (
          <Badge variant={tooLarge ? 'danger' : 'secondary'} className="text-xs font-semibold">
            {tooLarge
              ? t.marketingTooLargeChip
              : `~${preview.count.toLocaleString('en-IN')} ${t.marketingApproxCustomers}`
            }
          </Badge>
        )}
        {!loading && !error && preview == null && (
          <Badge variant="secondary">{t.marketingEnterFilters}</Badge>
        )}
      </div>
    </div>
  )
}

