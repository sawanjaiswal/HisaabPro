import { Check, Loader2, Plus, PauseCircle } from 'lucide-react'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { getBusinessInitials, getBusinessColor } from '@/features/business/business.utils'
import { deriveSuspendState } from '@/features/business/suspend.service'

interface Props {
  onNavigate: (route: string) => void
}

export function SideNavBusinessSwitcher({ onNavigate }: Props) {
  const { user, businesses, activeBusiness, switchBusiness, isSwitching, switchingBusinessId } = useAuth()
  const { t } = useLanguage()

  if (!activeBusiness && businesses.length === 0) return null

  const handleSwitchBusiness = (id: string) => {
    if (id === user?.businessId) return
    void switchBusiness(id)
  }

  const suspendState = deriveSuspendState(activeBusiness)

  return (
    <div className="side-nav-business-wrapper">
      <Accordion type="single" collapsible className="side-nav-business-accordion">
        <AccordionItem value="businesses" className="side-nav-business-accordion-item">
          <AccordionTrigger className="side-nav-business-accordion-trigger">
            <div className="side-nav-business-trigger-card">
              <span
                className="side-nav-business-avatar"
                style={activeBusiness ? { background: getBusinessColor(activeBusiness.id) } : undefined}
                aria-hidden="true"
              >
                {activeBusiness ? getBusinessInitials(activeBusiness.name) : '·'}
              </span>
              <div className="side-nav-business-info">
                <span className="side-nav-business-name">{activeBusiness?.name ?? user?.name ?? 'Business'}</span>
                <span className="side-nav-business-role">
                  {suspendState === 'firm-suspended' ? (
                    <span className="side-nav-status-tag side-nav-status-tag--danger">
                      <PauseCircle size={12} aria-hidden="true" />
                      {t.tenantChipFirmSuspended ?? 'Firm paused'}
                    </span>
                  ) : suspendState === 'member-suspended' ? (
                    <span className="side-nav-status-tag side-nav-status-tag--warning">
                      <PauseCircle size={12} aria-hidden="true" />
                      {t.tenantChipMemberSuspended ?? 'Paused'}
                    </span>
                  ) : (
                    activeBusiness?.roleName ?? 'Owner'
                  )}
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="side-nav-business-accordion-content">
            <div className="side-nav-business-list">
              {businesses.map((biz) => {
                const isActive = biz.id === user?.businessId
                const isLoading = switchingBusinessId === biz.id
                return (
                  <button
                    key={biz.id}
                    type="button"
                    className={`side-nav-business${isActive ? ' is-active' : ''}`}
                    onClick={() => handleSwitchBusiness(biz.id)}
                    disabled={isSwitching}
                    aria-pressed={isActive}
                  >
                    <span
                      className="side-nav-business-avatar"
                      style={{ background: getBusinessColor(biz.id) }}
                      aria-hidden="true"
                    >
                      {getBusinessInitials(biz.name)}
                    </span>
                    <span className="side-nav-business-info">
                      <span className="side-nav-business-name">{biz.name}</span>
                      {biz.role && <span className="side-nav-business-role">{biz.role}</span>}
                    </span>
                    <span className="side-nav-business-status" aria-hidden="true">
                      {isLoading ? <Loader2 size={18} className="side-nav-spin" />
                        : isActive ? <Check size={18} />
                        : null}
                    </span>
                  </button>
                )
              })}
              <button
                type="button"
                className="side-nav-business side-nav-business--add"
                onClick={() => onNavigate(ROUTES.CREATE_BUSINESS)}
              >
                <span className="side-nav-business-avatar side-nav-business-avatar--ghost" aria-hidden="true">
                  <Plus size={20} />
                </span>
                <span className="side-nav-business-info">
                  <span className="side-nav-business-name">Add Business</span>
                </span>
              </button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

