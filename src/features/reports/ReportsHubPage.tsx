/** Reports Hub — landing page for all report categories (lazy loaded) */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  ShoppingCart,
  Package,
  Calendar,
  Banknote,
  Receipt,
  FileText,
  ChevronRight,
  BarChart3,
  Percent,
  FileCode,
  type LucideProps,
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { REPORT_CATEGORIES } from './report.categories'
import './report-hub.css'
import { useLanguage } from '@/hooks/useLanguage'

// ─── Icon registry ────────────────────────────────────────────────────────────

type IconComponent = React.FC<LucideProps>

const ICON_MAP: Record<string, IconComponent> = {
  TrendingUp,
  ShoppingCart,
  Package,
  Calendar,
  Banknote,
  Receipt,
  FileText,
  BarChart3,
  Percent,
  FileCode,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsHubPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()

  return (
    <AppShell>
      <Header title={t.reports} backTo={ROUTES.DASHBOARD} />

      <div className="page-hero">
        <section className="report-hub-hero" aria-label={t.reportsOverview}>
          <div className="report-hub-hero-icon" aria-hidden="true">
            <BarChart3 size={28} />
          </div>
          <div className="report-hub-hero-content">
            <span className="report-hub-hero-title">{t.businessInsights}</span>
            <span className="report-hub-hero-subtitle">
              {t.trackSalesStockCashFlow}
            </span>
          </div>
          <span className="report-hub-hero-count">{REPORT_CATEGORIES.length} {t.reportsCount}</span>
        </section>
      </div>

      <PageContainer className="space-y-6">
        <div className="report-hub">
          <div className="report-hub-grid stagger-list">
            {REPORT_CATEGORIES.map((category) => {
              const Icon = ICON_MAP[category.icon] ?? TrendingUp

              return (
                <button
                  key={category.id}
                  className="report-category-card"
                  onClick={() => navigate(category.route)}
                  aria-label={`${t.viewReport} ${category.title}`}
                  type="button"
                  style={{ '--report-accent-color': category.color } as React.CSSProperties}
                >
                  <div className="report-category-icon" aria-hidden="true">
                    <Icon size={22} />
                  </div>

                  <div>
                    <div className="report-category-title">{category.title}</div>
                    <div className="report-category-desc">{category.description}</div>
                  </div>

                  <div className="report-category-footer" aria-hidden="true">
                    <ChevronRight size={16} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </PageContainer>
    </AppShell>
  )
}
