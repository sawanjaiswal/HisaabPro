/** 404 NotFound — Full-page error using FeedbackState
 *
 * Uses FeedbackState with size="lg" for full-page layout.
 * Teal gradient illustration + warm cream background + CTA to go home.
 */

import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { FeedbackState } from './FeedbackState'
import './feedback-state.css'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <FeedbackState
      icon={<MapPin size={28} aria-hidden="true" />}
      variant="teal"
      size="lg"
      subtitle={<span className="feedback-404-code" aria-hidden="true">404</span>}
      title="Page not found"
      description="The page you're looking for doesn't exist or has been moved."
      action={
        <>
          <button
            className="feedback-btn feedback-btn--primary"
            onClick={() => navigate(ROUTES.DASHBOARD)}
            aria-label="Go to dashboard"
          >
            Go to Dashboard
          </button>
          <button
            className="feedback-btn feedback-btn--ghost"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            Go Back
          </button>
        </>
      }
      role="alert"
    />
  )
}
