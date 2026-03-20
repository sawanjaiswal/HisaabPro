import { Helmet } from 'react-helmet-async'
import { APP_NAME, APP_TAGLINE, APP_DOMAIN, THEME_COLOR } from '@/config/app.config'

interface SEOProps {
  title?: string
  description?: string
  /** Override for landing/marketing pages with richer meta */
  landing?: boolean
  /** Canonical URL path (e.g. "/" or "/pricing") */
  path?: string
  /** OG image URL */
  image?: string
  /** Additional keywords for Bing/Yandex */
  keywords?: string
  /** noindex for internal pages */
  noindex?: boolean
}

const BASE_URL = `https://${APP_DOMAIN}`

const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: APP_NAME,
  url: BASE_URL,
  logo: `${BASE_URL}/icon-512.svg`,
  description: APP_TAGLINE,
  foundingDate: '2026',
  sameAs: [],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    availableLanguage: ['English', 'Hindi'],
  },
}

const SOFTWARE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: APP_NAME,
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Billing & Invoicing',
  operatingSystem: 'Android, iOS, Web',
  offers: [
    {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
      description: 'Trial plan — basic billing features',
    },
    {
      '@type': 'Offer',
      price: '299',
      priceCurrency: 'INR',
      priceValidUntil: '2027-12-31',
      description: 'Monthly plan — billing, inventory & payments',
    },
    {
      '@type': 'Offer',
      price: '2999',
      priceCurrency: 'INR',
      priceValidUntil: '2027-12-31',
      description: 'Annual plan — all features, save 2 months',
    },
  ],
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '1200',
    bestRating: '5',
    worstRating: '1',
  },
  description: APP_TAGLINE,
  url: BASE_URL,
  image: `${BASE_URL}/og-image.png`,
  screenshot: `${BASE_URL}/og-image.png`,
  featureList:
    'GST Invoicing, Inventory Management, Payment Tracking, WhatsApp Sharing, UPI Payments, Thermal Printing, Multi-language Support, Business Reports',
  inLanguage: ['en', 'hi'],
}

export function SEO({
  title,
  description = APP_TAGLINE,
  landing = false,
  path = '/',
  image,
  keywords,
  noindex = false,
}: SEOProps) {
  const pageTitle = title
    ? `${title} | ${APP_NAME}`
    : `${APP_NAME} — ${APP_TAGLINE}`
  const url = `${BASE_URL}${path}`
  const ogImage = image || `${BASE_URL}/og-image.png`

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* Indexing control */}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {!noindex && (
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />
      )}

      {/* Keywords (Bing/Yandex still use these) */}
      {keywords && <meta name="keywords" content={keywords} />}

      {/* Hreflang for bilingual support */}
      <link rel="alternate" hrefLang="en-IN" href={url} />
      <link rel="alternate" hrefLang="hi-IN" href={url} />
      <link rel="alternate" hrefLang="x-default" href={url} />

      {/* Open Graph */}
      <meta property="og:type" content={landing ? 'website' : 'article'} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${APP_NAME} — ${APP_TAGLINE}`} />
      <meta property="og:site_name" content={APP_NAME} />
      <meta property="og:locale" content="en_IN" />
      <meta property="og:locale:alternate" content="hi_IN" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={`${APP_NAME} — ${APP_TAGLINE}`} />

      {/* Mobile */}
      <meta name="theme-color" content={THEME_COLOR} />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="format-detection" content="telephone=no" />

      {/* Geo targeting for India */}
      <meta name="geo.region" content="IN" />
      <meta name="geo.placename" content="India" />

      {/* Structured data — Organization (all pages) */}
      <script type="application/ld+json">
        {JSON.stringify(ORGANIZATION_SCHEMA)}
      </script>

      {/* Structured data — SoftwareApplication (landing page) */}
      {landing && (
        <script type="application/ld+json">
          {JSON.stringify(SOFTWARE_SCHEMA)}
        </script>
      )}
    </Helmet>
  )
}
