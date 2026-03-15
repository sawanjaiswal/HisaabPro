import { AlertTriangle } from 'lucide-react'

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'Please try again. If the problem persists, contact support.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="error-state" role="alert">
      <AlertTriangle size={40} className="error-state-icon" aria-hidden="true" />
      <h3 className="error-state-title">{title}</h3>
      <p className="error-state-message">{message}</p>
      {onRetry && (
        <button className="btn btn-primary btn-md" onClick={onRetry} aria-label="Retry">
          Try Again
        </button>
      )}
    </div>
  )
}
