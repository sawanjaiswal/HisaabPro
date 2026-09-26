import { useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, Copy, Check, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { FeedbackState } from './FeedbackState'

interface ErrorStateProps {
  /** Custom icon — defaults to AlertTriangle */
  icon?: ReactNode
  title?: string
  message?: string
  error?: Error | null
  errorInfo?: { componentStack?: string | null } | null
  details?: unknown
  /** Simple retry callback — renders a "Try Again" button */
  onRetry?: () => void
  /** Custom retry button label */
  retryLabel?: string
  /** Full custom action — overrides onRetry if both provided */
  action?: ReactNode
  /** Extra CSS class for positioning */
  className?: string
}

export function ErrorState({
  icon,
  title = 'Something went wrong',
  message = 'Please try again. If the problem persists, contact support.',
  error,
  errorInfo,
  details,
  onRetry,
  retryLabel = 'Try Again',
  action,
  className,
}: ErrorStateProps) {
  const [copied, setCopied] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const handleCopyError = async () => {
    try {
      const errorReport = {
        title,
        message,
        errorName: error?.name,
        errorMessage: error?.message,
        errorStack: error?.stack,
        componentStack: errorInfo?.componentStack,
        details,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      }
      await navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const hasDiagnostics = Boolean(error || errorInfo || details)

  const defaultAction = (
    <div className="flex flex-col items-center gap-3 w-full max-w-md">
      <div className="flex items-center gap-2">
        {onRetry && (
          <button
            type="button"
            className="feedback-btn feedback-btn--primary flex items-center gap-1.5"
            onClick={onRetry}
            aria-label={retryLabel}
          >
            <RefreshCw size={15} />
            <span>{retryLabel}</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleCopyError}
          className={`feedback-btn flex items-center gap-1.5 transition-colors ${
            copied
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50'
          }`}
          aria-label="Copy error details to clipboard"
        >
          {copied ? <Check size={15} className="text-white" /> : <Copy size={15} />}
          <span>{copied ? 'Copied Error!' : 'Copy Error'}</span>
        </button>
      </div>

      {hasDiagnostics && (
        <div className="w-full mt-2 text-left">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-1 mx-auto"
          >
            <span>{showDetails ? 'Hide technical details' : 'Show technical details'}</span>
            {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showDetails && (
            <div className="mt-2 p-3 bg-zinc-900 text-zinc-200 text-xs font-mono rounded-lg overflow-x-auto max-h-48 border border-zinc-800 shadow-inner">
              {error?.message && <div className="font-semibold text-red-400 mb-1">{error.message}</div>}
              {error?.stack && <pre className="whitespace-pre-wrap text-[11px] opacity-80">{error.stack}</pre>}
              {errorInfo?.componentStack && (
                <pre className="whitespace-pre-wrap text-[11px] opacity-70 mt-2 text-zinc-400">{errorInfo.componentStack}</pre>
              )}
              {Boolean(details) && (
                <pre className="whitespace-pre-wrap text-[11px] opacity-80 mt-2">
                  {JSON.stringify(details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )

  const resolvedAction = action ?? defaultAction

  return (
    <FeedbackState
      icon={icon ?? <AlertTriangle size={22} aria-hidden="true" />}
      variant="error"
      title={title}
      description={message}
      action={resolvedAction}
      className={className}
      role="alert"
    />
  )
}
