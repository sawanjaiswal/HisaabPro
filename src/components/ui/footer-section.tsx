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
    <footer className="md:rounded-t-6xl relative w-full max-w-6xl mx-auto flex flex-col items-center justify-center rounded-t-4xl border-t border-neutral-200 dark:border-white/10 bg-[radial-gradient(35%_128px_at_50%_0%,theme(backgroundColor.white/8%),transparent)] px-6 py-12 lg:py-16">
      <div className="bg-foreground/20 absolute top-0 right-1/2 left-1/2 h-px w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full blur" />

      <div className="grid w-full gap-8 xl:grid-cols-3 xl:gap-8">
        <AnimatedContainer className="space-y-1">
          <p className="text-lg font-bold">HisaabPro</p>
          <p className="text-muted-foreground text-sm">
            Billing, inventory &amp; payments for Indian businesses.
          </p>
        </AnimatedContainer>

        <div className="mt-10 grid grid-cols-2 gap-8 md:grid-cols-4 xl:col-span-2 xl:mt-0">
          {footerLinks.map((section, index) => (
            <AnimatedContainer key={section.label} delay={0.1 + index * 0.1}>
              <div className="mb-10 md:mb-0">
                {/* p tag (not h3) to avoid landing.css 1.75rem override */}
                <p className="text-xs font-semibold uppercase tracking-wider opacity-50">{section.label}</p>
                <ul className="text-muted-foreground mt-4 space-y-2 text-sm">
                  {section.links.map((link) => (
                    <li key={link.title}>
                      <a
                        href={link.href}
                        className="hover:text-foreground inline-flex items-center transition-all duration-300"
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

      {/* Bottom bar: copyright + social icons */}
      <div className="mt-12 w-full border-t border-neutral-200 dark:border-white/8 pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} HisaabPro. Made in India.
        </p>
        <div className="flex items-center gap-5">
          <a href="#" aria-label="Instagram" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
            <InstagramIcon className="size-4" />
          </a>
          <a href="#" aria-label="YouTube" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
            <YoutubeIcon className="size-4" />
          </a>
          <a href="#" aria-label="Twitter / X" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
            <TwitterIcon className="size-4" />
          </a>
          <a href="#" aria-label="LinkedIn" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
            <LinkedinIcon className="size-4" />
          </a>
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
