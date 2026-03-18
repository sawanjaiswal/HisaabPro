/** Landing page data — sections 5, 8-12 (deep dive, comparison, pricing, testimonials, CTA, footer) */

import type { CompetitorRow, FeatureDeepDive } from './landing.types'

/* ─── Section 5: Feature deep dive (accordion) ─── */
export const FEATURE_DEEP_DIVES: FeatureDeepDive[] = [
  {
    id: 'offline-deep',
    title: 'Offline Mode',
    subtitle: 'Your billing never stops — even with zero signal',
    icon: 'WifiOff',
    details: [
      'Every feature works without internet — invoicing, payments, inventory, reports. Not a "limited" mode.',
      'Data stored securely on device using encrypted local storage. Nothing lost if you close the app.',
      'When internet returns, everything syncs automatically in the background. No manual upload needed.',
      'Conflict resolution handles two staff members editing the same record offline.',
      'Tested on 2G/3G networks and areas with zero connectivity — basements, rural towns, underground markets.',
    ],
  },
  {
    id: 'invoicing-deep',
    title: 'Invoicing & Documents',
    subtitle: '7 document types, professional templates, 30-second creation',
    icon: 'FileText',
    details: [
      '7 types: Tax Invoice, Quotation, Purchase Order, Delivery Challan, Credit Note, Debit Note, Proforma.',
      'Auto-numbering with customizable prefixes (INV-2025-001). Never duplicate an invoice number.',
      'GST auto-calculation: CGST + SGST for same-state, IGST for inter-state. HSN code lookup built in.',
      'Professional PDF templates with your logo, colors, and terms. Print on A4 or thermal printers.',
      'UPI QR code on every invoice — customers scan and pay directly. Payment auto-records when matched.',
    ],
  },
  {
    id: 'payments-deep',
    title: 'Payments & Outstanding',
    subtitle: 'Track every rupee — who owes you, who you owe',
    icon: 'IndianRupee',
    details: [
      'Record full or partial payments. Supports cash, UPI, bank transfer, cheque, and credit.',
      'Party-wise outstanding dashboard: total receivable and payable at a glance for every party.',
      'Aging reports: which payments are 30, 60, 90+ days overdue. Prioritize collections smartly.',
      'One-tap WhatsApp payment reminders with invoice PDF attached. Customers see exactly what they owe.',
      'UPI QR code on every invoice — customers scan, pay, done. Reconciliation made simple.',
    ],
  },
  {
    id: 'inventory-deep',
    title: 'Inventory Management',
    subtitle: 'Real-time stock with zero manual counting',
    icon: 'Package',
    details: [
      'Stock updates automatically with every sale and purchase. No manual adjustments for normal operations.',
      'Low-stock alerts notify you before items run out. Set custom reorder points per product.',
      'Batch tracking and expiry date management for perishable goods. FIFO stock consumption built in.',
      'Barcode scanning using your phone camera. No external scanner needed. Scan to add items instantly.',
      'Multi-location stock: track inventory across warehouse, shop, and godown. Transfer between locations.',
    ],
  },
]

/* ─── Section 8: Comparison ─── */
export const COMPARISON: CompetitorRow[] = [
  { feature: 'Works fully offline', us: true, vyapar: 'Limited', billbook: 'Limited' },
  { feature: 'Zero data loss guarantee', us: true, vyapar: false, billbook: false },
  { feature: 'Modern 2025 UI', us: true, vyapar: false, billbook: 'Basic' },
  { feature: 'Custom staff role builder', us: true, vyapar: false, billbook: false },
  { feature: 'UPI QR on invoices', us: true, vyapar: true, billbook: true },
  { feature: 'WhatsApp invoice sharing', us: true, vyapar: true, billbook: true },
  { feature: 'Thermal receipt printing', us: true, vyapar: true, billbook: true },
  { feature: 'Support response time', us: '< 24 hrs', vyapar: 'Weeks', billbook: 'Weeks' },
  { feature: 'Bill OCR scanning', us: true, vyapar: true, billbook: true },
  { feature: 'Tally data export', us: true, vyapar: true, billbook: true },
]

