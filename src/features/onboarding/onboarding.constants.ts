import type { TranslationKey } from '@/lib/translations'

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
