/** RecipeCostCard (V3) — one recipe: sale price, derived cost, margin, breakdown. */

import { Text } from '@/components/ui/Text'
import { AlertTriangle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import type { RecipeCost } from '../recipe-cost.types'
import { marginTone, formatMarginPct } from '../recipe-cost.utils'
import { Heading } from '@/components/ui/Heading'

const TONE_BADGE = {
  good: 'paid',
  thin: 'pending',
  loss: 'overdue',
  unknown: 'draft',
} as const

interface RecipeCostCardProps {
  recipe: RecipeCost
}

export function RecipeCostCard({ recipe }: RecipeCostCardProps) {
  const { t } = useLanguage()
  const tone = marginTone(recipe)

  return (
    <Card className="recipe-cost-card">
      <div className="recipe-cost-card__head">
        <div>
          <Heading level={2} className="recipe-cost-card__title">{recipe.productName}</Heading>
          <Text className="recipe-cost-card__subtitle">{recipe.bomName}</Text>
        </div>
        <Badge variant={TONE_BADGE[tone]}>
          {tone === 'loss' ? t.recipeLossMaking : formatMarginPct(recipe.marginPct)}
        </Badge>
      </div>

      <div className="recipe-cost-card__metrics">
        <div className="recipe-cost-metric">
          <Text className="recipe-cost-metric__label">{t.recipeSalePrice}</Text>
          <Text className="recipe-cost-metric__value tabular-nums">{formatPaise(recipe.salePricePaise)}</Text>
        </div>
        <div className="recipe-cost-metric">
          <Text className="recipe-cost-metric__label">{t.recipeDerivedCost}</Text>
          <Text className="recipe-cost-metric__value tabular-nums">{formatPaise(recipe.recipeCostPaise)}</Text>
        </div>
        <div className="recipe-cost-metric">
          <Text className="recipe-cost-metric__label">{t.recipeMargin}</Text>
          <Text className={`recipe-cost-metric__value tabular-nums recipe-cost-metric__value--${tone}`}>
            {formatPaise(recipe.marginPaise)}
          </Text>
        </div>
      </div>

      {recipe.incompleteCosting && (
        <Text className="recipe-cost-card__warning">
          <AlertTriangle size={14} aria-hidden="true" />
          {t.recipeIncompleteCosting}
        </Text>
      )}

      <ul className="recipe-cost-card__breakdown">
        {recipe.components.map((c) => (
          <li key={c.componentProductId} className="recipe-cost-row">
            <span className="recipe-cost-row__name">
              {c.componentProductName}
              {recipe.costliestComponentName === c.componentProductName && (
                <span className="recipe-cost-row__tag">{t.recipeCostliest}</span>
              )}
            </span>
            <span className="recipe-cost-row__qty tabular-nums">
              {c.quantity}{c.unitName ? ` ${c.unitName}` : ''}
            </span>
            <span className="recipe-cost-row__cost tabular-nums">
              {c.missingCost ? t.recipeNoCost : formatPaise(c.lineCostPaise)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
