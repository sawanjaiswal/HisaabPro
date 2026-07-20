/** Advanced-filter drawer — holds the status filter (All / Due / Active /
 * Inactive) that moved out of the chip row when chips became party-type. */

import React from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { PARTY_STATUS_OPTIONS, type PartyStatusFilter } from '../party.constants'

interface PartyFilterDrawerProps {
  open: boolean
  onClose: () => void
  activeStatus: PartyStatusFilter
  onStatusChange: (status: PartyStatusFilter) => void
}

export const PartyFilterDrawer: React.FC<PartyFilterDrawerProps> = ({
  open,
  onClose,
  activeStatus,
  onStatusChange,
}) => {
  const { t } = useLanguage()

  return (
    <Drawer open={open} onClose={onClose} title={t.filters} size="sm">
      <div className="party-filter-drawer-body">
        <p className="party-filter-drawer-label">{t.filterByStatus}</p>
        <div className="status-pills" role="group" aria-label={t.filterByStatus}>
          {PARTY_STATUS_OPTIONS.map((option) => {
            const isActive = activeStatus === option.value
            return (
              <Button
                variant="none"
                key={option.value}
                className={`status-pill status-pill--${option.tone}${isActive ? ' status-pill--on' : ''}`}
                onClick={() => {
                  onStatusChange(option.value)
                  onClose()
                }}
                aria-pressed={isActive}
              >
                {t[option.labelKey]}
              </Button>
            )
          })}
        </div>
      </div>
    </Drawer>
  )
}
