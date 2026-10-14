/** JobDetailPage — /jobs/:id — header, status pill, actions, items, convert CTA */

import { Text } from '@/components/ui/Text'
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
import { Heading } from '@/components/ui/Heading'
import { Card } from '@/components/ui/Card'

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-label="Loading job details">
      {[180, 120, 80, 60, 250].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: i === 4 ? 120 : 44, borderRadius: 8, width: `${w}px`, maxWidth: '100%' }} aria-hidden="true" />
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <Heading level={2} className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider m-0">{title}</Heading>
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
        <div className="flex flex-col gap-5">

        {/* Header card */}
        <Card className="p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <Heading level={1} className="text-lg font-bold text-[var(--color-text)] m-0 leading-snug">{job.title}</Heading>
            <JobStatusPill status={job.status} size="md" />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <User size={14} aria-hidden="true" />
              <span>{job.partyName}</span>
            </div>
            {scheduled && (
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <Calendar size={14} aria-hidden="true" />
                <span>{scheduled}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 font-bold text-xl text-[var(--color-text)]">
            <IndianRupee size={18} aria-hidden="true" />
            {formatPaise(job.totalPaise)}
          </div>

          {job.description && (
            <Text className="text-sm text-[var(--color-text-secondary)] m-0">
              {job.description}
            </Text>
          )}
        </Card>

        {/* Status actions */}
        {job.status !== 'INVOICED' && job.status !== 'CANCELLED' && (
          <Section title={t.jobActionsSection}>
            <JobStatusActions jobId={id} jobTitle={job.title} currentStatus={job.status} />
          </Section>
        )}

        {/* Convert to invoice CTA */}
        {job.status === 'COMPLETED' && !job.invoiceId && (
          <Section title={t.jobInvoiceSection}>
            <Text className="text-sm text-[var(--color-text-secondary)] m-0">
              {t.jobCompleteInvoiceHint}
            </Text>
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
              className="self-start min-h-[44px]"
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
        <div className="border-t border-[var(--color-border)] pt-3 flex flex-col gap-1 items-end">
          {job.discountPaise > 0 && (
            <div className="flex gap-4 text-sm text-red-600">
              <span>{t.jobDiscountLabel}</span>
              <span>-₹{formatPaise(job.discountPaise)}</span>
            </div>
          )}
          <div className="flex gap-4 font-bold text-base text-[var(--color-text)]">
            <span>{t.jobTotalLabel}</span>
            <span>₹{formatPaise(job.totalPaise)}</span>
          </div>
        </div>

        {/* Cancel info */}
        {job.status === 'CANCELLED' && job.cancelReason && (
          <div className="p-3 bg-red-50 rounded-lg">
            <Text className="m-0 text-sm text-red-700">
              <strong>{t.jobCancelledLabel}</strong> {job.cancelReason}
            </Text>
          </div>
        )}
        </div>
      </PageContainer>
    </AppShell>
  )
}
