/** PipelineTimeline — horizontal step strip showing document conversion chain.
 *
 * 4 states: loading (shimmer), hidden (no chain), error (hidden), success (strip).
 * Tapping a non-current step navigates to that document's detail page.
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import { DOCUMENT_TYPE_CODES } from '../../invoices/invoice.constants'
import { getNodeRoute } from '../sales.utils'
import type { PipelineStep } from '../sales.types'
import './PipelineTimeline.css'

// ─── Skeleton (loading) ───────────────────────────────────────────────────────

const PipelineTimelineSkeleton: React.FC = () => (
  <div className="pipeline-card" aria-hidden="true">
    <div className="pipeline__skeleton">
      {[0, 1, 2].map((i) => (
        <React.Fragment key={i}>
          <div className="pipeline__skeleton-node" />
          {i < 2 && <div className="pipeline__skeleton-arrow" />}
        </React.Fragment>
      ))}
    </div>
  </div>
)

// ─── Main component ───────────────────────────────────────────────────────────

interface PipelineTimelineProps {
  /** Ordered steps root→leaf from useDocumentLineage. */
  steps: PipelineStep[]
  isLoading: boolean
  isError: boolean
}

export const PipelineTimeline: React.FC<PipelineTimelineProps> = ({
  steps,
  isLoading,
  isError,
}) => {
  const navigate = useNavigate()
  const { t } = useLanguage()

  // Loading: shimmer strip
  if (isLoading) return <PipelineTimelineSkeleton />

  // Error: silently hide (non-critical widget per spec)
  if (isError) return null

  // No lineage chain (standalone doc): hide widget
  if (steps.length < 2) return null

  return (
    <div className="pipeline-card" role="region" aria-label={t.pipelineTimeline ?? 'Document pipeline'}>
      <p className="pipeline-card__title">{t.pipelineTimeline ?? 'Pipeline'}</p>

      <div className="pipeline" role="list">
        {steps.map((step, idx) => {
          const code = DOCUMENT_TYPE_CODES[step.node.type] ?? step.node.type
          const isLast = idx === steps.length - 1

          return (
            <React.Fragment key={step.node.id}>
              <div className="pipeline__step" role="listitem">
                {step.isCurrent ? (
                  <div
                    className="pipeline__node pipeline__node--static"
                    aria-current="step"
                    title={`${step.node.number} (current)`}
                  >
                    <div className="pipeline__badge pipeline__badge--current">
                      {code}
                    </div>
                    <span className="pipeline__label pipeline__label--current">
                      {step.node.number}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="pipeline__node"
                    onClick={() => navigate(getNodeRoute(step.node))}
                    title={`Go to ${step.node.number}`}
                    aria-label={`${t.goTo ?? 'Go to'} ${step.node.number}`}
                  >
                    <div className="pipeline__badge">
                      {code}
                    </div>
                    <span className="pipeline__label">
                      {step.node.number}
                    </span>
                  </button>
                )}
              </div>

              {!isLast && (
                <div className="pipeline__arrow" aria-hidden="true" />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
