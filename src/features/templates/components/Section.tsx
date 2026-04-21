/** Control panel section — titled group of controls */

import React from 'react'

interface SectionProps {
  title: string
  children: React.ReactNode
}

export const Section: React.FC<SectionProps> = ({ title, children }) => (
  <div className="template-control-section py-0">
    <div className="template-control-section-title py-0">{title}</div>
    {children}
  </div>
)
