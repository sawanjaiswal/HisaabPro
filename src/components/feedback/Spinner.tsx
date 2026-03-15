interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  fullScreen?: boolean
}

const SIZES = { sm: 16, md: 24, lg: 40 } as const

export function Spinner({ size = 'md', fullScreen }: SpinnerProps) {
  const px = SIZES[size]

  const spinner = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      className="spinner"
      aria-label="Loading"
      role="status"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )

  if (fullScreen) {
    return <div className="spinner-fullscreen">{spinner}</div>
  }

  return spinner
}
