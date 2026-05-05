/**
 * BackfillWizard — useReducer state machine
 *
 * State transitions:
 *   preview → options → confirmation → processing → complete
 *   (back allowed from options and confirmation)
 */

import type { WizardState, WizardAction, WizardOptions, BackfillPreviewRes } from './gst-returns.types'

function getFiscalYearRange(): [Date, Date] {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const start = new Date(year, 3, 1)   // April 1
  const end   = new Date(year + 1, 2, 31) // March 31
  return [start, end]
}

const defaultOptions = (): WizardOptions => ({
  defaultTaxCategoryId: '',
  setPositionFromParty: true,
  dateRange: getFiscalYearRange(),
})

export const initialWizardState: WizardState = {
  step: 'preview',
  preview: null,
  loading: true,
  error: null,
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'PREVIEW_START':
      return { step: 'preview', preview: null, loading: true, error: null }

    case 'PREVIEW_SUCCESS':
      return { step: 'preview', preview: action.preview, loading: false, error: null }

    case 'PREVIEW_ERROR':
      return { step: 'preview', preview: null, loading: false, error: action.error }

    case 'GO_OPTIONS': {
      // From preview → set initial options and enter options step
      if (state.step === 'preview' && state.preview) {
        return { step: 'options', options: action.options, preview: state.preview }
      }
      // From options → update options in place (user edited then clicked Next)
      if (state.step === 'options') {
        return { step: 'options', options: action.options, preview: state.preview }
      }
      return state
    }

    case 'GO_CONFIRMATION': {
      if (state.step !== 'options') return state
      return { step: 'confirmation', options: state.options, preview: state.preview }
    }

    case 'BACK': {
      if (state.step === 'options') {
        return { step: 'preview', preview: state.preview, loading: false, error: null }
      }
      if (state.step === 'confirmation') {
        return { step: 'options', options: state.options, preview: state.preview }
      }
      return state
    }

    case 'START_PROCESSING': {
      if (state.step !== 'confirmation') return state
      return {
        step: 'processing',
        jobId: action.jobId,
        options: state.options,
        preview: state.preview,
      }
    }

    case 'COMPLETE': {
      if (state.step !== 'processing') return state
      return { step: 'complete', jobId: state.jobId, status: action.status }
    }

    default:
      return state
  }
}

export type { WizardState, WizardAction, WizardOptions, BackfillPreviewRes }
export { defaultOptions }
