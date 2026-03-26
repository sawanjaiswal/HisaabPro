import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { DEFAULT_SHORTCUTS, SHORTCUT_GROUPS } from './shortcut.constants'
import { ShortcutsList } from './components/ShortcutsList'
import './shortcuts.css'

export default function ShortcutsPage() {
  const { t } = useLanguage()

  return (
    <AppShell>
      <Header title={t.keyboardShortcuts} backTo={ROUTES.SETTINGS} />
      <PageContainer className="shortcuts-page">
        <ShortcutsList
          shortcuts={DEFAULT_SHORTCUTS}
          groups={SHORTCUT_GROUPS}
        />
        <p
          style={{
            fontSize: '0.8125rem',
            color: 'var(--color-gray-400)',
            textAlign: 'center',
            padding: 'var(--space-2) var(--space-4) var(--space-6)',
            lineHeight: '1.5',
          }}
        >
          {t.shortcutsDesktopOnly}
        </p>
      </PageContainer>
    </AppShell>
  )
}
