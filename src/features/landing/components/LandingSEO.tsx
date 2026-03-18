/** Landing page SEO — structured data + meta tags */

import { SEO } from '@/components/layout/SEO'

const LANDING_DESCRIPTION =
  'Free billing software for Indian businesses. Create GST invoices, manage inventory, track payments — 100% offline. Works on any phone. Better than Vyapar & MyBillBook.'

const LANDING_KEYWORDS =
  'billing software india, GST invoice app, offline billing app, free billing software, vyapar alternative, mybillbook alternative, billing app for small business, invoice maker india, inventory management app, payment tracking app'

export function LandingSEO() {
  return (
    <SEO
      title="Free Billing Software for Indian Businesses"
      description={LANDING_DESCRIPTION}
      landing
      path="/"
      keywords={LANDING_KEYWORDS}
    />
  )
}
