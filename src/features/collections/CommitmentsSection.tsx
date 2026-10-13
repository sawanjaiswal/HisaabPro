/**
 * CommitmentsSection — PTP list rendered on PartyDetailPage.
 * Shows all promises (any status), OPEN rows have edit + delete.
 */

import { Text } from '@/components/ui/Text'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Pencil, Trash2, Lock, CalendarCheck, Plus } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise, formatDate } from '@/lib/format'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/feedback/Skeleton'
import { usePtpList, useDeletePtp } from './usePtp'
import { PtpRecorderForm } from './PtpRecorderForm'
import type { Ptp, PtpStatus } from './collections.types'

interface Props {
  partyId: string
  partyName: string
}

const STATUS_BADGES: Record<PtpStatus, { bg: string; text: string }> = {
  OPEN: { bg: 'bg-[var(--color-primary-50)]', text: 'text-[var(--color-primary-700)]' },
  KEPT: { bg: 'bg-[var(--color-success-50)]', text: 'text-[var(--color-success-700)]' },
  BROKEN: { bg: 'bg-[var(--color-error-50)]', text: 'text-[var(--color-error-700)]' },
  CANCELLED: { bg: 'bg-[var(--color-gray-100)]', text: 'text-[var(--text-muted)]' },
}

export function CommitmentsSection({ partyId, partyName }: Props) {
  const { t } = useLanguage()
  const { data, isLoading, isError, refetch } = usePtpList(partyId)
  const deleteMutation = useDeletePtp(partyId)

  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Ptp | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<Ptp | null>(null)

  function openCreate() { setEditTarget(undefined); setFormOpen(true) }
  function openEdit(ptp: Ptp) { setEditTarget(ptp); setFormOpen(true) }
  function closeForm() { setFormOpen(false); setEditTarget(undefined) }

  function confirmDelete() {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.id, {
      onSettled: () => setDeleteTarget(null),
    })
  }

  const list = data?.data || []

  return (
    <section aria-labelledby="commitments-heading" className="card p-4 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-surface)] shadow-xs">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--color-gray-100)]">
        <div className="flex items-center gap-2">
          <CalendarCheck size={15} className="text-[var(--color-primary-600)]" />
          <span id="commitments-heading" className="text-sm font-bold text-[var(--text-primary)]">
            {t.ptpSectionTitle}
          </span>
          {list.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
              {list.length}
            </span>
          )}
        </div>
        {list.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={openCreate}
            aria-label={t.ptpRecordPromise}
            className="text-xs font-semibold text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] h-7 px-2"
          >
            <Plus size={14} className="mr-1" />
            {t.ptpRecordPromise}
          </Button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <Skeleton height="3.5rem" borderRadius="var(--radius-lg)" count={2} />
      )}

      {/* Error */}
      {isError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border border-[var(--color-error-300)] bg-[var(--color-error-50)] text-xs text-[var(--color-error-800)] flex items-center justify-between gap-3 shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--color-error-600)] shrink-0" aria-hidden="true" />
            <span className="font-semibold">{t.ptpLoadError}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-7 text-xs font-semibold border-[var(--color-error-300)] text-[var(--color-error-700)] hover:bg-[var(--color-error-100)]"
          >
            {t.agingRetry}
          </Button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && list.length === 0 && (
        <div className="py-6 flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 rounded-full bg-[var(--color-primary-50)] flex items-center justify-center mb-2 text-[var(--color-primary-600)]">
            <CalendarCheck size={20} aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">{t.ptpEmpty}</p>
          <p className="text-xs text-[var(--text-muted)] max-w-xs mb-3">{t.ptpEmptyDesc}</p>
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus size={14} className="mr-1" />
            {t.ptpRecordPromise}
          </Button>
        </div>
      )}

      {/* List */}
      {!isLoading && !isError && list.length > 0 && (
        <ul className="space-y-2 list-none p-0 m-0">
          {list.map((ptp) => {
            const badgeStyle = STATUS_BADGES[ptp.status] || STATUS_BADGES.OPEN
            return (
              <li
                key={ptp.id}
                className="p-3 rounded-lg border border-[var(--color-gray-100)] bg-[var(--color-gray-50)] flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      {formatPaise(ptp.amountPaise)}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badgeStyle.bg} ${badgeStyle.text}`}
                      aria-label={`${t.ptpStatusLabel}: ${ptp.status}`}
                    >
                      {ptp.status}
                    </span>
                  </div>
                  <Text className="text-xs text-[var(--text-secondary)] mt-1">
                    {t.ptpByLabel} {formatDate(ptp.promiseDate)}
                  </Text>
                  {ptp.notes && (
                    <Text
                      className="text-xs text-[var(--text-muted)] mt-0.5 truncate max-w-full"
                      title={ptp.notes}
                    >
                      {ptp.notes}
                    </Text>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {ptp.status === 'OPEN' ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(ptp)}
                        aria-label={t.ptpEditAria}
                        className="w-8 h-8 p-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(ptp)}
                        aria-label={t.ptpDeleteAria}
                        className="w-8 h-8 p-0 text-[var(--color-error-600)] hover:text-[var(--color-error-700)] hover:bg-[var(--color-error-50)]"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </Button>
                    </>
                  ) : (
                    <span
                      className="text-[10px] text-[var(--text-muted)] flex items-center gap-1"
                      aria-label={t.ptpLockedHint}
                    >
                      <Lock size={12} aria-hidden="true" />
                      {t.ptpLockedHint}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Create / Edit form */}
      <PtpRecorderForm
        open={formOpen}
        onClose={closeForm}
        partyId={partyId}
        partyName={partyName}
        existingPtp={editTarget}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={t.ptpDeleteTitle}
        description={t.ptpDeleteDesc}
        isLoading={deleteMutation.isPending}
      />
    </section>
  )
}
