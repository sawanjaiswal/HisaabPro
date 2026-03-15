import { Helmet } from 'react-helmet-async'
import { APP_NAME, APP_TAGLINE } from '@/config/app.config'

interface SEOProps {
  title?: string
  description?: string
}

export function SEO({ title, description = APP_TAGLINE }: SEOProps) {
  const pageTitle = title ? `${title} | ${APP_NAME}` : APP_NAME

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
    </Helmet>
  )
}
