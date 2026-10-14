/** TemplateListPage — /marketing/templates */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, FileText } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useLanguage } from '@/hooks/useLanguage'
import { useMarketingTemplateList, useDeleteTemplate } from '../hooks/useMarketingTemplates'
import { ChannelBadge } from '../components/ChannelBadge'
import { MARKETING_ROUTES } from '../marketing.constants'
import { formatDate } from '../marketing.utils'
import type { MarketingChannel, MarketingTemplate } from '../marketing.types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'

export default function TemplateListPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [channel, setChannel] = useState<MarketingChannel | undefined>(undefined)
  const [confirmDelete, setConfirmDelete] = useState<MarketingTemplate | null>(null)
  const { templates, status, refresh } = useMarketingTemplateList(channel)
  const deleteMutation = useDeleteTemplate()

  const CHANNEL_FILTERS: Array<{ label: string; value: MarketingChannel | undefined }> = [
    { label: t.marketingAll,      value: undefined },
    { label: t.marketingWhatsapp, value: 'WHATSAPP' },
    { label: t.marketingSms,      value: 'SMS' },
  ]

  return (
    <AppShell
      header={
        <Header
          title={t.marketingTemplates}
          backTo={MARKETING_ROUTES.HUB}
          actions={
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(MARKETING_ROUTES.TEMPLATE_NEW)}
              className="gap-1.5"
            >
              <Plus size={16} aria-hidden="true" />
              <span>{t.marketingNewTemplate}</span>
            </Button>
          }
        />
      }
    >
      <PageContainer className="py-4 pb-24 max-w-2xl mx-auto space-y-4">
        {/* Channel filter */}
        <div className="flex gap-2">
          {CHANNEL_FILTERS.map((f) => (
            <Button
              key={String(f.value)}
              variant={channel === f.value ? 'primary' : 'outline'}
              size="sm"
              className="rounded-full text-xs font-medium"
              onClick={() => setChannel(f.value)}
              aria-pressed={channel === f.value}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {status === 'loading' && (
          <div aria-busy="true" aria-label={t.marketingTemplates} className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        )}

        {status === 'error' && (
          <ErrorState
            title={t.marketingLoadFailed}
            onRetry={refresh}
            retryLabel={t.marketingRetry}
          />
        )}

        {status === 'success' && templates.length === 0 && (
          <EmptyState
            icon={<FileText size={22} aria-hidden="true" />}
            title={t.marketingNoTemplatesYet}
            action={
              <Button
                variant="primary"
                onClick={() => navigate(MARKETING_ROUTES.TEMPLATE_NEW)}
              >
                {t.marketingNewTemplate}
              </Button>
            }
          />
        )}

        {status === 'success' && templates.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {templates.map((tpl) => (
              <Card
                key={tpl.id}
                className="p-3.5 rounded-xl border border-border bg-card shadow-2xs"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[var(--text-primary)]">{tpl.name}</span>
                      <ChannelBadge channel={tpl.channel} />
                      {!tpl.isActive && <span className="badge badge--neutral">{t.marketingInactiveLabel}</span>}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                      {tpl.bodyEn}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-1">{formatDate(tpl.createdAt)}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigate(MARKETING_ROUTES.TEMPLATE_EDIT.replace(':id', tpl.id))}
                      aria-label={`${t.marketingEditAria} ${tpl.name}`}
                    >
                      <Pencil size={15} className="text-[var(--text-muted)]" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmDelete(tpl)}
                      aria-label={`${t.marketingDeleteAria} ${tpl.name}`}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Confirm delete */}
        <ConfirmDialog
          open={Boolean(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => {
            if (confirmDelete) {
              deleteMutation.mutate({ id: confirmDelete.id, name: confirmDelete.name })
              setConfirmDelete(null)
            }
          }}
          title={t.marketingDeleteTemplateTitle}
          description={t.marketingDeleteTemplateDesc}
          confirmLabel={t.marketingDelete}
          cancelLabel={t.marketingCancel}
          isDanger={true}
          isLoading={deleteMutation.isPending}
        />
      </PageContainer>
    </AppShell>
  )
}
