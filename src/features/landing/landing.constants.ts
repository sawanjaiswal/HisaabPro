/** Landing page data — sections 1-7 (above fold + core) */

import { ROUTES } from '@/config/routes.config'

import type { LandingFeature } from './landing.types'

export type { LandingFeature } from './landing.types'
export type { AccordionFeature, CompetitorRow, FeatureDeepDive, SectionHeader } from './landing.types'

export const CTA_ROUTE = ROUTES.LOGIN

/* ─── Section 1: Hero ─── */
export const HERO = {
  badge: 'Free for Indian Businesses',
  headline: 'Billing software that actually',
  headlineAccent: 'works offline.',
  subtext:
    'Create GST invoices, track payments, manage inventory — all from your phone. Works without internet. Zero data loss. Built for Indian MSMEs.',
  cta: 'Start Free',
  ctaSecondary: 'See How It Works',
} as const

export const TRUST_STATS = [
  { value: '90+', label: 'Features' },
  { value: '7', label: 'Document Types' },
  { value: '100%', label: 'Offline Ready' },
  { value: '0', label: 'Data Loss' },
] as const

/* ─── Section 2: Problem statement ─── */
export const PROBLEMS = [
  {
    emoji: '\uD83D\uDCD2',
    title: 'Still using pen & paper?',
    description:
      'Handwritten bills get lost. Calculations go wrong. Finding last month\'s invoice means digging through 3 registers. Tax time? Pure nightmare.',
    icon: 'NotebookPen',
  },
  {
    emoji: '\uD83D\uDE24',
    title: 'Frustrated with other apps?',
    description:
      'Vyapar crashed and you lost 6 months of data. BillBook\'s "offline mode" shows a blank screen. Support replies after 3 months — if at all.',
    icon: 'CircleAlert',
  },
  {
    emoji: '\uD83D\uDCF5',
    title: 'Bad internet in your area?',
    description:
      'Your shop is in a basement. Or a small town with 2G. Other apps freeze, show loading spinners, lose entries. Your billing shouldn\'t stop when the internet does.',
    icon: 'WifiOff',
  },
] as const

/* ─── Section 3: Features bento grid ─── */
export const FEATURES: LandingFeature[] = [
  {
    id: 'offline',
    title: 'Works 100% Offline',
    description:
      'Full functionality without internet. Create invoices, record payments, update stock — everything works. Auto-syncs when back online.',
    icon: 'WifiOff',
    size: 'large',
  },
  {
    id: 'invoicing',
    title: 'GST & Non-GST Invoicing',
    description:
      '7 document types: invoices, quotations, POs, challans, credit/debit notes, proforma. Auto-numbering, tax calculation, done in 30 seconds.',
    icon: 'FileText',
    size: 'large',
  },
  {
    id: 'payments',
    title: 'Payment Tracking',
    description:
      'Record payments against invoices. Track who owes how much. Send WhatsApp reminders with one tap.',
    icon: 'IndianRupee',
    size: 'medium',
  },
  {
    id: 'inventory',
    title: 'Smart Inventory',
    description:
      'Real-time stock with low-stock alerts. Batch tracking, barcode scanning, multi-location transfers.',
    icon: 'Package',
    size: 'medium',
  },
  {
    id: 'reports',
    title: 'Business Reports',
    description:
      'P&L, cash flow, day book, aging reports, stock summary — 15+ reports at your fingertips.',
    icon: 'BarChart3',
    size: 'medium',
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp Sharing',
    description: 'Send invoices, reminders, and greetings via WhatsApp. One tap.',
    icon: 'MessageCircle',
    size: 'small',
  },
  {
    id: 'roles',
    title: 'Staff & Roles',
    description: 'Custom role builder with granular permissions. Control who sees what.',
    icon: 'Users',
    size: 'small',
  },
  {
    id: 'templates',
    title: 'Invoice Templates',
    description: 'Professional PDFs. Customize colors, logo, layout. Thermal printing.',
    icon: 'Palette',
    size: 'small',
  },
  {
    id: 'security',
    title: 'Bank-Grade Security',
    description: 'PIN lock, biometric auth, encrypted data, full audit logs.',
    icon: 'Shield',
    size: 'small',
  },
]

/* ─── Section 4: How it works ─── */
export const STEPS = [
  {
    step: '01',
    title: 'Create an invoice',
    description:
      'Pick a party, add items, apply tax. Done in 30 seconds. Works offline — no internet needed.',
    icon: 'FileText',
  },
  {
    step: '02',
    title: 'Share via WhatsApp',
    description:
      'Send a professional PDF invoice to your customer\'s WhatsApp. One tap. They get it instantly.',
    icon: 'Share2',
  },
  {
    step: '03',
    title: 'Get paid & track',
    description:
      'Record full or partial payments. See outstanding balances at a glance. Send automatic reminders.',
    icon: 'IndianRupee',
  },
] as const

