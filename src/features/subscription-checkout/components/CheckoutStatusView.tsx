/**
 * CheckoutStatusView — renders the post-launch phases (polling / success /
 * failed / cancelled / stranded). The active-launch phases (opening,
 * authorising) are owned by the surface components; the page swaps to this
 * view once the FSM leaves them.
 */

import { Text } from '@/components/ui/Text'
import { CheckCircle2, XCircle, Clock, RotateCcw } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/feedback/Spinner'
import type { CheckoutPhase } from '../subscription-checkout.types'
import { Heading } from '@/components/ui/Heading'

interface CheckoutStatusViewProps {
  phase: CheckoutPhase
  onRetry: () => void
  onDone: () => void
}

export function CheckoutStatusView({ phase, onRetry, onDone }: CheckoutStatusViewProps) {
  const { t } = useLanguage()

  if (phase.kind === 'polling') {
    return (
      <div className="checkout-status" role="status" aria-live="polite">
        <Spinner size="lg" />
        <Heading level={2} className="checkout-status__title">{t.checkoutVerifying}</Heading>
        <Text className="checkout-status__body">{t.checkoutVerifyingHint}</Text>
      </div>
    )
  }

  if (phase.kind === 'success') {
    return (
      <div className="checkout-status checkout-status--success" role="status" aria-live="polite">
        <CheckCircle2 className="checkout-status__icon" aria-hidden="true" />
        <Heading level={2} className="checkout-status__title">{t.checkoutSuccessTitle}</Heading>
        <Text className="checkout-status__body">{t.checkoutSuccessBody}</Text>
        <Button variant="primary" onClick={onDone}>{t.checkoutGoToSubscription}</Button>
      </div>
    )
  }

  if (phase.kind === 'stranded') {
    return (
      <div className="checkout-status checkout-status--stranded" role="alert">
        <Clock className="checkout-status__icon" aria-hidden="true" />
        <Heading level={2} className="checkout-status__title">{t.checkoutStrandedTitle}</Heading>
        <Text className="checkout-status__body">{t.checkoutStrandedBody}</Text>
        <Button variant="primary" onClick={onRetry}>
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          {t.checkoutCheckAgain}
        </Button>
        <Button variant="ghost" onClick={onDone}>{t.checkoutGoToSubscription}</Button>
      </div>
    )
  }

  if (phase.kind === 'cancelled') {
    return (
      <div className="checkout-status checkout-status--cancelled" role="alert">
        <XCircle className="checkout-status__icon" aria-hidden="true" />
        <Heading level={2} className="checkout-status__title">{t.checkoutCancelledTitle}</Heading>
        <Text className="checkout-status__body">{t.checkoutCancelledBody}</Text>
        <Button variant="primary" onClick={onRetry}>{t.tryAgain}</Button>
        <Button variant="ghost" onClick={onDone}>{t.cancel}</Button>
      </div>
    )
  }

  // failed
  return (
    <div className="checkout-status checkout-status--failed" role="alert">
      <XCircle className="checkout-status__icon" aria-hidden="true" />
      <Heading level={2} className="checkout-status__title">{t.checkoutFailedTitle}</Heading>
      <Text className="checkout-status__body">{t.checkoutFailedBody}</Text>
      <Button variant="primary" onClick={onRetry}>{t.tryAgain}</Button>
      <Button variant="ghost" onClick={onDone}>{t.cancel}</Button>
    </div>
  )
}
