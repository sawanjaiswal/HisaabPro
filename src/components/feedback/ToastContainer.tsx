/** Toast Container — stacked notifications with countdown progress bar + undo */

import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import { useToastStore, TOAST_DURATION, type Toast } from '../../hooks/useToast'
import './toast.css'

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

const PROGRESS_FILL = {
  success: 'linear-gradient(to right, var(--color-success-500), var(--color-success-600))',
  error: 'linear-gradient(to right, var(--color-error-500), var(--color-error-600))',
  info: 'linear-gradient(to right, var(--color-info-500), var(--color-info-600))',
  warning: 'linear-gradient(to right, var(--color-warning-500), var(--color-warning-600))',
}

const ACCENT_FILL = {
  success: 'linear-gradient(to right, var(--color-success-500), var(--color-success-600), var(--color-success-700))',
  error: 'linear-gradient(to right, var(--color-error-500), var(--color-error-600), var(--color-error-700))',
  info: 'linear-gradient(to right, var(--color-info-500), var(--color-info-600), var(--color-info-700))',
  warning: 'linear-gradient(to right, var(--color-warning-500), var(--color-warning-600), var(--color-warning-700))',
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const IconComponent = ICON_MAP[toast.type]
  const iconColor = ICON_COLORS[toast.type]

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
      className="toast"
    >
      <div className="toast-accent" style={{ ['--toast-accent' as string]: ACCENT_FILL[toast.type] }} />
      <div className="toast-body">
        <div className="toast-row">
          <IconComponent
            size={20}
            className="toast-icon"
            style={{ color: iconColor }}
            aria-hidden="true"
          />
          <p className="toast-message">{toast.message}</p>
          <div className="toast-actions">
            {toast.onUndo && (
              <button onClick={handleUndo} className="toast-undo" aria-label="Undo action">
                {toast.undoLabel || 'UNDO'}
              </button>
            )}
            <button onClick={onClose} className="toast-close" aria-label="Close notification">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="toast-progress">
          <div
            className="toast-progress-bar"
            style={{
              ['--toast-progress-fill' as string]: PROGRESS_FILL[toast.type],
              ['--toast-duration' as string]: `${TOAST_DURATION}ms`,
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
    <div data-toast-container className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast-slot">
          <ToastItem toast={toast} onClose={() => removeToast(toast.id)} />
        </div>
      ))}
    </div>
  )
}

export default ToastContainer
