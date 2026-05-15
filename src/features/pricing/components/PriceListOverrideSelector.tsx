/** PriceListOverrideSelector — chip + picker drawer for per-document price-list override.
 *
 * 4 UI states:
 *   loading   — skeleton chip under party search
 *   no-lists  — selector hidden entirely
 *   idle      — chip shows party's default tier name (or "Standard" if none)
 *   applied   — chip shows selected tier name + reset icon
 *
 * Placed below PartySearchInput in the Items tab, visible only when partyId is set.
 * Architecture: Epic B PR2, FE-PR2-T1.
 */

import { useState, useCallback } from 'react'
import { ChevronDown, X, Check, Tag } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { useLanguage } from '@/hooks/useLanguage'
import type { PriceList } from '@/features/price-lists/price-list.types'
import './PriceListOverrideSelector.css'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PriceListOverrideSelectorProps {
  /** All available price lists; empty = hide selector */
  availableLists: PriceList[]
  /** True while the list query is loading */
  loading: boolean
  /** Currently effective override id (null = party default) */
  selectedListId: string | null
  /** Party's default list id — used to mark the "default" in the picker */
  partyDefaultListId: string | null
  /** Display name of the currently effective list */
  displayName: string | null
  /** True when a user-selected override is active */
  isOverridden: boolean
  /** Called when user picks a different tier */
  onSelect: (id: string) => void
  /** Called when user taps the reset icon */
  onReset: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PriceListOverrideSelector({
  availableLists,
  loading,
  selectedListId,
  partyDefaultListId,
  displayName,
  isOverridden,
  onSelect,
  onReset,
}: PriceListOverrideSelectorProps) {
  const { t } = useLanguage()
  const [pickerOpen, setPickerOpen] = useState(false)

  const openPicker = useCallback(() => setPickerOpen(true), [])
  const closePicker = useCallback(() => setPickerOpen(false), [])

  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id)
      closePicker()
    },
    [onSelect, closePicker],
  )

  const handleReset = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onReset()
    },
    [onReset],
  )

  // ── State 1: Loading ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="price-override-skeleton" aria-hidden="true" role="presentation" />
    )
  }

  // ── State 2: No price lists defined → hide ────────────────────────────────

  if (availableLists.length === 0) {
    return null
  }

  // ── State 3 + 4: Idle (party default) or Applied (override) ──────────────

  const chipLabel = isOverridden
    ? `${t.overrideTier}: ${displayName ?? ''}`
    : `${t.priceListTier}: ${displayName ?? t.defaultTier}`

  return (
    <>
      {/* Chip */}
      <button
        type="button"
        className={`price-override-chip${isOverridden ? ' price-override-chip--applied' : ''}`}
        onClick={openPicker}
        aria-label={t.selectTier}
        aria-expanded={pickerOpen}
        aria-haspopup="dialog"
      >
        <Tag size={13} aria-hidden="true" />
        <span className="price-override-chip__label">{chipLabel}</span>
        {isOverridden ? (
          // Reset icon — clears override
          <button
            type="button"
            className="price-override-chip__reset"
            onClick={handleReset}
            aria-label={t.resetTier}
          >
            <X size={13} aria-hidden="true" />
          </button>
        ) : (
          <ChevronDown size={13} aria-hidden="true" />
        )}
      </button>

      {/* Picker drawer */}
      <Drawer
        open={pickerOpen}
        onClose={closePicker}
        title={t.selectTier}
        size="sm"
      >
        <PickerList
          availableLists={availableLists}
          selectedListId={selectedListId}
          partyDefaultListId={partyDefaultListId}
          onSelect={handleSelect}
          defaultTierLabel={t.defaultTier}
        />
      </Drawer>
    </>
  )
}

// ─── Sub-component: picker list ───────────────────────────────────────────────

interface PickerListProps {
  availableLists: PriceList[]
  selectedListId: string | null
  partyDefaultListId: string | null
  onSelect: (id: string) => void
  defaultTierLabel: string
}

function PickerList({
  availableLists,
  selectedListId,
  partyDefaultListId,
  onSelect,
  defaultTierLabel,
}: PickerListProps) {
  return (
    <ul className="price-override-picker__list" role="listbox" aria-label="Select price tier">
      {availableLists.map((list) => {
        const isSelected = list.id === selectedListId
        const isPartyDefault = list.id === partyDefaultListId

        return (
          <li key={list.id} role="option" aria-selected={isSelected}>
            <button
              type="button"
              className={`price-override-picker__item${isSelected ? ' price-override-picker__item--selected' : ''}`}
              onClick={() => onSelect(list.id)}
            >
              <div>
                <span className="price-override-picker__item-name">{list.name}</span>
                {isPartyDefault && (
                  <span className="price-override-picker__item-hint"> ({defaultTierLabel})</span>
                )}
              </div>
              {isSelected && (
                <Check size={16} aria-hidden="true" className="text-primary-500" />
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
