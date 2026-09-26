/** Multi-column footer — dark theme */

import { Text } from '@/components/ui/Text'
import { APP_NAME, APP_TAGLINE } from '@/config/app.config'

import { FOOTER_LINKS } from '../landing.constants.below'
import { Heading } from '@/components/ui/Heading'

function LinkColumn({ title, links }: { title: string; links: ReadonlyArray<{ label: string; href: string }> }) {
  return (
    <div>
      <Heading level={3} className="mb-3 text-sm font-semibold text-white">{title}</Heading>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="text-sm text-gray-400 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LandingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-800 bg-gray-950 px-4 py-12 sm:py-16">
      <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand column */}
        <div className="sm:col-span-2 lg:col-span-1">
          <span className="text-lg font-bold text-white">{APP_NAME}</span>
          <Text className="mt-2 max-w-[220px] text-sm leading-relaxed text-gray-400">
            {APP_TAGLINE}
          </Text>
          <Text className="mt-3 text-sm text-gray-500">
            Made with ❤️ in India
          </Text>
        </div>

        {/* Link columns */}
        <LinkColumn title="Product" links={FOOTER_LINKS.product} />
        <LinkColumn title="Resources" links={FOOTER_LINKS.resources} />
        <LinkColumn title="Company" links={FOOTER_LINKS.company} />
      </div>

      {/* Bottom bar */}
      <div className="mx-auto mt-10 flex max-w-5xl flex-col items-center justify-between gap-4 border-t border-gray-800 pt-6 sm:flex-row">
        <Text className="text-xs text-gray-500">
          &copy; {year} {APP_NAME}. All rights reserved. — Sawan Jaiswal, Proprietor
        </Text>
        <div className="flex gap-4">
          {FOOTER_LINKS.social.map((s) => (
            <a
              key={s.label}
              href={s.href}
              className="text-sm text-gray-500 transition-colors hover:text-white"
              aria-label={s.label}
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
