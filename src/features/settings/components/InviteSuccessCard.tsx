import { Text } from '@/components/ui/Text'
import { MessageCircle, CheckCircle } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'

interface InviteSuccessCardProps {
  code: string
  staffName: string
  onShareWhatsApp: () => void
  onBackToStaff: () => void
}

export function InviteSuccessCard({ code, staffName, onShareWhatsApp, onBackToStaff }: InviteSuccessCardProps) {
  const { t } = useLanguage()
  return (
    <div className="text-center py-12 px-4 flex flex-col items-center">
      <CheckCircle
        size={56}
        aria-hidden="true"
        className="text-[var(--color-success-600)] mb-4"
      />
      <Text className="font-bold text-base text-[var(--color-gray-900)] mb-2">
        {t.inviteSent}
      </Text>
      <Text className="text-[var(--color-gray-500)] mb-6 leading-relaxed">
        {t.shareCodeWith} {staffName}
      </Text>
      <div
        className="inline-block py-3 px-6 bg-[var(--color-primary-50)] rounded-xl border-2 border-dashed border-[var(--color-primary-300)] text-lg font-bold tracking-widest text-[var(--color-primary-700)] mb-8"
        aria-label={`${t.inviteCodeLabel}: ${code}`}
      >
        {code}
      </div>
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="flex items-center justify-center gap-2"
          onClick={onShareWhatsApp}
        >
          <MessageCircle size={18} aria-hidden="true" />
          {t.shareWhatsApp}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onBackToStaff}
        >
          {t.backToStaff}
        </Button>
      </div>
    </div>
  )
}
