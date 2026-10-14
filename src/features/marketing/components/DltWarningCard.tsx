import { AlertTriangle } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

interface Props {
  hasDltId: boolean
  isRegistered: boolean
}

export function DltWarningCard({ hasDltId, isRegistered }: Props) {
  const { t } = useLanguage()
  if (hasDltId && isRegistered) return null

  const message = !hasDltId ? t.marketingDltMissingMsg : t.marketingDltUnregisteredMsg

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs leading-relaxed mb-4"
    >
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}
