/** Audit #5 — Backup settings page (Google Drive). */

import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { DriveBackupCard } from './DriveBackupCard'

export default function BackupPage() {
  const { t } = useLanguage()

  return (
    <AppShell>
      <Header title={t.backupPageTitle} backTo={ROUTES.SETTINGS} />
      <HeroPage className="stagger-enter space-y-6">
        <DriveBackupCard />
      </HeroPage>
    </AppShell>
  )
}
