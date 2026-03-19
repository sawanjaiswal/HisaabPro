'use client';
import React from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from 'lucide-react';

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
      { title: 'Features', href: '#features' },
      { title: 'Pricing', href: '#pricing' },
      { title: 'Download', href: '#download' },
    ],
  },
  {
    label: 'Company',
    links: [
      { title: 'About Us', href: '/about' },
      { title: 'Privacy Policy', href: '/privacy' },
      { title: 'Terms of Service', href: '/terms' },
    ],
  },
  {
    label: 'Support',
    links: [
      { title: 'Help Center', href: '/help' },
      { title: 'WhatsApp Support', href: '#' },
      { title: 'FAQs', href: '#faq' },
    ],
  },
  {
    label: 'Follow Us',
    links: [
      { title: 'Instagram', href: '#', icon: InstagramIcon },
      { title: 'YouTube', href: '#', icon: YoutubeIcon },
      { title: 'Twitter / X', href: '#', icon: TwitterIcon },
      { title: 'LinkedIn', href: '#', icon: LinkedinIcon },
    ],
  },
];

export function Footer() {
  return (
    <footer
      className="md:rounded-t-6xl relative w-full max-w-6xl mx-auto flex flex-col items-center justify-center rounded-t-4xl border-t px-6 py-12 lg:py-16"
      style={{ borderColor: 'var(--lp-border)' }}
    >
      <div className="grid w-full gap-8 xl:grid-cols-3 xl:gap-8">
        <AnimatedContainer className="space-y-1">
          <p className="text-lg font-bold lp-text">HisaabPro</p>
          <p className="text-sm lp-text-muted">
            Billing, inventory &amp; payments for Indian businesses.
          </p>
        </AnimatedContainer>

        <div className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-4 xl:col-span-2 xl:mt-0">
          {footerLinks.map((section, index) => (
            <AnimatedContainer key={section.label} delay={0.1 + index * 0.1}>
              <div className="mb-10 md:mb-0">
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
      </div>

      {/* Bottom bar */}
      <div
        className="mt-12 w-full border-t pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: 'var(--lp-border-subtle)' }}
      >
        <p className="text-xs lp-text-muted">
          &copy; {new Date().getFullYear()} HisaabPro. Made in India.
        </p>
        <div className="flex items-center gap-5">
          {[
            { Icon: InstagramIcon, label: 'Instagram' },
            { Icon: YoutubeIcon, label: 'YouTube' },
            { Icon: TwitterIcon, label: 'Twitter / X' },
            { Icon: LinkedinIcon, label: 'LinkedIn' },
          ].map(({ Icon, label }) => (
            <a
              key={label}
              href="#"
              aria-label={label}
              className="transition-colors duration-200 lp-text-muted"
              onMouseEnter={e => e.currentTarget.style.color = 'var(--lp-text)'}
              onMouseLeave={e => e.currentTarget.style.color = ''}
            >
              <Icon className="size-4" />
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
