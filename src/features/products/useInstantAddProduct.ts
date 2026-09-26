/** useInstantAddProduct — creates a product inline from search query and
 *  instantly adds it to invoice / form without leaving the screen.
 */

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createProduct } from './product-crud.service'
import { getUnits } from './unit.service'
import { queryKeys } from '@/lib/query-keys'

interface CreatedProductPick {
  productId: string
  name: string
  salePrice: number
  taxCategoryId: string | null
}

interface UseInstantAddProductArgs {
  /** Callback when product is created successfully */
  onCreated: (pick: CreatedProductPick) => void
  /** Callback on creation error */
  onError?: () => void
}

interface UseInstantAddProductReturn {
  isCreating: boolean
  addProduct: (rawName: string, defaultPricePaise?: number) => Promise<void>
}

export function useInstantAddProduct({
  onCreated,
  onError,
}: UseInstantAddProductArgs): UseInstantAddProductReturn {
  const [isCreating, setIsCreating] = useState(false)
  const queryClient = useQueryClient()

  const addProduct = useCallback(
    async (rawName: string, defaultPricePaise = 0) => {
      const name = rawName.trim()
      if (!name || isCreating) return
      setIsCreating(true)

      try {
        // Fetch or resolve default unit
        let unitId = ''
        try {
          const units = await getUnits()
          if (units && units.length > 0) {
            unitId = units[0].id
          }
        } catch {
          // If units fail to load, server will validate or assign default
        }

        const product = await createProduct({
          name,
          autoGenerateSku: true,
          unitId: unitId || 'default-unit',
          salePrice: Math.max(0, defaultPricePaise),
          purchasePrice: 0,
          openingStock: 0,
          minStockLevel: 0,
          stockValidation: 'GLOBAL',
          status: 'ACTIVE',
        })

        if (!product?.id) {
          onError?.()
          return
        }

        // Invalidate cached product queries across the app
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all() })

        onCreated({
          productId: product.id,
          name: product.name,
          salePrice: product.salePrice ?? 0,
          taxCategoryId: product.taxCategory?.id ?? null,
        })
      } catch {
        onError?.()
      } finally {
        setIsCreating(false)
      }
    },
    [isCreating, onCreated, onError, queryClient],
  )

  return { isCreating, addProduct }
}
