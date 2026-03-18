/** Landing page type definitions */

export interface LandingFeature {
  id: string
  title: string
  description: string
  icon: string
  size: 'large' | 'medium' | 'small'
}

export interface FeatureDeepDive {
  id: string
  title: string
  subtitle: string
  icon: string
  details: string[]
}

export interface AccordionFeature {
  id: string
  title: string
  description: string
  icon: string
}

export interface CompetitorRow {
  feature: string
  us: boolean | string
  vyapar: boolean | string
  billbook: boolean | string
}

export interface SectionHeader {
  label: string
  headline: string
  subtext?: string
}
