/**
 * CommitmentsSection — PTP list rendered on PartyDetailPage.
 * Shows all promises (any status), OPEN rows have edit + delete.
 */

import { useState } from 'react'
import { Pencil, Trash2, Lock } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise, formatDate } from '@/lib/format'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { usePtpList, useDeletePtp } from './usePtp'
import { PtpRecorderForm } from './PtpRecorderForm'
import type { Ptp, PtpStatus } from './collections.types'

interface Props {
  partyId: string
  partyName: string
}

const STATUS_CLASSES: Record<PtpStatus, string> = {
  OPEN:      'badge-info',
  KEPT:      'badge-paid',
  BROKEN:    'badge-overdue',
  CANCELLED: 'badge-draft',
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

  return (
    <section aria-labelledby="commitments-heading" style={{ marginTop: 'var(--space-6)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-3)',
        }}
      >
        <h3
          id="commitments-heading"
          style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)' }}
        >
          {t.ptpSectionTitle}
        </h3>
        <button
          className="btn btn-ghost btn-sm"
          onClick={openCreate}
          aria-label={t.ptpRecordPromise}
        >
          + {t.ptpRecordPromise}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <Skeleton height="3.5rem" borderRadius="var(--radius-lg)" count={3} />
      )}

      {/* Error */}
      {isError && (
        <p
          className="form-error"
          role="alert"
          style={{ marginBottom: 'var(--space-2)', cursor: 'pointer' }}
          onClick={() => refetch()}
        >
          {t.ptpLoadError} — {t.agingRetry}
        </p>
      )}

      {/* Empty */}
      {!isLoading && !isError && (!data?.data || data.data.length === 0) && (
        <EmptyState
          title={t.ptpEmpty}
          description={t.ptpEmptyDesc}
          action={
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              {t.ptpRecordPromise}
            </button>
          }
        />
      )}

      {/* List */}
      {!isLoading && !isError && data?.data && data.data.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {data.data.map((ptp) => (
            <li
              key={ptp.id}
              className="card-primary"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 'var(--space-2)',
                padding: 'var(--space-3)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {formatPaise(ptp.amountPaise)}
                  </span>
                  <span
                    className={`badge ${STATUS_CLASSES[ptp.status]}`}
                    aria-label={`${t.ptpStatusLabel}: ${ptp.status}`}
                  >
                    {ptp.status}
                  </span>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                  {t.ptpByLabel} {formatDate(ptp.promisedDate)}
                </p>
                {ptp.note && (
                  <p
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-text-tertiary)',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}
                    title={ptp.note}
                  >
                    {ptp.note}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexShrink: 0 }}>
                {ptp.status === 'OPEN' ? (
                  <>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => openEdit(ptp)}
                      aria-label={t.ptpEditAria}
                      style={{ minWidth: 44, minHeight: 44 }}
                    >
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setDeleteTarget(ptp)}
                      aria-label={t.ptpDeleteAria}
                      style={{ minWidth: 44, minHeight: 44, color: 'var(--color-error)' }}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <span
                    style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}
                    aria-label={t.ptpLockedHint}
                  >
                    <Lock size={12} aria-hidden="true" />
                    {t.ptpLockedHint}
                  </span>
                )}
              </div>
            </li>
          ))}
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
