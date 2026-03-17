/** Toggle switch row — label + optional sublabel + switch button */

import React from 'react'

export interface ToggleRowProps {
  label: string
  sublabel?: string
  checked: boolean
  disabled?: boolean
  ariaLabel: string
  onChange: (checked: boolean) => void
}

export const ToggleRow: React.FC<ToggleRowProps> = ({ label, sublabel, checked, disabled, ariaLabel, onChange }) => (
  <div className="template-toggle-row">
    <div className="template-toggle-info">
      <span className="template-control-label">{label}</span>
      {sublabel && <span className="template-control-sublabel">{sublabel}</span>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 'var(--radius-full)',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? 'var(--color-primary-600)' : 'var(--color-gray-300)',
        position: 'relative',
        flexShrink: 0,
        transition: 'background var(--duration-fast) var(--ease-default)',
        opacity: disabled ? 0.5 : 1,
        minHeight: 44,
        display: 'flex',
        alignItems: 'center',
        padding: '0 3px',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--color-gray-0)',
          transform: checked ? 'translateX(18px)' : 'translateX(0)',
          transition: 'transform var(--duration-fast) var(--ease-default)',
          boxShadow: 'var(--shadow-xs)',
        }}
      />
    </button>
  </div>
)
