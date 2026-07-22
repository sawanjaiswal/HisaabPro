import { useAuth } from '@/context/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { BottomActionBar } from '@/components/ui/BottomActionBar'
import { Select, SelectItem } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { BUSINESS_TYPE_OPTIONS, BUSINESS_NAME_MAX } from './business.constants'
import { useCreateBusiness } from './useCreateBusiness'
import './create-business.css'

const FORM_ID = 'create-business-form'

export default function CreateBusinessPage() {
  const { t } = useLanguage()
  const { businesses } = useAuth()
  const {
    name,
    setName,
    businessType,
    setBusinessType,
    cloneEnabled,
    setCloneEnabled,
    cloneFromBusinessId,
    setCloneFromBusinessId,
    isSubmitting,
    errors,
    handleSubmit,
  } = useCreateBusiness()

  const hasMultipleBusinesses = businesses.length >= 2

  return (
    <AppShell>
      <Header title={t.createBusinessTitle} backTo={ROUTES.SETTINGS} />

      <HeroPage>
        <form
          id={FORM_ID}
          className="stagger-enter space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          {/* Business name */}
          <Input
            id="biz-name"
            type="text"
            label={t.createBusinessNameReq}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.createBusinessNamePh}
            maxLength={BUSINESS_NAME_MAX}
            autoFocus
            autoComplete="organization"
            error={errors.name}
          />

          {/* Business type */}
          <div className="input-group">
            <label htmlFor="biz-type" className="input-label">
              {t.createBusinessTypeLabel}
            </label>
            <Select
              value={businessType}
              onValueChange={setBusinessType}
              ariaLabel={t.createBusinessTypeLabel}
            >
              {BUSINESS_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </Select>
          </div>

          {/* Clone section — only when user has 2+ businesses */}
          {hasMultipleBusinesses && (
            <div className="create-biz-clone-section py-0">
              <div className="create-biz-clone-toggle-row">
                <div className="create-biz-clone-toggle-info">
                  <p className="create-biz-clone-toggle-label">{t.createBusinessCloneLabel}</p>
                  <p className="create-biz-clone-toggle-hint">{t.createBusinessCloneHint}</p>
                </div>
                <Switch
                  checked={cloneEnabled}
                  onCheckedChange={setCloneEnabled}
                  ariaLabel={t.createBusinessCloneLabel}
                />
              </div>

              {cloneEnabled && (
                <div className="create-biz-clone-picker input-group">
                  <label htmlFor="clone-from" className="input-label">
                    {t.createBusinessCloneFrom}
                  </label>
                  <Select
                    value={cloneFromBusinessId || undefined}
                    onValueChange={setCloneFromBusinessId}
                    ariaLabel={t.createBusinessCloneFrom}
                    placeholder={t.createBusinessClonePickPh}
                  >
                    {businesses.map((biz) => (
                      <SelectItem key={biz.id} value={biz.id}>{biz.name}</SelectItem>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          )}
        </form>
      </HeroPage>

      <BottomActionBar>
        <Button
          variant="primary"
          type="submit"
          form={FORM_ID}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {isSubmitting ? t.creating : t.createBusinessTitle}
        </Button>
      </BottomActionBar>
    </AppShell>
  )
}
