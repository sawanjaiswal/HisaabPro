/** #147 ReconcileSummary — tab strip across reconciliation statuses. */
import { useLanguage } from '@/hooks/useLanguage'
import { TABS } from '../bank-reconciliation.constants'
import type { ReconTab } from '../bank-reconciliation.types'

interface Props {
  active: ReconTab
  onChange: (tab: ReconTab) => void
}

export function ReconcileSummary({ active, onChange }: Props) {
  const { t } = useLanguage()
  return (
    <div className="recon-tabs" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={active === tab.key}
          className="recon-tabs__tab"
          data-active={active === tab.key}
          onClick={() => onChange(tab.key)}
        >
          {t[tab.labelKey as keyof typeof t]}
        </button>
      ))}
    </div>
  )
}
