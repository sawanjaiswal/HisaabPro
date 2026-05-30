import { useAuth } from '@/context/AuthContext'
import { Header } from '@/components/layout/Header'
import { Select, SelectItem } from '@/components/ui/Select'
import { ROUTES } from '@/config/routes.config'
import { BUSINESS_TYPE_OPTIONS, BUSINESS_NAME_MAX } from './business.constants'
import { useCreateBusiness } from './useCreateBusiness'
import './create-business.css'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function CreateBusinessPage() {
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
    <div className="create-biz-page space-y-6">
      <Header title="Create Business" backTo={ROUTES.SETTINGS} />

      <div className="create-biz-content">
        <div className="create-biz-form stagger-enter">

          {/* Business name */}
          <div className="create-biz-field">
            <label htmlFor="biz-name" className="create-biz-label">
              Business Name <span aria-hidden="true">*</span>
            </label>
            <Input
              id="biz-name"
              type="text"
              className={`create-biz-input${errors.name ? ' create-biz-input--error' : ''}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sharma General Store"
              maxLength={BUSINESS_NAME_MAX}
              autoFocus
              autoComplete="organization"
            />
            {errors.name && (
              <p className="create-biz-field-error" role="alert">{errors.name}</p>
            )}
          </div>

          {/* Business type */}
          <div className="create-biz-field">
            <label htmlFor="biz-type" className="create-biz-label">
              Business Type
            </label>
            <Select
              value={businessType}
              onValueChange={setBusinessType}
              ariaLabel="Business Type"
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
                  <p className="create-biz-clone-toggle-label">Clone settings from existing business</p>
                  <p className="create-biz-clone-toggle-hint">Copies roles, products, categories and settings</p>
                </div>
                <Button variant="none"
                  type="button"
                  role="switch"
                  aria-checked={cloneEnabled}
                  className={`create-biz-toggle${cloneEnabled ? ' create-biz-toggle--on' : ''}`}
                  onClick={() => setCloneEnabled(!cloneEnabled)}
                >
                  <span className="create-biz-toggle-thumb" />
                </Button>
              </div>

              {cloneEnabled && (
                <div className="create-biz-clone-picker">
                  <label htmlFor="clone-from" className="create-biz-label">
                    Clone from
                  </label>
                  <Select
                    value={cloneFromBusinessId || undefined}
                    onValueChange={setCloneFromBusinessId}
                    ariaLabel="Clone from"
                    placeholder="Select a business"
                  >
                    {businesses.map((biz) => (
                      <SelectItem key={biz.id} value={biz.id}>{biz.name}</SelectItem>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          )}

          <Button variant="none"
            type="button"
            className="create-biz-submit"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Creating...' : 'Create Business'}
          </Button>
        </div>
      </div>
    </div>
  )
}
