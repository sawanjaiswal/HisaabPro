/** List section header — "Recent Parties" title + Sort dropdown (mockup v2). */

import React from 'react'
import { ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/DropdownMenu'
import { useLanguage } from '@/hooks/useLanguage'
import { SORT_OPTIONS } from '../party.constants'
import type { PartyFilters } from '../party.types'

interface PartyListHeaderProps {
  onSortChange: (sortBy: PartyFilters['sortBy']) => void
}

export const PartyListHeader: React.FC<PartyListHeaderProps> = ({ onSortChange }) => {
  const { t } = useLanguage()

  return (
    <div className="party-section-header">
      <h2 className="party-section-title">{t.recentParties}</h2>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="none" className="party-sort-btn" aria-label={t.sortLabel}>
            <ArrowUpDown size={16} aria-hidden="true" />
            <span>{t.sortLabel}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {SORT_OPTIONS.map((option) => (
            <DropdownMenuItem key={option.value} onSelect={() => onSortChange(option.value)}>
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
