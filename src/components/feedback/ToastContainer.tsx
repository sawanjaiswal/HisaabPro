/**
 * Toast Container — stacked notifications with countdown progress bar + undo
 * Uses CSS variables from globals.css (SSOT) + inline styles (no Tailwind dependency)
 */

import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import { useToastStore, TOAST_DURATION, type Toast } from '../../hooks/useToast'

const ICON_MAP = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
}

const ICON_COLORS = {
  success: 'var(--color-success-500)',
  error: 'var(--color-error-500)',
  info: 'var(--color-info-500)',
  warning: 'var(--color-warning-500)',
}

const BAR_COLORS = {
  success: ['var(--color-success-500)', 'var(--color-success-600)'],
  error: ['var(--color-error-500)', 'var(--color-error-600)'],
  info: ['var(--color-info-500)', 'var(--color-info-600)'],
  warning: ['var(--color-warning-500)', 'var(--color-warning-600)'],
}

const ACCENT_COLORS = {
  success: ['var(--color-success-500)', 'var(--color-success-600)', 'var(--color-success-700)'],
  error: ['var(--color-error-500)', 'var(--color-error-600)', 'var(--color-error-700)'],
  info: ['var(--color-info-500)', 'var(--color-info-600)', 'var(--color-info-700)'],
  warning: ['var(--color-warning-500)', 'var(--color-warning-600)', 'var(--color-warning-700)'],
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const IconComponent = ICON_MAP[toast.type]
  const iconColor = ICON_COLORS[toast.type]
  const accent = ACCENT_COLORS[toast.type]
  const bar = BAR_COLORS[toast.type]

  const handleUndo = async () => {
    if (toast.onUndo) {
      onClose()
      await toast.onUndo()
    }
  }

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-md)',
        animation: 'toast-enter var(--duration-slow) var(--ease-default)',
      }}
    >
      {/* Gradient border accent */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'var(--radius-md)',
          background: `linear-gradient(to right, ${accent[0]}, ${accent[1]}, ${accent[2]})`,
          opacity: 0.75,
        }}
      />

      {/* Content */}
      <div style={{
        position: 'relative',
        backgroundColor: 'var(--toast-bg)',
        margin: 2,
        borderRadius: 'calc(var(--radius-md) - 2px)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <IconComponent
              size={20}
              style={{ color: iconColor, flexShrink: 0 }}
              aria-hidden="true"
            />
            <p style={{
              fontSize: 'var(--fs-sm)',
              fontWeight: 500,
              color: 'var(--toast-text)',
              flex: 1,
              margin: 0,
              fontFamily: 'var(--font-primary)',
            }}>
              {toast.message}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {toast.onUndo && (
                <button
                  onClick={handleUndo}
                  style={{
                    padding: 'var(--space-1) var(--space-3)',
                    backgroundColor: 'var(--toast-text)',
                    color: 'var(--toast-bg)',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    fontSize: 'var(--fs-xs)',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-primary)',
                  }}
                  aria-label="Undo action"
                >
                  {toast.undoLabel || 'UNDO'}
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: -8,
                  color: 'var(--color-gray-400)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  WebkitTapHighlightColor: 'transparent',
                }}
                aria-label="Close notification"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
        {/* Countdown progress bar */}
        <div style={{ height: 3, backgroundColor: 'var(--toast-progress-bg)' }}>
          <div
            style={{
              height: '100%',
              background: `linear-gradient(to right, ${bar[0]}, ${bar[1]})`,
              transformOrigin: 'left',
              animation: `toast-countdown ${TOAST_DURATION}ms linear forwards`,
            }}
          />
        </div>
      </div>
    </div>
  )
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes toast-countdown {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
        @keyframes toast-enter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        data-toast-container
        style={{
          position: 'fixed',
          bottom: 'calc(var(--bottom-nav-height) + var(--space-4))',
          left: 'var(--space-4)',
          right: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          pointerEvents: 'none',
          zIndex: 'var(--z-toast)',
        }}
      >
        {toasts.map((toast) => (
          <div key={toast.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={toast} onClose={() => removeToast(toast.id)} />
          </div>
        ))}
      </div>
    </>
  )
}

export default ToastContainer
