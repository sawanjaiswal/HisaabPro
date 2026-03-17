import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { ErrorState } from './ErrorState'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Monitoring integration (Sentry/LogRocket) will be added when credentials are configured.
    // Errors are already visible in the UI via the fallback ErrorState.
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <ErrorState
          title="Something went wrong"
          message={this.state.error?.message}
          onRetry={this.handleRetry}
        />
      )
    }

    return this.props.children
  }
}
