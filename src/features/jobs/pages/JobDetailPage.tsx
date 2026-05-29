/** JobDetailPage — /jobs/:id — header, status pill, actions, items, convert CTA */

import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Pencil, Calendar, User, IndianRupee } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useLanguage } from '@/hooks/useLanguage'
import { useJob } from '../hooks/useJob'
import { JobStatusPill } from '../components/JobStatusPill'
import { JobStatusActions } from '../components/JobStatusActions'
import { JobItemsList } from '../components/JobItemsList'
import { JobConvertButton } from '../components/JobConvertButton'
import { formatJobNumber, formatPaise } from '../jobs.utils'
import { JOB_ROUTES } from '../jobs.constants'

function DetailSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }} aria-busy="true" aria-label="Loading job details">
      {[180, 120, 80, 60, 250].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: i === 4 ? 120 : 44, borderRadius: 8, width: `${w}px`, maxWidth: '100%' }} aria-hidden="true" />
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <h2 style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{title}</h2>
      {children}
    </section>
  )
}

export default function JobDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: job, status, refetch } = useJob(id)
  const { t } = useLanguage()
  const isOnline = navigator.onLine

  if (status === 'pending') return <AppShell><Header title={t.jobDetailTitle} /><DetailSkeleton /></AppShell>

  if (status === 'error' || !job) {
    return (
      <AppShell>
        <Header title={t.jobDetailTitle} />
        <PageContainer>
          <ErrorState title={t.couldNotLoadJob} message={t.jobLoadRetryHint} onRetry={refetch} />
        </PageContainer>
      </AppShell>
    )
  }

  const scheduled = job.scheduledAt
    ? new Date(job.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  return (
    <AppShell>
      <Header
        title={formatJobNumber(job.jobNumber, job.id)}
        actions={
          job.status !== 'INVOICED' && job.status !== 'CANCELLED' ? (
            <Button
              type="button"
              variant="ghost" size="sm"
              onClick={() => navigate(JOB_ROUTES.EDIT(id))}
              aria-label="Edit job"
              style={{ minHeight: 44 }}
            >
              <Pencil size={16} aria-hidden="true" />
            </Button>
          ) : undefined
        }
      />

      <PageContainer>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

        {/* Header card */}
        <div style={{ padding: 'var(--space-4)', background: 'var(--color-surface)', borderRadius: 12, boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
            <h1 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.3 }}>{job.title}</h1>
            <JobStatusPill status={job.status} size="md" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
              <User size={14} aria-hidden="true" />
              <span>{job.partyName}</span>
            </div>
            {scheduled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
                <Calendar size={14} aria-hidden="true" />
                <span>{scheduled}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 700, fontSize: 'var(--fs-xl)', color: 'var(--color-text)' }}>
            <IndianRupee size={18} aria-hidden="true" />
            {formatPaise(job.totalPaise)}
          </div>

          {job.description && (
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
              {job.description}
            </p>
          )}
        </div>

        {/* Status actions */}
        {job.status !== 'INVOICED' && job.status !== 'CANCELLED' && (
          <Section title={t.jobActionsSection}>
            <JobStatusActions jobId={id} jobTitle={job.title} currentStatus={job.status} />
          </Section>
        )}

        {/* Convert to invoice CTA */}
        {job.status === 'COMPLETED' && !job.invoiceId && (
          <Section title={t.jobInvoiceSection}>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
              {t.jobCompleteInvoiceHint}
            </p>
            <JobConvertButton jobId={id} jobTitle={job.title} isOnline={isOnline} />
          </Section>
        )}

        {/* Already invoiced */}
        {job.invoiceId && (
          <Section title={t.jobInvoiceSection}>
            <Button
              type="button"
              variant="ghost" size="sm"
              onClick={() => navigate(`/invoices/${job.invoiceId}`)}
              style={{ alignSelf: 'flex-start', minHeight: 44 }}
            >
              {t.viewInvoice}
            </Button>
          </Section>
        )}

        {/* Line items */}
        <Section title={t.jobItemsSection}>
          <JobItemsList items={job.items} />
        </Section>

        {/* Totals */}
        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', alignItems: 'flex-end' }}>
          {job.discountPaise > 0 && (
            <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--fs-sm)', color: 'var(--color-error-600)' }}>
              <span>{t.jobDiscountLabel}</span>
              <span>-₹{formatPaise(job.discountPaise)}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-4)', fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--color-text)' }}>
            <span>{t.jobTotalLabel}</span>
            <span>₹{formatPaise(job.totalPaise)}</span>
          </div>
        </div>

        {/* Cancel info */}
        {job.status === 'CANCELLED' && job.cancelReason && (
          <div style={{ padding: 'var(--space-3)', background: 'var(--color-error-50)', borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--color-error-700)' }}>
              <strong>{t.jobCancelledLabel}</strong> {job.cancelReason}
            </p>
          </div>
        )}
        </div>
      </PageContainer>
    </AppShell>
  )
}
