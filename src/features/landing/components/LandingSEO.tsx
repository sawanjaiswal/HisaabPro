/** Landing page SEO — structured data + meta tags */

import { SEO } from '@/components/layout/SEO'

const LANDING_DESCRIPTION =
  'Smart billing software for Indian businesses. Create GST invoices, manage inventory, track payments — all from your phone. Better than Vyapar & MyBillBook.'

const LANDING_KEYWORDS =
  'billing software india, GST invoice app, billing app, smart billing software, vyapar alternative, mybillbook alternative, billing app for small business, invoice maker india, inventory management app, payment tracking app'

export function LandingSEO() {
  return (
    <SEO
      title="Smart Billing Software for Indian Businesses"
      description={LANDING_DESCRIPTION}
      landing
      path="/"
      keywords={LANDING_KEYWORDS}
    />
  )
}