/* ─── Section 6: Use cases ─── */
export const USE_CASES = [
  {
    id: 'retail',
    title: 'Kirana & Retail',
    description:
      'Quick billing for walk-in customers. Track udhar, manage stock, print thermal receipts.',
    icon: 'Store',
    features: [
      'Quick billing counter — 30 seconds per invoice',
      'Low-stock alerts before items run out',
      'Udhar (credit) tracking per customer',
      'Thermal receipt printing via Bluetooth',
    ],
    imageAlt: 'Kirana store owner using HisaabPro on phone at billing counter',
  },
  {
    id: 'wholesale',
    title: 'Wholesale & Distribution',
    description:
      'Bulk inventory, party management, and outstanding reports for large operations.',
    icon: 'Truck',
    features: [
      'Bulk invoice creation — 50+ items per bill',
      'Party-wise outstanding and aging reports',
      'Multi-warehouse stock tracking',
      'Purchase order and delivery challan workflow',
    ],
    imageAlt: 'Wholesale distributor checking inventory on tablet in warehouse',
  },
  {
    id: 'services',
    title: 'Service Businesses',
    description:
      'Professional invoicing for electricians, plumbers, consultants, and freelancers.',
    icon: 'Briefcase',
    features: [
      'Service-based invoicing with hourly/project rates',
      'Expense tracking and profit calculation',
      'Client statements and payment history',
      'Professional PDF templates with your branding',
    ],
    imageAlt: 'Service professional sending invoice to client via WhatsApp',
  },
] as const

/* ─── Section 7: India-specific ─── */
export const INDIA_FEATURES = [
  { icon: 'QrCode', title: 'UPI QR on Invoices', description: 'Auto-generate UPI QR on every invoice. Customer scans, pays, done.' },
  { icon: 'Languages', title: 'Hindi + English', description: 'Full bilingual interface. Create invoices in Hindi or English. Switch anytime.' },
  { icon: 'Printer', title: 'Thermal Printing', description: '58mm and 80mm Bluetooth receipt printers. Print at your billing counter.' },
  { icon: 'Smartphone', title: 'Works on Budget Phones', description: 'Optimized for Rs 8,000 Android phones with 2G/3G. No lag, no crashes.' },
  { icon: 'IndianRupee', title: 'GST Ready', description: 'CGST, SGST, IGST auto-calculated. HSN codes built in. GST returns export.' },
  { icon: 'Wifi', title: 'Zero Internet Needed', description: 'Complete offline mode. Not "limited" — the full feature set without any signal.' },
] as const

/* ─── Section 5: Feature deep dive (accordion) ─── */
export const FEATURE_DEEP_DIVES = [
  {
    id: 'offline',
    title: 'Works 100% Offline',
    description:
      "Every feature works without internet. Create invoices, manage inventory, record payments — all offline. Data syncs automatically when you're back online. Your business never stops.",
    icon: 'WifiOff',
  },
  {
    id: 'invoicing',
    title: '7 Document Types',
    description:
      'GST & non-GST invoices, quotations, purchase orders, delivery challans, credit notes, debit notes, and proforma invoices. Auto-numbering, tax calculation, and professional PDF templates.',
    icon: 'FileText',
  },
  {
    id: 'payments',
    title: 'Payment Tracking',
    description:
      'Record partial payments, track outstanding amounts per party, send WhatsApp reminders for overdue payments. See exactly who owes you and how much — at a glance.',
    icon: 'IndianRupee',
  },
  {
    id: 'inventory',
    title: 'Smart Inventory',
    description:
      'Real-time stock tracking across locations. Low-stock alerts, batch management, barcode scanning. Stock adjustments with audit trail. Never oversell or run out.',
    icon: 'Package',
  },
] as const

/* ─── Section 9: Pricing ─── */
export const PRICING = {
  monthly: { price: 299, period: 'month', label: 'Monthly' },
  annual: { price: 2999, period: 'year', label: 'Annual', savings: 589, badge: 'Most Popular' },
  features: [
    'Unlimited invoices & documents',
    'Unlimited parties & products',
    '100% offline mode',
    'WhatsApp invoice sharing',
    'Payment tracking & reminders',
    'Business reports & analytics',
    'Staff roles & permissions',
    'Multi-device sync',
    'Thermal printer support',
    'Priority WhatsApp support',
  ],
} as const

/* ─── Nav links ─── */
export const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'For Your Business', href: '#use-cases' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Compare', href: '#comparison' },
] as const
