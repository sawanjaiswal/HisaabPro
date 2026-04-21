import type React from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { MORE_MENU_ITEMS, MORE_MENU_GROUPS } from './more.constants'
import { ICON_REGISTRY } from './more.icons'
import { ROUTES } from '@/config/routes.config'
import './more.css'
import { useLanguage } from '@/hooks/useLanguage'

export default function MorePage() {
  const { t } = useLanguage()
  const navigate = useNavigate()

  return (
    <AppShell>
      <Header title={t.explore} backTo={ROUTES.DASHBOARD} />
      <PageContainer>
        <nav className="more-sections stagger-list py-0" aria-label={t.featureCategories}>
          {MORE_MENU_GROUPS.map((group) => {
            const groupItems = MORE_MENU_ITEMS.filter((item) => item.group === group.id)
            if (groupItems.length === 0) return null
            return (
              <section key={group.id} className="more-section py-0">
                <h2 className="more-section-title py-0">
                  <span className="more-section-emoji py-0" aria-hidden="true">{group.emoji}</span>
                  {group.label}
                </h2>
                <div className="more-grid">
                  {groupItems.map((item) => {
                    const Icon = ICON_REGISTRY[item.icon]
                    return (
                      <button
                        key={item.id}
                        className="more-grid-item"
                        onClick={() => navigate(item.route)}
                        type="button"
                        aria-label={`${item.label} — ${item.description}`}
                      >
                        <div className="more-grid-icon" style={{ '--icon-bg': item.color } as React.CSSProperties}>
                          {Icon && <Icon size={22} aria-hidden="true" />}
                        </div>
                        <span className="more-grid-label">{item.label}</span>
                        <span className="more-grid-desc">{item.description}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </nav>
      </PageContainer>
    </AppShell>
  )
}
