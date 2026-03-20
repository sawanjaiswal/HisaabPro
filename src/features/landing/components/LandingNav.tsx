/** Navigation — fixed top, backdrop-blur, center links (wisedev/saa-s-template) */

import { memo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

import { APP_NAME } from '@/config/app.config'
import { NAV_LINKS, CTA_ROUTE } from '../landing.constants'

export const LandingNav = memo(function LandingNav() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <header className="fixed top-0 w-full z-50 border-b border-gray-800/50 bg-black/80 backdrop-blur-md">
      <nav className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-xl font-semibold text-white">{APP_NAME}</div>

          {/* Center links — desktop */}
          <div className="hidden md:flex items-center justify-center gap-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right actions — desktop */}
          <div className="hidden md:flex items-center gap-4">
            <button
              type="button"
              className="inline-flex items-center justify-center h-10 px-5 text-sm font-medium text-white hover:bg-gray-800/50 rounded-md transition-all"
              onClick={() => navigate(CTA_ROUTE)}
            >
              Sign in
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center h-10 px-5 text-sm font-medium bg-white text-black hover:bg-gray-100 rounded-md transition-all"
              onClick={() => navigate(CTA_ROUTE)}
            >
              Get Started
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-black/95 backdrop-blur-md border-t border-gray-800/50 animate-[slideDown_0.3s_ease-out]">
          <div className="px-6 py-4 flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-white/60 hover:text-white transition-colors py-2"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-4 border-t border-gray-800/50">
              <button
                type="button"
                className="h-10 px-5 text-sm font-medium text-white hover:bg-gray-800/50 rounded-md transition-all"
                onClick={() => { setMobileOpen(false); navigate(CTA_ROUTE) }}
              >
                Sign in
              </button>
              <button
                type="button"
                className="h-10 px-5 text-sm font-medium bg-white text-black hover:bg-gray-100 rounded-md transition-all"
                onClick={() => { setMobileOpen(false); navigate(CTA_ROUTE) }}
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
})
