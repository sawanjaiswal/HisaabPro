'use client';
import { InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from 'lucide-react';
import { LP_SECTIONS, LP_SOCIAL, LP_LEGAL, LP_EXTERNAL, hash } from '@/config/landing-links.config';
import { APP_NAME } from '@/config/app.config';

const footerLinks = [
  {
    label: 'Product',
    links: [
      { title: 'Features', href: hash(LP_SECTIONS.FEATURES) },
      { title: 'Pricing', href: hash(LP_SECTIONS.PRICING) },
      { title: 'Download', href: hash(LP_SECTIONS.DOWNLOAD) },
    ],
  },
  {
    label: 'Company',
    links: [
      { title: 'About Us', href: LP_LEGAL.ABOUT },
      { title: 'Privacy Policy', href: LP_LEGAL.PRIVACY },
      { title: 'Terms of Service', href: LP_LEGAL.TERMS },
    ],
  },
  {
    label: 'Support',
    links: [
      { title: 'Help Center', href: LP_LEGAL.HELP },
      { title: 'WhatsApp Support', href: LP_EXTERNAL.WHATSAPP_SUPPORT },
      { title: 'FAQs', href: hash(LP_SECTIONS.FAQ) },
    ],
  },
  {
    label: 'Resources',
    links: [
      { title: 'Blog', href: '/blog' },
      { title: 'Invoice Templates', href: '/templates' },
      { title: 'GST Calculator', href: '/gst-calculator' },
      { title: 'Business Ideas', href: '/ideas' },
    ],
  },
];

const socialLinks = [
  { Icon: InstagramIcon, label: 'Instagram', href: LP_SOCIAL.INSTAGRAM },
  { Icon: YoutubeIcon, label: 'YouTube', href: LP_SOCIAL.YOUTUBE },
  { Icon: TwitterIcon, label: 'Twitter / X', href: LP_SOCIAL.TWITTER },
  { Icon: LinkedinIcon, label: 'LinkedIn', href: LP_SOCIAL.LINKEDIN },
];

export function Footer() {
  return (
    <footer
      className="w-full border-t px-6 py-12 lg:py-16"
      style={{ borderColor: 'var(--lp-border)' }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Main grid — brand left, 4 link columns right */}
        <div className="grid gap-8 md:gap-10 grid-cols-2 md:grid-cols-6">
          {/* Brand column */}
          <div className="col-span-2 flex flex-col gap-4">
            <p className="text-lg font-bold lp-text">{APP_NAME}</p>
            <p className="text-sm lp-text-muted max-w-[240px]">
              Billing, inventory &amp; payments for Indian businesses.
            </p>
            <div className="flex items-center gap-4">
              {socialLinks.map(({ Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="transition-colors duration-200 lp-text-muted"
                  onPointerEnter={e => e.currentTarget.style.color = 'var(--lp-text)'}
                  onPointerLeave={e => e.currentTarget.style.color = ''}
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {footerLinks.map((section) => (
            <div key={section.label}>
              <p className="text-xs font-semibold uppercase tracking-wider lp-text-muted mb-4" style={{ opacity: 0.6 }}>
                {section.label}
              </p>
              <ul className="space-y-2.5 text-sm">
                {section.links.map((link) => (
                  <li key={link.title}>
                    <a
                      href={link.href}
                      className="lp-text-muted transition-colors duration-200"
                      onPointerEnter={e => e.currentTarget.style.color = 'var(--lp-text)'}
                      onPointerLeave={e => e.currentTarget.style.color = ''}
                    >
                      {link.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 pt-6 border-t flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: 'var(--lp-border-subtle)' }}
        >
          <p className="text-xs lp-text-muted">
            &copy; {new Date().getFullYear()} {APP_NAME}. Made in India.
          </p>
          <div className="flex items-center gap-6">
            {[
              { title: 'Privacy Policy', href: LP_LEGAL.PRIVACY },
              { title: 'Terms of Service', href: LP_LEGAL.TERMS },
              { title: 'Refund Policy', href: LP_LEGAL.REFUND },
            ].map((link) => (
              <a
                key={link.title}
                href={link.href}
                className="text-xs lp-text-muted transition-colors duration-200"
                onPointerEnter={e => e.currentTarget.style.color = 'var(--lp-text)'}
                onPointerLeave={e => e.currentTarget.style.color = ''}
              >
                {link.title}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
