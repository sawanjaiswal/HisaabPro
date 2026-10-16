import React from 'react'
import { QuantityStepper } from '@/components/ui/QuantityStepper'

interface LineItemQuantityStepperProps {
  index: number
  quantity: number
  productName: string
  disabled?: boolean
  onChange: (quantity: number) => void
}

export const LineItemQuantityStepper: React.FC<LineItemQuantityStepperProps> = ({
  quantity,
  productName,
  disabled = false,
  onChange,
}) => {
  return (
    <QuantityStepper
      value={quantity}
      onChange={onChange}
      min={0}
      step={1}
      disabled={disabled}
      size="md"
      ariaLabel={`Quantity for ${productName}`}
    />
  )
}
