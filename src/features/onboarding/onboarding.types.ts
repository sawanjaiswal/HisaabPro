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
