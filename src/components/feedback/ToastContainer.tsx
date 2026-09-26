import { useState } from 'react'
import { Text } from '@/components/ui/Text'
import { CheckCircle, XCircle, Info, AlertTriangle, X, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useToastStore, TOAST_DURATION, TOAST_ERROR_DURATION, type Toast } from '../../hooks/useToast'
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
  const [copied, setCopied] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const handleUndo = async () => {
    if (toast.onUndo) {
      onClose()
      await toast.onUndo()
    }
  }

  const handleCopyError = async () => {
    try {
      const errorReport = {
        type: toast.type,
        message: typeof toast.message === 'string' ? toast.message : 'React Node Message',
        code: toast.code ?? 'UNKNOWN',
        status: toast.status,
        detail: toast.detail,
        path: window.location.pathname,
        url: window.location.href,
        timestamp: new Date(toast.createdAt).toISOString(),
      }
      await navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      setCopied(false)
    }
  }

  const duration = toast.duration ?? (toast.type === 'error' ? TOAST_ERROR_DURATION : TOAST_DURATION)
  const hasDetails = Boolean(toast.detail || toast.code || toast.status)

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
          <div className="toast-content">
            <Text className="toast-message">{toast.message}</Text>
            {(toast.code || toast.status) && (
              <div className="toast-badges">
                {toast.status && <span className="toast-badge toast-badge--status">{toast.status}</span>}
                {toast.code && <span className="toast-badge toast-badge--code">{toast.code}</span>}
              </div>
            )}
          </div>
          <div className="toast-actions">
            {toast.type === 'error' && (
              <button
                type="button"
                onClick={handleCopyError}
                className={`toast-copy-btn ${copied ? 'toast-copy-btn--copied' : ''}`}
                title="Copy error details to clipboard"
                aria-label="Copy error details"
              >
                {copied ? <Check size={14} className="toast-btn-icon" /> : <Copy size={14} className="toast-btn-icon" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}
            {hasDetails && (
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="toast-details-toggle"
                title={showDetails ? 'Hide details' : 'Show details'}
                aria-label={showDetails ? 'Hide details' : 'Show details'}
              >
                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
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

        {showDetails && hasDetails && (
          <div className="toast-details-panel">
            <pre className="toast-details-pre">
              {JSON.stringify({ code: toast.code, status: toast.status, detail: toast.detail }, null, 2)}
            </pre>
          </div>
        )}

        <div className="toast-progress">
          <div
            className="toast-progress-bar"
            style={{
              ['--toast-progress-fill' as string]: PROGRESS_FILL[toast.type],
              ['--toast-duration' as string]: `${duration}ms`,
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
