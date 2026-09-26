/** Party Search Input — SSOT backed party typeahead with instant client creation */

import React, { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { getParties } from '@/lib/services/party.service'
import { getParty } from '@/features/parties/party.service'
import type { PartySummary, PartyType } from '@/lib/types/party.types'
import { EntitySearch } from '@/components/ui/EntitySearch'
import { PartyAvatar } from '@/components/ui/PartyAvatar'
import { PartyBalanceChip } from './PartyBalanceChip'
import { useInstantAddParty } from './useInstantAddParty'
import { Button } from '@/components/ui/Button'

interface PartySearchInputProps {
  value: string
  onChange: (id: string, name: string) => void
  error?: string
  showLabel?: boolean
}

export const PartySearchInput: React.FC<PartySearchInputProps> = ({
  value,
  onChange,
  error,
  showLabel = true,
}) => {
  const { t } = useLanguage()
  const [selectedName, setSelectedName] = useState('')

  const PARTY_TYPE_LABELS: Record<PartyType, string> = {
    CUSTOMER: t.customer || 'Customer',
    SUPPLIER: t.supplier || 'Supplier',
    BOTH: t.both || 'Both',
    STAFF: 'Staff',
  }

  // Resolve selected name if value is passed from props
  useEffect(() => {
    if (!value) {
      setSelectedName('')
      return
    }
    if (selectedName) return

    const controller = new AbortController()
    getParty(value, controller.signal)
      .then((p) => {
        if (p?.name) {
          setSelectedName(p.name)
          onChange(p.id, p.name)
        }
      })
      .catch(() => {})

    return () => controller.abort()
  }, [value, selectedName, onChange])

  const { isCreating, addParty } = useInstantAddParty({
    onCreated: (id, name) => {
      setSelectedName(name)
      onChange(id, name)
    },
    onError: () => {},
  })

  const handleFetchResults = useCallback(async (query: string, signal: AbortSignal) => {
    const res = await getParties(
      query ? { search: query, limit: 8 } : { limit: 8 },
      signal,
    )
    return res.parties
  }, [])

  const handleMapToItem = useCallback(
    (party: PartySummary) => ({
      id: party.id,
      title: party.name,
      subtitle: party.phone,
      badge: {
        text: PARTY_TYPE_LABELS[party.type] || party.type,
        variant: party.type.toLowerCase() as any,
      },
    }),
    [PARTY_TYPE_LABELS],
  )

  const handleSelect = useCallback(
    (party: PartySummary) => {
      setSelectedName(party.name)
      onChange(party.id, party.name)
    },
    [onChange],
  )

  const handleClear = useCallback(() => {
    setSelectedName('')
    onChange('', '')
  }, [onChange])

  return (
    <EntitySearch<PartySummary>
      id="party-search-input"
      label={showLabel ? (t.customerSupplierLabel || 'Customer / Supplier') : undefined}
      placeholder={t.searchPartyNamePhone || 'Search party name or phone...'}
      selectedId={value}
      selectedTitle={selectedName}
      onSelect={handleSelect}
      onClearSelection={handleClear}
      onFetchResults={handleFetchResults}
      mapToItem={handleMapToItem}
      entityName={t.customer || 'client'}
      entityPlural="clients"
      onCreateOption={addParty}
      isCreating={isCreating}
      error={error}
      renderSelected={({ title, onClear }) => (
        <div className="bg-[#F8F9FA] rounded-2xl p-3.5 flex items-center justify-between w-full" role="status" aria-label={`Selected: ${title}`}>
          <div className="flex items-center gap-3 min-w-0">
            <PartyAvatar name={title} size="md" className="flex-shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-base text-slate-900 leading-tight truncate">{title}</span>
              <div className="mt-1">
                <PartyBalanceChip partyId={value} />
              </div>
            </div>
          </div>
          <Button
            variant="none"
            size="sm"
            type="button"
            onClick={onClear}
            className="border border-[#026F39] text-[#026F39] hover:bg-emerald-50 bg-white font-semibold text-xs px-3.5 py-1.5 rounded-lg shrink-0 ml-3 transition-colors cursor-pointer"
            aria-label={t.changeSelectedParty || 'Change'}
          >
            {t.changeLabel || 'Change'}
          </Button>
        </div>
      )}
    />
  )
}
