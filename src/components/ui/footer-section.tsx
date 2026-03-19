'use client';
import React from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from 'lucide-react';
import { LP_SECTIONS, LP_SOCIAL, LP_LEGAL, LP_EXTERNAL, hash } from '@/config/landing-links.config';

interface FooterLink {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface FooterSection {
  label: string;
  links: FooterLink[];
}

const footerLinks: FooterSection[] = [
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
    label: 'Follow Us',
    links: [
      { title: 'Instagram', href: LP_SOCIAL.INSTAGRAM, icon: InstagramIcon },
      { title: 'YouTube', href: LP_SOCIAL.YOUTUBE, icon: YoutubeIcon },
      { title: 'Twitter / X', href: LP_SOCIAL.TWITTER, icon: TwitterIcon },
      { title: 'LinkedIn', href: LP_SOCIAL.LINKEDIN, icon: LinkedinIcon },
    ],
  },
];

export function Footer() {
  return (
    <footer
      className="md:rounded-t-6xl relative w-full max-w-6xl mx-auto flex flex-col items-center justify-center rounded-t-4xl border-t px-6 py-12 lg:py-16"
      style={{ borderColor: 'var(--lp-border)' }}
    >
      <div
        className="grid w-full gap-8 grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]"
      >
        {/* Brand column — 2fr */}
        <AnimatedContainer className="flex flex-col gap-3">
          <p className="text-lg font-bold lp-text">HisaabPro</p>
          <div className="flex items-center gap-4">
            {[
              { Icon: InstagramIcon, label: 'Instagram', href: LP_SOCIAL.INSTAGRAM },
              { Icon: YoutubeIcon, label: 'YouTube', href: LP_SOCIAL.YOUTUBE },
              { Icon: TwitterIcon, label: 'Twitter / X', href: LP_SOCIAL.TWITTER },
              { Icon: LinkedinIcon, label: 'LinkedIn', href: LP_SOCIAL.LINKEDIN },
            ].map(({ Icon, label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="transition-colors duration-200 lp-text-muted"
                onMouseEnter={e => e.currentTarget.style.color = 'var(--lp-text)'}
                onMouseLeave={e => e.currentTarget.style.color = ''}
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
          <p className="text-sm lp-text-muted max-w-[220px]">
            Billing, inventory &amp; payments for Indian businesses.
          </p>
        </AnimatedContainer>

        {/* Link columns — 1fr each */}
        {footerLinks.map((section, index) => (
          <AnimatedContainer key={section.label} delay={0.1 + index * 0.1}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider lp-text-muted" style={{ opacity: 0.6 }}>{section.label}</p>
              <ul className="mt-4 space-y-2 text-sm lp-text-muted">
                {section.links.map((link) => (
                  <li key={link.title}>
                    <a
                      href={link.href}
                      className="inline-flex items-center transition-all duration-300 hover:opacity-100"
                      style={{ color: 'var(--lp-text-muted)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--lp-text)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--lp-text-muted)'}
                    >
                      {link.icon && <link.icon className="me-1 size-4" />}
                      {link.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </AnimatedContainer>
        ))}
      </div>

      {/* Bottom bar */}
      <div
        className="mt-12 w-full border-t pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: 'var(--lp-border-subtle)' }}
      >
        <p className="text-xs lp-text-muted">
          &copy; {new Date().getFullYear()} HisaabPro. Made in India.
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
              className="text-xs transition-colors duration-200 lp-text-muted"
              onMouseEnter={e => e.currentTarget.style.color = 'var(--lp-text)'}
              onMouseLeave={e => e.currentTarget.style.color = ''}
            >
              {link.title}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

type ViewAnimationProps = {
  delay?: number;
  className?: ComponentProps<typeof motion.div>['className'];
  children: ReactNode;
};

function AnimatedContainer({ className, delay = 0.1, children }: ViewAnimationProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ filter: 'blur(4px)', translateY: -8, opacity: 0 }}
      whileInView={{ filter: 'blur(0px)', translateY: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.8 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
