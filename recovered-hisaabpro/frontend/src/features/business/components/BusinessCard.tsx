import { useState, memo } from 'react';
import { Copy, RefreshCw, ChevronRight } from 'lucide-react';
import { getAvatarColor, getInitials } from '../../../utils/avatarColor';
import { getBusinessTypeLabel, formatBusinessCreatedAt, maskJoinCode } from '../business-management.utils';
import type { BusinessCardProps } from '../business-management.types';

export const BusinessCard = memo(function BusinessCard({
  business,
  isActive,
  onSwitch,
  onCopyCode,
  onRegenCode,
}: BusinessCardProps) {
  const [codeRevealed, setCodeRevealed] = useState(false);

  const avatarBg = getAvatarColor(business.name);
  const initials = getInitials(business.name);
  const typeLabel = getBusinessTypeLabel(business.type);
  const createdLabel = formatBusinessCreatedAt(business.createdAt);
  const displayCode = codeRevealed ? business.joinCode : maskJoinCode(business.joinCode);

  return (
    <div
      className={`biz-card${isActive ? ' biz-card--active' : ''}`}
      aria-current={isActive ? 'true' : undefined}
    >
      {/* Top row: avatar + info + switch caret */}
      <button
        className="biz-card-main"
        onClick={onSwitch}
        disabled={isActive}
        aria-label={isActive ? `${business.name} — currently active` : `Switch to ${business.name}`}
        type="button"
      >
        {/* Avatar */}
        <div
          className="biz-card-avatar"
          style={{ backgroundColor: avatarBg }}
          aria-hidden="true"
        >
          <span className="biz-card-avatar-text">{initials}</span>
        </div>

        {/* Info */}
        <div className="biz-card-info">
          <div className="biz-card-name-row">
            <span className="biz-card-name">{business.name}</span>
            {isActive && (
              <span className="biz-card-active-badge" aria-label="Active business">
                Active
              </span>
            )}
          </div>
          <span className="biz-card-meta">
            {typeLabel}
            {createdLabel && (
              <span className="biz-card-dot" aria-hidden="true"> · </span>
            )}
            {createdLabel && <span>Since {createdLabel}</span>}
          </span>
        </div>

        {!isActive && (
          <ChevronRight className="biz-card-caret" aria-hidden="true" />
        )}
      </button>

      {/* Code row */}
      <div className="biz-card-code-row">
        <span className="biz-card-code-label">Invite code:</span>

        <button
          type="button"
          className="biz-card-code-value"
          onClick={() => setCodeRevealed((v) => !v)}
          aria-label={codeRevealed ? 'Hide invite code' : 'Reveal invite code'}
        >
          <span className="biz-card-code-chars">{displayCode}</span>
        </button>

        {codeRevealed && (
          <button
            type="button"
            className="biz-card-icon-btn"
            onClick={() => onCopyCode(business.joinCode)}
            aria-label="Copy invite code"
          >
            <Copy className="biz-card-icon" />
          </button>
        )}

        <button
          type="button"
          className="biz-card-icon-btn"
          onClick={onRegenCode}
          aria-label="Regenerate invite code"
        >
          <RefreshCw className="biz-card-icon" />
        </button>
      </div>
    </div>
  );
});
