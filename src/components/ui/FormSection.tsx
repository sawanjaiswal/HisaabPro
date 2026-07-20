/** FormSection — a labelled block inside a single-scroll form.
 *
 * The GPT redesign replaces pill-tab form navigation with one continuous
 * scroll of labelled sections (mockups #2, #6, #7). Each section gets a small
 * caption and an optional right-aligned action (e.g. "+ Add Item").
 *
 * Shared primitive: `<Card>` has no header/action slot and `<Accordion>` is
 * collapsible, which is wrong for an always-visible section.
 */

import React from 'react'
import './form-section.css'

interface FormSectionProps {
  title: string
  /** Right-aligned action rendered beside the title. */
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  action,
  children,
  className,
}) => (
  <section className={`form-section py-0${className ? ` ${className}` : ''}`}>
    <div className="form-section-head">
      <h2 className="form-section-title">{title}</h2>
      {action}
    </div>
    <div className="form-section-body">{children}</div>
  </section>
)
