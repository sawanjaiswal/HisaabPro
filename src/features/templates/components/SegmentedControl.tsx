/** Generic segmented control — radio-group-style button strip */

interface SegmentedControlProps<T extends string> {
  value: T
  options: T[]
  labels: Record<T, string>
  ariaLabel: string
  onChange: (value: T) => void
}

export function SegmentedControl<T extends string>({
  value,
  options,
  labels,
  ariaLabel,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="template-segmented-control" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`template-segmented-btn${value === opt ? ' active' : ''}`}
          aria-pressed={value === opt}
          aria-label={labels[opt]}
          onClick={() => onChange(opt)}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  )
}
