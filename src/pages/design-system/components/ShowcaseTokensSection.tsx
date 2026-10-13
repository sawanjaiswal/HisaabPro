import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'

export const ShowcaseTokensSection: React.FC = () => {
  const brandColors = [
    { name: 'Primary (Brand)', token: '--primary', hex: '#026F39', bg: 'bg-[var(--primary)]', text: 'text-white' },
    { name: 'Primary Hover', token: '--primary-hover', hex: '#024E29', bg: 'bg-[var(--primary-hover)]', text: 'text-white' },
    { name: 'Primary Subtle', token: '--primary-subtle', hex: '#D2ECDC', bg: 'bg-[var(--primary-subtle)]', text: 'text-[var(--primary)]' },
    { name: 'Accent Lime', token: '--color-secondary-300', hex: '#CFDF2E', bg: 'bg-[var(--color-secondary-300)]', text: 'text-slate-900' },
  ]

  const surfaceTokens = [
    { name: 'App Background', token: '--bg-app', hex: '#F4F7F5', bg: 'bg-[var(--bg-app)]', border: true },
    { name: 'Surface (Cards)', token: '--bg-surface', hex: '#FFFFFF', bg: 'bg-[var(--bg-surface)]', border: true },
    { name: 'Surface Subtle', token: '--bg-surface-subtle', hex: '#F8FAFC', bg: 'bg-[var(--bg-surface-subtle)]', border: true },
    { name: 'Surface Hover', token: '--bg-surface-hover', hex: '#F1F5F9', bg: 'bg-[var(--bg-surface-hover)]', border: true },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. SSOT Brand & Surface Tokens</CardTitle>
          <p className="text-xs text-[var(--text-secondary)]">Single Source of Truth defined in tokens.css with theme swapping.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-2">Brand Palette</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {brandColors.map((c) => (
                <div key={c.name} className="rounded-xl border border-[var(--border-default)] overflow-hidden bg-[var(--bg-surface)]">
                  <div className={`h-16 ${c.bg} flex items-end p-2`}>
                    <span className={`text-[10px] font-bold ${c.text}`}>{c.hex}</span>
                  </div>
                  <div className="p-2.5">
                    <div className="text-xs font-bold text-[var(--text-primary)]">{c.name}</div>
                    <code className="text-[10px] text-[var(--text-muted)] font-mono">{c.token}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block mb-2">Surface Hierarchy</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {surfaceTokens.map((s) => (
                <div key={s.name} className="rounded-xl border border-[var(--border-default)] overflow-hidden bg-[var(--bg-surface)]">
                  <div className={`h-16 ${s.bg} flex items-end p-2 border-b border-[var(--border-subtle)]`}>
                    <span className="text-[10px] font-bold text-[var(--text-secondary)]">{s.hex}</span>
                  </div>
                  <div className="p-2.5">
                    <div className="text-xs font-bold text-[var(--text-primary)]">{s.name}</div>
                    <code className="text-[10px] text-[var(--text-muted)] font-mono">{s.token}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
