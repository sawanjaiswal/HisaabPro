import React from 'react';
import { Plus, Link2, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomDrawer } from '../../components/ui/BottomDrawer';
import { BusinessAvatar } from './BusinessAvatar';
import { useBusiness } from './useBusiness';
import { formatBusinessType } from './business.utils';
import { MAX_BUSINESSES } from './business.constants';
import type { BusinessSwitcherDrawerProps } from './business.types';
import { ROUTES } from '../../config/routes';
import './business.css';

export const BusinessSwitcherDrawer: React.FC<BusinessSwitcherDrawerProps> = React.memo(
  ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const { businesses, currentBusiness, switching, handleSwitch } = useBusiness();

    const handleAddBusiness = () => {
      onClose();
      navigate(ROUTES.business.create);
    };

    const handleJoinBusiness = () => {
      onClose();
      navigate(ROUTES.joinBusiness);
    };

    const handleRowClick = async (businessId: string) => {
      await handleSwitch(businessId);
      onClose();
    };

    return (
      <BottomDrawer open={isOpen} onOpenChange={onClose}>
        <div className="business-switcher-drawer">
          {/* Header */}
          <div className="business-switcher-drawer__header">
            <h2 className="business-switcher-drawer__title">My Businesses</h2>
          </div>

          {/* Business list */}
          <ul className="business-switcher-drawer__list" role="listbox" aria-label="Select a business">
            {businesses.map((biz) => {
              const isActive = biz.id === currentBusiness?.id;
              const isSwitching = switching === biz.id;

              return (
                <li key={biz.id} role="option" aria-selected={isActive}>
                  <button
                    className={`business-switcher-row${isActive ? ' business-switcher-row--active' : ''}`}
                    onClick={() => handleRowClick(biz.id)}
                    disabled={isSwitching || isActive}
                    aria-label={`Switch to ${biz.name}`}
                    type="button"
                  >
                    <BusinessAvatar business={biz} size="md" />
                    <div className="business-switcher-row__info">
                      <span className="business-switcher-row__name">{biz.name}</span>
                      <span className="business-switcher-row__type">
                        {formatBusinessType(biz.type)}
                      </span>
                    </div>
                    <div className="business-switcher-row__status" aria-hidden="true">
                      {isSwitching ? (
                        <span className="business-switcher-row__spinner" />
                      ) : isActive ? (
                        <Check
                          className="business-switcher-row__check"
                          width={18}
                          height={18}
                        />
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Divider */}
          <div className="business-switcher-drawer__divider" aria-hidden="true" />

          {/* Action buttons */}
          <div className="business-switcher-drawer__actions">
            <button
              className="business-switcher-action business-switcher-action--outline"
              onClick={handleAddBusiness}
              disabled={businesses.length >= MAX_BUSINESSES}
              type="button"
              aria-label="Add a new business"
            >
              <Plus width={18} height={18} aria-hidden="true" />
              Add Business
            </button>
            <button
              className="business-switcher-action business-switcher-action--ghost"
              onClick={handleJoinBusiness}
              type="button"
              aria-label="Join an existing business"
            >
              <Link2 width={18} height={18} aria-hidden="true" />
              Join Business
            </button>
          </div>

          {/* Footer */}
          <p className="business-switcher-drawer__footer">
            Up to {MAX_BUSINESSES} businesses per account
          </p>
        </div>
      </BottomDrawer>
    );
  },
);

BusinessSwitcherDrawer.displayName = 'BusinessSwitcherDrawer';
