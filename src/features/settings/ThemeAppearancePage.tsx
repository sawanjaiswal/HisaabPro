import { Sun, Moon } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/hooks/useLanguage'
import { ThemeVariantPicker } from './theme/ThemeVariantPicker'
import './theme/theme.css'

export default function ThemeAppearancePage() {
  const { t } = useLanguage()
  const { theme, setTheme } = useTheme()

  return (
    <AppShell>
      <Header title={t.themePageTitle} backTo={ROUTES.SETTINGS} />
      <PageContainer className="theme-page stagger-enter space-y-6">
        <section>
          <p className="theme-section-title">{t.themeAppearance}</p>
          <div className="theme-appearance-toggle" role="radiogroup" aria-label={t.themeAppearance}>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'light'}
              onClick={() => setTheme('light')}
              className={`theme-appearance-option${theme === 'light' ? ' theme-appearance-option--active' : ''}`}
            >
              <Sun size={16} strokeWidth={2} />
              {t.themeLight}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'dark'}
              onClick={() => setTheme('dark')}
              className={`theme-appearance-option${theme === 'dark' ? ' theme-appearance-option--active' : ''}`}
            >
              <Moon size={16} strokeWidth={2} />
              {t.themeDark}
            </button>
          </div>
        </section>

        <section>
          <p className="theme-section-title">{t.themeColourTheme}</p>
          <ThemeVariantPicker />
        </section>

        <p
          style={{
            fontSize: 'var(--fs-xs)',
            color: 'var(--color-gray-400)',
            textAlign: 'center',
            padding: 'var(--space-2) var(--space-4) var(--space-6)',
            lineHeight: '1.5',
          }}
        >
          {t.themeHint}
        </p>
      </PageContainer>
    </AppShell>
  )
}
