import { Check } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/hooks/useLanguage'
import { THEME_VARIANT_OPTIONS } from './theme-variant.constants'
import './theme.css'
import { Button } from '@/components/ui/Button'

export function ThemeVariantPicker() {
  const { variant, setVariant } = useTheme()
  const { t } = useLanguage()

  return (
    <div className="theme-variant-list" role="radiogroup" aria-label={t.themeColourTheme}>
      {THEME_VARIANT_OPTIONS.map((opt) => {
        const selected = variant === opt.id
        return (
          <Button variant="none"
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setVariant(opt.id)}
            className={`theme-variant-card${selected ? ' theme-variant-card--selected' : ''}`}
          >
            <span className="theme-variant-swatch" aria-hidden="true">
              {opt.swatch.map((hex, i) => (
                <span
                  key={i}
                  className="theme-variant-chip"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </span>
            <span className="theme-variant-text">
              <span className="theme-variant-label">{t[opt.labelKey]}</span>
              <span className="theme-variant-desc">{t[opt.descKey]}</span>
            </span>
            <span className="theme-variant-check" aria-hidden="true">
              {selected && <Check size={18} strokeWidth={2.4} />}
            </span>
          </Button>
        )
      })}
    </div>
  )
}
