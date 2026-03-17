/** Control row — label on left, control widget on right */

import React from 'react'

interface ControlRowProps {
  label: string
  children: React.ReactNode
}

export const ControlRow: React.FC<ControlRowProps> = ({ label, children }) => (
  <div className="template-control-row">
    <span className="template-control-label">{label}</span>
    {children}
  </div>
)
