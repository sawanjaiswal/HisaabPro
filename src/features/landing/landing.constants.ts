/** Landing page — constants & feature data */

import { ROUTES } from '@/config/routes.config'

export interface LandingFeature {
  id: string
  title: string
  description: string
  icon: string
}

export interface CompetitorRow {
  feature: string
  us: boolean | string
  vyapar: boolean | string
  billbook: boolean | string
}

export const HERO_STATS = [
  { value: '90+', label: 'Features' },
  { value: '7', label: 'Doc Types' },
  { value: '100%', label: 'Offline' },
  { value: '0', label: 'Data Loss' },
] as const

export const FEATURES: LandingFeature[] = [
  { id: 'billing', title: 'GST & Non-GST Billing', description: 'Create invoices, quotations, delivery challans, credit notes in seconds. 7 document types.', icon: 'FileText' },
  { id: 'payments', title: 'Payment Tracking', description: 'Record payments, track outstanding, send reminders via WhatsApp. Never miss a collection.', icon: 'IndianRupee' },
  { id: 'inventory', title: 'Smart Inventory', description: 'Real-time stock tracking with low-stock alerts, batch management, and barcode scanning.', icon: 'Package' },
  { id: 'offline', title: 'Works Offline', description: 'Full functionality without internet. Auto-syncs when back online. Zero data loss guarantee.', icon: 'WifiOff' },
  { id: 'reports', title: 'Powerful Reports', description: 'P&L, balance sheet, cash flow, aging reports, day book — all at your fingertips.', icon: 'BarChart3' },
  { id: 'whatsapp', title: 'WhatsApp Integration', description: 'Share invoices, send payment reminders, and festival greetings directly via WhatsApp.', icon: 'MessageCircle' },
  { id: 'roles', title: 'Staff & Roles', description: 'Custom role builder with granular permissions. Control who sees what.', icon: 'Users' },
  { id: 'security', title: 'Bank-Grade Security', description: 'PIN lock, biometric auth, encrypted data, audit logs. Your business data is safe.', icon: 'Shield' },
]

export const COMPARISON: CompetitorRow[] = [
  { feature: 'Works fully offline', us: true, vyapar: false, billbook: false },
  { feature: 'Zero data loss', us: true, vyapar: false, billbook: false },
  { feature: 'Custom role builder', us: true, vyapar: false, billbook: false },
  { feature: 'WhatsApp support (days)', us: true, vyapar: 'Months', billbook: 'Months' },
  { feature: 'Modern premium UI', us: true, vyapar: false, billbook: 'Basic' },
  { feature: 'Bill OCR scanning', us: true, vyapar: true, billbook: true },
  { feature: 'Tally export', us: true, vyapar: true, billbook: true },
  { feature: 'Festival greetings', us: true, vyapar: false, billbook: true },
]

export const CTA_ROUTE = ROUTES.LOGIN
