/** More — feature launcher (mockup #25).
 *
 * The mockup shows six account rows; this page carries ~50 feature entries, so
 * the reskin adopts its *motif* (identity card → grouped tinted-icon rows →
 * red Logout row) without dropping anything from MORE_MENU_ITEMS. Trading the
 * launcher for six rows would silently delete access to most of the app.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { Card } from '@/components/ui/Card'
import { PartyAvatar } from '@/components/ui/PartyAvatar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SettingListRow, SettingListGroup } from '@/components/ui/SettingListRow'
import { MORE_MENU_ITEMS, MORE_MENU_GROUPS } from './more.constants'
import { ICON_REGISTRY } from './more.icons'
import { ROUTES } from '@/config/routes.config'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import './more.css'

export default function MorePage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { handleLogout, user, activeBusiness } = useAuth()
  const [confirmLogout, setConfirmLogout] = useState(false)

  return (
    <AppShell>
      <Header title={t.explore} backTo={ROUTES.DASHBOARD} />
      <HeroPage className="more-page space-y-6">
        <Card className="more-identity">
          <PartyAvatar name={user?.name} phone={user?.phone} size="md" />
          <span className="more-identity-info">
            <span className="more-identity-name">{user?.name ?? t.explore}</span>
            {activeBusiness && (
              <span className="more-identity-role">{activeBusiness.role}</span>
            )}
          </span>
        </Card>

        <nav className="more-sections stagger-list py-0" aria-label={t.featureCategories}>
          {MORE_MENU_GROUPS.map((group) => {
            const groupItems = MORE_MENU_ITEMS.filter((item) => item.group === group.id)
            if (groupItems.length === 0) return null
            return (
              <SettingListGroup key={group.id} title={group.label}>
                {groupItems.map((item) => {
                  const Icon = ICON_REGISTRY[item.icon]
                  return (
                    <SettingListRow
                      key={item.id}
                      icon={Icon ? <Icon size={18} strokeWidth={1.8} /> : null}
                      label={item.label}
                      description={item.description}
                      onClick={() => navigate(item.route)}
                    />
                  )
                })}
              </SettingListGroup>
            )
          })}

          <SettingListGroup>
            <SettingListRow
              icon={<LogOut size={18} strokeWidth={1.8} />}
              label={t.logout}
              tone="danger"
              chevron={false}
              onClick={() => setConfirmLogout(true)}
            />
          </SettingListGroup>
        </nav>

        <ConfirmDialog
          open={confirmLogout}
          onClose={() => setConfirmLogout(false)}
          onConfirm={() => { setConfirmLogout(false); handleLogout() }}
          title={t.logout}
          description={t.signOutConfirm}
          confirmLabel={t.logout}
          isDanger
        />
      </HeroPage>
    </AppShell>
  )
}
