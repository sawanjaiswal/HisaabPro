/** Template Grid — Browse greeting templates */

import { OCCASION_LABELS } from '../smart-greetings.constants'
import type { GreetingTemplate, GreetingOccasion } from '../smart-greetings.types'

interface TemplateGridProps {
  templates: GreetingTemplate[]
  occasions: Array<{ id: GreetingOccasion; label: string }>
  filterOccasion: GreetingOccasion | null
  onFilterChange: (occasion: GreetingOccasion | null) => void
  onSelect: (template: GreetingTemplate) => void
}

export function TemplateGrid({ templates, occasions, filterOccasion, onFilterChange, onSelect }: TemplateGridProps) {
  return (
    <div className="greeting-templates">
      {/* Occasion filter chips */}
      <div className="greeting-filter-chips">
        <button
          type="button"
          className={`greeting-chip${filterOccasion === null ? ' active' : ''}`}
          onClick={() => onFilterChange(null)}
        >
          All
        </button>
        {occasions.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`greeting-chip${filterOccasion === o.id ? ' active' : ''}`}
            onClick={() => onFilterChange(filterOccasion === o.id ? null : o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Template cards */}
      <div className="greeting-grid" role="list" aria-label="Greeting templates">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            className="greeting-card"
            style={{ background: t.gradient }}
            onClick={() => onSelect(t)}
            role="listitem"
            aria-label={`${t.name} template`}
          >
            <span className="greeting-card-emoji" aria-hidden="true">{t.emoji}</span>
            <span className="greeting-card-name">{t.name}</span>
            <span className="greeting-card-occasion">{OCCASION_LABELS[t.occasion]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
