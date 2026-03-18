import { Building2, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { BottomDrawer } from '../../components/ui/BottomDrawer';
import { EmptyTableState } from '../../components/feedback/EmptyTableState';
import { SkeletonListItem } from '../../components/feedback/SkeletonLoader';
import { BusinessCard } from './components/BusinessCard';
import { CreateBusinessForm } from './components/CreateBusinessForm';
import { useBusinessManagement } from './useBusinessManagement';
import { MAX_BUSINESSES } from './business-management.constants';
import './business-management.css';

export default function BusinessManagement() {
  const {
    businesses,
    status,
    error,
    currentBusinessId,
    showCreateForm,
    switchingId,
    regenningId,
    setShowCreateForm,
    handleSwitch,
    handleCopyCode,
    handleRegenCode,
    handleCreateSuccess,
    retry,
  } = useBusinessManagement();

  const canCreateMore = businesses.length < MAX_BUSINESSES;

  return (
    <div className="biz-mgmt-page pt-page pb-page px-page">

      {/* Page header */}
      <header className="biz-mgmt-header">
        <div className="biz-mgmt-header-left">
          <h1 className="biz-mgmt-title">My Businesses</h1>
          {status === 'success' && businesses.length > 0 && (
            <span className="biz-mgmt-count" aria-label={`${businesses.length} businesses`}>
              {businesses.length}
            </span>
          )}
        </div>
        {canCreateMore && status === 'success' && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => setShowCreateForm(true)}
            icon={<Plus className="biz-mgmt-add-icon" aria-hidden="true" />}
            aria-label="Create new business"
          >
            New
          </Button>
        )}
      </header>

      {/* ── Loading state ── */}
      {status === 'loading' && (
        <div className="biz-mgmt-list" aria-busy="true" aria-label="Loading businesses">
          <SkeletonListItem />
          <SkeletonListItem />
          <SkeletonListItem />
        </div>
      )}

      {/* ── Error state ── */}
      {status === 'error' && (
        <EmptyTableState
          icon={Building2}
          title="Could not load businesses"
          description={error ?? 'Something went wrong. Please check your connection.'}
          action={{ label: 'Try again', onClick: retry }}
        />
      )}

      {/* ── Empty state ── */}
      {status === 'success' && businesses.length === 0 && (
        <EmptyTableState
          icon={Building2}
          title="No businesses yet"
          description="Create your first business to get started. Each business has its own data and team."
          action={{ label: 'Create Business', onClick: () => setShowCreateForm(true) }}
        />
      )}

      {/* ── Success: list ── */}
      {status === 'success' && businesses.length > 0 && (
        <>
          <ul className="biz-mgmt-list" aria-label="Your businesses">
            {businesses.map((biz) => (
              <li key={biz.id}>
                <BusinessCard
                  business={biz}
                  isActive={biz.id === currentBusinessId}
                  onSwitch={() => handleSwitch(biz.id)}
                  onCopyCode={handleCopyCode}
                  onRegenCode={() => handleRegenCode(biz.id)}
                />
                {/* Switching overlay */}
                {switchingId === biz.id && (
                  <p className="biz-mgmt-switching" aria-live="polite">Switching...</p>
                )}
                {regenningId === biz.id && (
                  <p className="biz-mgmt-switching" aria-live="polite">Regenerating code...</p>
                )}
              </li>
            ))}
          </ul>

          {/* Create more CTA */}
          {canCreateMore && (
            <div className="biz-mgmt-create-more">
              <Button
                variant="outline"
                fullWidth
                icon={<Plus className="biz-mgmt-add-icon" aria-hidden="true" />}
                onClick={() => setShowCreateForm(true)}
              >
                Add Another Business
              </Button>
            </div>
          )}

          {!canCreateMore && (
            <p className="biz-mgmt-limit-msg" role="note">
              Maximum of {MAX_BUSINESSES} businesses reached.
            </p>
          )}
        </>
      )}

      {/* ── Create form drawer ── */}
      <BottomDrawer open={showCreateForm} onOpenChange={setShowCreateForm}>
        <CreateBusinessForm
          onClose={() => setShowCreateForm(false)}
          onCreated={handleCreateSuccess}
        />
      </BottomDrawer>
    </div>
  );
}