/* ─── Section 9: Pricing ─── */
export const PRICING = {
  monthly: {
    amount: 299,
    label: '/month',
    period: 'Billed monthly',
  },
  yearly: {
    amount: 2999,
    label: '/year',
    period: 'Billed annually',
    savings: 589,
    badge: 'Save \u20B9589',
  },
  freeTier: {
    headline: 'Start free. Upgrade when ready.',
    description:
      'Free plan includes 1 business, 50 invoices/month, and all core features. No credit card needed.',
  },
  features: [
    'Unlimited invoices & documents',
    '7 document types (invoice, quotation, PO, challan, credit/debit note, proforma)',
    'Full offline mode with auto-sync',
    'Inventory management with low-stock alerts',
    'Payment tracking & outstanding reports',
    'WhatsApp invoice sharing & reminders',
    'UPI QR code on every invoice',
    'Thermal & A4 printing',
    '15+ business reports',
    'Custom staff roles & permissions',
    'Hindi + English bilingual',
    'Bank-grade security (PIN, biometrics, encryption)',
  ],
} as const

/* ─── Section 10: Testimonials ─── */
export const TESTIMONIALS = [
  {
    id: 't1',
    quote:
      'Switched from Vyapar 3 months ago. The offline mode actually works — my shop is in a basement with no signal. Haven\'t lost a single bill since switching.',
    name: 'Ramesh Gupta',
    role: 'Kirana Store Owner',
    location: 'Indore, MP',
  },
  {
    id: 't2',
    quote:
      'We manage 200+ SKUs and 50 customers. HisaabPro handles inventory and payments better than anything we tried. The staff role system is a lifesaver.',
    name: 'Priya Sharma',
    role: 'Wholesale Distributor',
    location: 'Jaipur, RJ',
  },
  {
    id: 't3',
    quote:
      'My staff create invoices on their phones and I see everything on mine. The role system means they can\'t touch reports or change prices. Peace of mind.',
    name: 'Amit Patel',
    role: 'Multi-Store Owner',
    location: 'Ahmedabad, GJ',
  },
  {
    id: 't4',
    quote:
      'WhatsApp invoice sharing is brilliant. Customers love getting professional PDFs instead of handwritten notes. Collections improved 30% with payment reminders.',
    name: 'Sunita Devi',
    role: 'Boutique Owner',
    location: 'Lucknow, UP',
  },
  {
    id: 't5',
    quote:
      'Used Excel for 8 years. Set up HisaabPro in 15 minutes, now billing takes half the time. Thermal printer support is amazing — no separate billing machine.',
    name: 'Vikram Singh',
    role: 'Hardware Store Owner',
    location: 'Jodhpur, RJ',
  },
  {
    id: 't6',
    quote:
      'Our town has terrible internet. Other apps show loading screens all day. HisaabPro works like there is no internet needed. My delivery challans are always ready.',
    name: 'Meena Agarwal',
    role: 'Grain Wholesaler',
    location: 'Ratlam, MP',
  },
] as const

/* ─── Section 11: CTA ─── */
export const CTA = {
  headline: 'Start billing smarter today',
  subtext:
    'Free for your first business. No credit card required. Set up in under 2 minutes.',
  button: 'Start Free Now',
} as const

/* ─── Section 12: Footer ─── */
export const FOOTER_TAGLINE =
  'Billing, Inventory & Payments for Indian Businesses' as const
export const FOOTER_LEGAL = 'Made with pride in India' as const

export const FOOTER_LINKS = {
  product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Compare', href: '#comparison' },
    { label: 'Templates', href: '#' },
    { label: 'Download App', href: '#' },
  ],
  resources: [
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Help Center', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Video Tutorials', href: '#' },
    { label: 'WhatsApp Support', href: 'https://wa.me/919XXXXXXXXX' },
  ],
  company: [
    { label: 'About Us', href: '#' },
    { label: 'Contact', href: 'mailto:support@hisaabpro.in' },
    { label: 'Careers', href: '#' },
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
  ],
  social: [
    { label: 'Twitter', href: '#', icon: 'Twitter' },
    { label: 'YouTube', href: '#', icon: 'Youtube' },
    { label: 'Instagram', href: '#', icon: 'Instagram' },
    { label: 'LinkedIn', href: '#', icon: 'Linkedin' },
  ],
} as const
