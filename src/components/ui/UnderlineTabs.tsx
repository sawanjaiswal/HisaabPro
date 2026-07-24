/** UnderlineTabs — the standard evenly-spaced underline tab bar.
 *
 * The counterpart to the pill-style `Tabs.tsx` (Radix): this is the flat
 * underline control used on detail pages (Customer / Supplier / Invoice).
 * Each tab is sized to its own label and separated by a single uniform gap,
 * so the spacing between tabs stays constant and the underline hugs the text
 * (short labels don't sit inside an over-wide column). Presentational only —
 * the parent owns the active value and the panels.
 *
 *   <UnderlineTabs
 *     tabs={[{ id: 'ledger', label: t.ledgerTab, icon: List }]}
 *     value={activeTab}
 *     onChange={setActiveTab}
 *     ariaLabel={t.partyDetailSections}
 *   />
 */

import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import './underline-tabs.css'

export interface UnderlineTabSpec<T extends string> {
  id: T
  label: string
  icon?: LucideIcon
}

interface UnderlineTabsProps<T extends string> {
  tabs: UnderlineTabSpec<T>[]
  value: T
  onChange: (id: T) => void
  ariaLabel: string
  /** id prefix for the `aria-controls` panel wiring (default `panel`) */
  panelIdPrefix?: string
}

export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  panelIdPrefix = 'panel',
}: UnderlineTabsProps<T>) {
  return (
    <div className="underline-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <Button
          variant="none"
          key={tab.id}
          role="tab"
          className={`underline-tab${value === tab.id ? ' active' : ''}`}
          onClick={() => onChange(tab.id)}
          aria-selected={value === tab.id}
          aria-controls={`${panelIdPrefix}-${tab.id}`}
        >
          {tab.icon && <tab.icon size={16} aria-hidden="true" />}
          {tab.label}
        </Button>
      ))}
    </div>
  )
}
