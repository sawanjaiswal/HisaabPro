import { useAuth } from '@/context/AuthContext'
import { Header } from '@/components/layout/Header'
import { ROUTES } from '@/config/routes.config'
import { BUSINESS_TYPE_OPTIONS, BUSINESS_NAME_MAX } from './business.constants'
import { useCreateBusiness } from './useCreateBusiness'
import './create-business.css'

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
    <div className="create-biz-page">
      <Header title="Create Business" backTo={ROUTES.SETTINGS} />

      <div className="create-biz-content">
        <div className="create-biz-form">

          {/* Business name */}
          <div className="create-biz-field">
            <label htmlFor="biz-name" className="create-biz-label">
              Business Name <span aria-hidden="true">*</span>
            </label>
            <input
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
            <select
              id="biz-type"
              className="create-biz-select"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
            >
              {BUSINESS_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Clone section — only when user has 2+ businesses */}
          {hasMultipleBusinesses && (
            <div className="create-biz-clone-section">
              <div className="create-biz-clone-toggle-row">
                <div className="create-biz-clone-toggle-info">
                  <p className="create-biz-clone-toggle-label">Clone settings from existing business</p>
                  <p className="create-biz-clone-toggle-hint">Copies roles, products, categories and settings</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={cloneEnabled}
                  className={`create-biz-toggle${cloneEnabled ? ' create-biz-toggle--on' : ''}`}
                  onClick={() => setCloneEnabled(!cloneEnabled)}
                >
                  <span className="create-biz-toggle-thumb" />
                </button>
              </div>

              {cloneEnabled && (
                <div className="create-biz-clone-picker">
                  <label htmlFor="clone-from" className="create-biz-label">
                    Clone from
                  </label>
                  <select
                    id="clone-from"
                    className="create-biz-select"
                    value={cloneFromBusinessId}
                    onChange={(e) => setCloneFromBusinessId(e.target.value)}
                  >
                    <option value="">Select a business</option>
                    {businesses.map((biz) => (
                      <option key={biz.id} value={biz.id}>{biz.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            className="create-biz-submit"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? 'Creating...' : 'Create Business'}
          </button>
        </div>
      </div>
    </div>
  )
}
