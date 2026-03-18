/** Invoice preview — copy label (ORIGINAL / DUPLICATE / TRIPLICATE) */

import React from 'react'

interface PreviewCopyLabelProps {
  label: string
}

export const PreviewCopyLabel: React.FC<PreviewCopyLabelProps> = ({ label }) => (
  <div className="preview-copy-label" aria-hidden="true">
    {label}
  </div>
)
