import React from 'react';
import { Building2 } from 'lucide-react';
import type { BusinessAvatarProps } from './business.types';
import { getBusinessInitial, getBusinessColor } from './business.utils';
import './business.css';

const SIZE_PX: Record<NonNullable<BusinessAvatarProps['size']>, number> = {
  sm: 32,
  md: 40,
  lg: 56,
};

const FONT_REM: Record<NonNullable<BusinessAvatarProps['size']>, string> = {
  sm: '0.875rem',
  md: '1rem',
  lg: '1.375rem',
};

const ICON_SIZE: Record<NonNullable<BusinessAvatarProps['size']>, number> = {
  sm: 16,
  md: 20,
  lg: 28,
};

export const BusinessAvatar: React.FC<BusinessAvatarProps> = React.memo(
  ({ business, size = 'md', onClick }) => {
    const resolvedSize = SIZE_PX[size];
    const color = business ? getBusinessColor(business.id) : { bg: 'var(--bg-tertiary)', text: 'var(--text-secondary)' };

    const avatarStyle: React.CSSProperties = {
      width: resolvedSize,
      height: resolvedSize,
      backgroundColor: color.bg,
      color: color.text,
      fontSize: FONT_REM[size],
      flexShrink: 0,
    };

    const content = business ? (
      <span className="business-avatar__initial" aria-hidden="true">
        {getBusinessInitial(business.name)}
      </span>
    ) : (
      <Building2 width={ICON_SIZE[size]} height={ICON_SIZE[size]} aria-hidden="true" />
    );

    const label = business ? `Switch business: ${business.name}` : 'No business selected';

    if (onClick) {
      return (
        <button
          className={`business-avatar business-avatar--${size} business-avatar--btn`}
          style={avatarStyle}
          onClick={onClick}
          aria-label={label}
          type="button"
        >
          {content}
        </button>
      );
    }

    return (
      <div
        className={`business-avatar business-avatar--${size}`}
        style={avatarStyle}
        aria-label={label}
        role="img"
      >
        {content}
      </div>
    );
  },
);

BusinessAvatar.displayName = 'BusinessAvatar';
