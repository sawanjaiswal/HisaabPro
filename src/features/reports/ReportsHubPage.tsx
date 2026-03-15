/** Reports Hub — landing page for all report categories (lazy loaded) */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  ShoppingCart,
  Package,
  Calendar,
  Banknote,
  ChevronRight,
  type LucideProps,
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { REPORT_CATEGORIES } from './report.constants'
import './reports.css'

// ─── Icon registry ────────────────────────────────────────────────────────────

type IconComponent = React.FC<LucideProps>

const ICON_MAP: Record<string, IconComponent> = {
  TrendingUp,
  ShoppingCart,
  Package,
  Calendar,
  Banknote,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsHubPage() {
  const navigate = useNavigate()

  return (
    <AppShell>
      <Header title="Reports" backTo={ROUTES.DASHBOARD} />

      <PageContainer>
        <div className="report-hub">
          <div className="report-hub-grid">
            {REPORT_CATEGORIES.map((category) => {
              const Icon = ICON_MAP[category.icon] ?? TrendingUp

              return (
                <button
                  key={category.id}
                  className="report-category-card"
                  onClick={() => navigate(category.route)}
                  aria-label={`View ${category.title}`}
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
