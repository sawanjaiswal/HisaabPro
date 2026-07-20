/** Party Detail — primary action row: Receive Payment + WhatsApp Statement */

import { MessageCircle, PlusCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'

interface PartyDetailActionBarProps {
  partyId: string
  onStatement: () => void
}

export function PartyDetailActionBar({ partyId, onStatement }: PartyDetailActionBarProps) {
  const navigate = useNavigate()
  const { t } = useLanguage()

  return (
    <div className="flex items-center gap-3" role="group" aria-label={t.quickActions}>
      <Button
        variant="primary"
        size="md"
        className="flex-1"
        onClick={() => navigate(`/payments/new?partyId=${partyId}`)}
        aria-label={t.receivePayment}
      >
        <PlusCircle size={18} aria-hidden="true" />
        <span>{t.receivePayment}</span>
      </Button>
      <Button
        variant="outline"
        size="md"
        className="flex-1"
        onClick={onStatement}
        aria-label={t.whatsappStatement}
      >
        <MessageCircle size={18} aria-hidden="true" />
        <span>{t.whatsappStatement}</span>
      </Button>
    </div>
  )
}
