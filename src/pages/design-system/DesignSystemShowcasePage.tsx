import React from 'react'
import { Sun, Moon, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTheme } from '@/context/ThemeContext'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { ShowcaseTokensSection } from './components/ShowcaseTokensSection'
import { ShowcaseButtonsSection } from './components/ShowcaseButtonsSection'
import { ShowcaseNavigationSection } from './components/ShowcaseNavigationSection'
import { ShowcaseFormsSection } from './components/ShowcaseFormsSection'
import { ShowcaseOverlaysSection } from './components/ShowcaseOverlaysSection'
import { ShowcaseEnterpriseSection } from './components/ShowcaseEnterpriseSection'

export const DesignSystemShowcasePage: React.FC = () => {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors duration-150 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-8 pb-16">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[var(--border-default)]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard"
                className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--primary)] flex items-center gap-1 transition-colors"
              >
                <ArrowLeft size={14} /> Back to Dashboard
              </Link>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
              HisaabPro Design System (Level 6 Apex)
            </h1>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              Complete Component & Primitive Catalog (shadcn/ui + SSOT Token Architecture).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              leftIcon={isDark ? <Sun size={14} /> : <Moon size={14} />}
            >
              {isDark ? 'Light Theme' : 'Dark Theme'}
            </Button>
          </div>
        </div>

        {/* Indic & Multilingual Engine Demonstration */}
        <Card>
          <CardHeader>
            <CardTitle>Multilingual & Indic Typography Engine</CardTitle>
            <p className="text-xs text-[var(--text-secondary)]">Zero glyph crowding, normalized letter-spacing across English and Indic scripts.</p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] space-y-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">English</span>
              <div className="text-base font-bold text-[var(--text-primary)]">Invoice No: INV-2026-0042</div>
              <div className="text-xs text-[var(--text-secondary)]">Total Amount: ₹14,250.00 (Paid in Full)</div>
            </div>
            <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] space-y-1" lang="hi">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">हिन्दी (Hindi)</span>
              <div className="text-base font-bold text-[var(--text-primary)]">बिल संख्या: INV-2026-0042</div>
              <div className="text-xs text-[var(--text-secondary)]">कुल देय राशि: ₹14,250.00 (पूर्ण भुगतान)</div>
            </div>
          </CardContent>
        </Card>

        {/* 1. SSOT Color & Surface Tokens */}
        <ShowcaseTokensSection />

        {/* 2. Buttons & Icon Actions Suite */}
        <ShowcaseButtonsSection />

        {/* 3. Navigation: Tabs, Dropdowns & Filter Chips */}
        <ShowcaseNavigationSection />

        {/* 4. Forms & Controls: Inputs, Currency, Select, Checkbox, Switch, DateField */}
        <ShowcaseFormsSection />

        {/* 5. Overlays & Primitives: Badges, Modals, Tooltips, Empty States */}
        <ShowcaseOverlaysSection />

        {/* 6. Enterprise Data, Feedback & Navigation: Table, Skeleton, Alert, Progress, Breadcrumbs, Accordion, Avatar, Pagination */}
        <ShowcaseEnterpriseSection />
      </div>
    </div>
  )
}

export default DesignSystemShowcasePage
