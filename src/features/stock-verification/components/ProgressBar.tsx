interface ProgressBarProps {
  percentage: number
  label: string
}

export function ProgressBar({ percentage, label }: ProgressBarProps) {
  const clampedPercent = Math.min(100, Math.max(0, percentage))

  return (
    <div className="sv-progress">
      <div className="sv-progress__bar" role="progressbar" aria-valuenow={clampedPercent} aria-valuemin={0} aria-valuemax={100}>
        <div className="sv-progress__fill" style={{ width: `${clampedPercent}%` }} />
      </div>
      <span className="sv-progress__label">{label}</span>
    </div>
  )
}
