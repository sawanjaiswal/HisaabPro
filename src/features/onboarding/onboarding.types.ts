export interface OnboardingFormData {
  businessName: string
  businessType: string
  phone: string
}

export interface CreateBusinessPayload {
  name: string
  businessType: string
  phone?: string
}

export interface CreateBusinessResponse {
  business: {
    id: string
    name: string
    businessType: string
    phone: string | null
    email: string | null
    isActive: boolean
    createdAt: string
  }
}

export type DataSource = 'notebook' | 'excel' | 'tally' | 'otherApp' | 'other'

export type StartPath = 'import' | 'fresh'

export type OnboardingStep =
  | 'welcome'
  | 'businessDetails'
  | 'businessType'
  | 'dataSource'
  | 'startPath'
  | 'ready'

/**
 * What survives an interrupted setup. Everything the wizard has asked for so
 * far plus where the shopkeeper had reached — resuming on the welcome screen
 * with the fields blank is the same as not resuming at all.
 *
 * `ready` is deliberately not resumable: it means the business already exists,
 * and that fact lives on the server, not in a draft.
 */
export interface OnboardingDraft {
  step: Exclude<OnboardingStep, 'ready'>
  businessName: string
  businessType: string
  hasPickedType: boolean
  phone: string
  businessLocation: string
  dataSource?: DataSource
  startPath?: StartPath
}
