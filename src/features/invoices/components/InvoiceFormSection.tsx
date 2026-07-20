/** Create/Edit Invoice — a labelled form section (mockup #2).
 *
 * "Customer", "Items", "Details" … each get a small caption and an optional
 * right-aligned action (e.g. "+ Add Item"). A feature-level composition, not a
 * primitive: `<Card>` has no header/action slot and `<Accordion>` is
 * collapsible, which is wrong for an always-visible section.
 */

import React from 'react'

interface InvoiceFormSectionProps {
  title: string
  /** Right-aligned action rendered beside the title — e.g. an "+ Add Item" button. */
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export const InvoiceFormSection: React.FC<InvoiceFormSectionProps> = ({
  title,
  action,
  children,
  className,
}) => (
  <section className={`invoice-form-section py-0${className ? ` ${className}` : ''}`}>
    <div className="invoice-form-section-head">
      <h2 className="invoice-form-section-title">{title}</h2>
      {action}
    </div>
    <div className="invoice-form-section-body">{children}</div>
  </section>
)
