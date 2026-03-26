/** Tax — GST Quick Links (sub-component)
 *
 * Navigation cards linking to Tax Rates, Returns, Summary.
 * Each link is a tappable card with icon + label + description.
 */

import { ChevronRight } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { LucideIcon } from 'lucide-react'

interface QuickLink {
  icon: LucideIcon
  label: string
  description: string
  route: string
}

interface GstQuickLinksProps {
  links: QuickLink[]
  onNavigate: (route: string) => void
}

export function GstQuickLinks({ links, onNavigate }: GstQuickLinksProps) {
  const { t } = useLanguage()
  return (
    <div className="gst-quick-links" role="list" aria-label={t.gstQuickLinks}>
      {links.map((link) => (
        <button
          key={link.route}
          className="gst-quick-link"
          onClick={() => onNavigate(link.route)}
          role="listitem"
          aria-label={link.label}
        >
          <span className="gst-quick-link-icon" aria-hidden="true">
            <link.icon size={20} />
          </span>
          <span className="gst-quick-link-body">
            <span className="gst-quick-link-label">{link.label}</span>
            <span className="gst-quick-link-desc">{link.description}</span>
          </span>
          <ChevronRight size={16} className="gst-quick-link-chevron" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
