import { MessageCircle, CheckCircle } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

/** WhatsApp brand green — uses CSS variable --color-whatsapp from globals.css */
const WHATSAPP_GREEN = 'var(--color-whatsapp)'

interface InviteSuccessCardProps {
  code: string
  staffName: string
  onShareWhatsApp: () => void
  onBackToStaff: () => void
}

export function InviteSuccessCard({ code, staffName, onShareWhatsApp, onBackToStaff }: InviteSuccessCardProps) {
  const { t } = useLanguage()
  return (
    <div style={{ textAlign: 'center', padding: 'var(--space-12) var(--space-4)' }}>
      <CheckCircle
        size={56}
        aria-hidden="true"
        style={{ color: 'var(--color-success-600)', marginBottom: 'var(--space-4)' }}
      />
      <p style={{ fontWeight: 700, fontSize: 'var(--fs-base)', color: 'var(--color-gray-900)', marginBottom: 'var(--space-2)' }}>
        {t.inviteSent}
      </p>
      <p style={{ color: 'var(--color-gray-500)', marginBottom: 'var(--space-6)', lineHeight: 1.5 }}>
        {t.shareCodeWith} {staffName}
      </p>
      <div
        style={{
          display: 'inline-block',
          padding: 'var(--space-3) var(--space-6)',
          background: 'var(--color-primary-50)',
          borderRadius: 'var(--radius-lg)',
          border: '1.5px dashed var(--color-primary-300)',
          fontSize: 'var(--fs-lg)',
          fontWeight: 700,
          letterSpacing: '0.15em',
          color: 'var(--color-primary-700)',
          marginBottom: 'var(--space-8)',
        }}
        aria-label={`${t.inviteCodeLabel}: ${code}`}
      >
        {code}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <button
          type="button"
          className="role-save-button"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', background: WHATSAPP_GREEN, borderColor: WHATSAPP_GREEN }}
          onClick={onShareWhatsApp}
        >
          <MessageCircle size={18} aria-hidden="true" />
          {t.shareWhatsApp}
        </button>
        <button
          type="button"
          className="role-save-button"
          style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-700)' }}
          onClick={onBackToStaff}
        >
          {t.backToStaff}
        </button>
      </div>
    </div>
  )
}
