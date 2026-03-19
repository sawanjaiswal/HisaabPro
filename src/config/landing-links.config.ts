/** Landing page links — Single Source of Truth
 *  Every link on the landing page imports from here.
 *  No hardcoded hrefs in components. */

/** Anchor section IDs (used as #hash targets) */
export const LP_SECTIONS = {
  FEATURES: 'features',
  PRICING: 'pricing',
  TESTIMONIALS: 'testimonials',
  FAQ: 'faq',
  DOWNLOAD: 'download',
  HERO_CTA: 'hero-cta',
  FINAL_CTA: 'final-cta',
} as const

/** Internal app routes (pages that exist in the SPA) */
export const LP_APP = {
  LOGIN: '/login',
  REGISTER: '/login', // TODO: change to /register when built
} as const

/** External links */
export const LP_EXTERNAL = {
  PLAY_STORE: 'https://play.google.com/store/apps/details?id=com.hisaabpro.app',
  APP_STORE: '#', // TODO: add when available
  WHATSAPP_SUPPORT: 'https://wa.me/917000462319',
} as const

/** Social media */
export const LP_SOCIAL = {
  INSTAGRAM: 'https://instagram.com/hisaabpro',
  YOUTUBE: 'https://youtube.com/@hisaabpro',
  TWITTER: 'https://x.com/hisaabpro',
  LINKEDIN: 'https://linkedin.com/company/hisaabpro',
} as const

/** Legal / info pages */
export const LP_LEGAL = {
  ABOUT: '/about',
  PRIVACY: '/privacy',
  TERMS: '/terms',
  HELP: '/help',
  REFUND: '/refund',
} as const

/** Helper: turn section ID into hash link */
export const hash = (id: string) => `#${id}`
