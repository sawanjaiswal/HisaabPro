import { useLanguage } from '@/hooks/useLanguage'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { substituteVars } from '../marketing.utils'
import type { MarketingTemplate } from '../marketing.types'

interface Props {
  template: MarketingTemplate
  vars?: Record<string, string>
}

const SAMPLE_VARS: Record<string, string> = {
  customerName: 'Raju Sharma',
  amount:       'Rs 5,000',
  dueDate:      '20 May 2026',
  businessName: 'Priya Traders',
  shopName:     'Priya Traders',
}

export function TemplatePreview({ template, vars }: Props) {
  const { t } = useLanguage()
  const substituted = substituteVars(template.bodyEn, { ...SAMPLE_VARS, ...vars })

  return (
    <Card className="p-4 bg-muted/20 border-border">
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {t.marketingMessagePreview}
      </div>
      <div
        className={cn(
          'p-3.5 rounded-lg border text-sm leading-relaxed whitespace-pre-wrap break-words',
          template.channel === 'WHATSAPP'
            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
            : 'bg-card border-border text-foreground'
        )}
      >
        {substituted}
      </div>
      {template.variables.length > 0 && (
        <div className="mt-2.5 text-xs text-muted-foreground">
          {t.marketingVariablesLabel}: {template.variables.map((v) => `{{${v}}}`).join(', ')}
        </div>
      )}
    </Card>
  )
}
