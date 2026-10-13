import React, { useState } from 'react'
import {
  Plus,
  Send,
  Trash2,
  Download,
  Share2,
  Printer,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Check,
  Search,
  Filter,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export const ShowcaseButtonsSection: React.FC = () => {
  const [loading, setLoading] = useState(false)

  const triggerLoading = () => {
    setLoading(true)
    setTimeout(() => setLoading(false), 1500)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buttons & Actions: Full Variant & Size Suite (`Button`)</CardTitle>
        <p className="text-xs text-[var(--text-secondary)]">
          Zero-patch cva variants, touch targets (≥40px / ≥44px), icon buttons, loading spinners, and states.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Row 1: Variants */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-3">
            1. Core Variants
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" leftIcon={<Plus size={16} />}>
              Primary (#026F39)
            </Button>
            <Button variant="secondary" leftIcon={<Share2 size={16} />}>
              Secondary
            </Button>
            <Button variant="outline" leftIcon={<Printer size={16} />}>
              Outline
            </Button>
            <Button variant="accent" leftIcon={<Sparkles size={16} />}>
              Accent Lime
            </Button>
            <Button variant="destructive" leftIcon={<Trash2 size={16} />}>
              Destructive
            </Button>
            <Button variant="outline-destructive">
              Outline Destructive
            </Button>
            <Button variant="ghost">
              Ghost Button
            </Button>
            <Button variant="dark">
              Dark Button
            </Button>
          </div>
        </div>

        {/* Row 2: Sizes */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-3">
            2. Responsive Touch Target Sizes
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" variant="primary" rightIcon={<ArrowRight size={16} />}>
              Large (44px min)
            </Button>
            <Button size="md" variant="primary">
              Default / Medium (40px)
            </Button>
            <Button size="sm" variant="secondary">
              Small (32px)
            </Button>
          </div>
        </div>

        {/* Row 3: Icon Buttons & States */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-3">
            3. Icon Buttons (`size="icon"` & `size="icon-sm"`)
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Button size="icon" variant="primary" aria-label="Add item">
                <Plus size={18} />
              </Button>
              <Button size="icon" variant="secondary" aria-label="Search">
                <Search size={18} />
              </Button>
              <Button size="icon" variant="outline" aria-label="Filter">
                <Filter size={18} />
              </Button>
              <Button size="icon" variant="accent" aria-label="AI Actions">
                <Sparkles size={18} />
              </Button>
              <Button size="icon" variant="destructive" aria-label="Delete">
                <Trash2 size={18} />
              </Button>
            </div>

            <div className="h-6 w-px bg-[var(--border-default)]" />

            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)] mr-1">Small (32px):</span>
              <Button size="icon-sm" variant="secondary" aria-label="Share">
                <Share2 size={14} />
              </Button>
              <Button size="icon-sm" variant="outline" aria-label="Download">
                <Download size={14} />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Next">
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </div>

        {/* Row 4: Loading & Disabled States */}
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-3">
            4. Interactive Loading & Disabled States
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              isLoading={loading}
              onClick={triggerLoading}
              leftIcon={<Send size={16} />}
            >
              {loading ? 'Sending Invoice...' : 'Click To Test Loading'}
            </Button>
            <Button variant="secondary" disabled leftIcon={<Check size={16} />}>
              Disabled Secondary
            </Button>
            <Button variant="outline" disabled>
              Disabled Outline
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
