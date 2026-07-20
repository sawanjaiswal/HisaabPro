/** Reports hub — Lucide icon registry for category cards.
 *
 * Categories carry an icon *name* (serialisable) rather than a component, so
 * the mapping lives here and is shared by the grid and the favourites list.
 */

import {
  TrendingUp,
  ShoppingCart,
  Package,
  Calendar,
  Banknote,
  Receipt,
  FileText,
  BarChart3,
  Percent,
  FileCode,
  type LucideProps,
} from 'lucide-react'
import type React from 'react'

export type IconComponent = React.FC<LucideProps>

export const REPORT_ICONS: Record<string, IconComponent> = {
  TrendingUp,
  ShoppingCart,
  Package,
  Calendar,
  Banknote,
  Receipt,
  FileText,
  BarChart3,
  Percent,
  FileCode,
}

/** Icon component for a category, falling back to a neutral trend glyph. */
export function reportIcon(name: string): IconComponent {
  return REPORT_ICONS[name] ?? TrendingUp
}
