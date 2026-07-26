import type { TranslationKey } from '@/lib/translations'
import type { DataSource, StartPath, OnboardingStep } from './onboarding.types'

export const BUSINESS_TYPES: readonly { value: string; labelKey: TranslationKey }[] = [
  { value: 'general',       labelKey: 'bizGeneral'       },
  { value: 'retail',        labelKey: 'bizRetail'        },
  { value: 'wholesale',     labelKey: 'bizWholesale'     },
  { value: 'manufacturing', labelKey: 'bizManufacturing' },
  { value: 'services',      labelKey: 'bizServices'      },
  { value: 'restaurant',    labelKey: 'bizRestaurant'    },
  { value: 'pharmacy',      labelKey: 'bizPharmacy'      },
  { value: 'other',         labelKey: 'bizOther'         },
] as const

export const ONBOARDING_STEPS: readonly { step: OnboardingStep; labelKey: TranslationKey }[] = [
  { step: 'welcome',          labelKey: 'onboardingStepWelcome'         },
  { step: 'businessDetails',  labelKey: 'onboardingStepBusinessDetails' },
  { step: 'businessType',     labelKey: 'onboardingStepBusinessType'    },
  { step: 'dataSource',       labelKey: 'onboardingStepDataSource'      },
  { step: 'startPath',        labelKey: 'onboardingStepStartPath'       },
  { step: 'ready',            labelKey: 'onboardingStepReady'           },
] as const

/** Step sequence — derived from ONBOARDING_STEPS so the stepper UI and the
 *  back/next arithmetic can never disagree about the order. */
export const ONBOARDING_STEP_ORDER: readonly OnboardingStep[] = ONBOARDING_STEPS.map((s) => s.step)

export const DATA_SOURCE_OPTIONS: readonly { value: DataSource; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { value: 'notebook', titleKey: 'onboardingSourceNotebook', descKey: 'onboardingSourceNotebookDesc' },
  { value: 'excel',    titleKey: 'onboardingSourceExcel',    descKey: 'onboardingSourceExcelDesc'    },
  { value: 'tally',    titleKey: 'onboardingSourceTally',    descKey: 'onboardingSourceTallyDesc'    },
  { value: 'otherApp', titleKey: 'onboardingSourceOtherApp', descKey: 'onboardingSourceOtherAppDesc' },
  { value: 'other',    titleKey: 'onboardingSourceOther',    descKey: 'onboardingSourceOtherDesc'    },
] as const

export const START_PATH_OPTIONS: readonly {
  value: StartPath; titleKey: TranslationKey; descKey: TranslationKey; recommended?: boolean
}[] = [
  { value: 'import', titleKey: 'onboardingPathImport', descKey: 'onboardingPathImportDesc', recommended: true },
  { value: 'fresh',  titleKey: 'onboardingPathFresh',  descKey: 'onboardingPathFreshDesc' },
] as const
