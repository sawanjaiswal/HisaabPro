interface SkeletonProps {
  width?: string
  height?: string
  borderRadius?: string
  count?: number
}

export function Skeleton({
  width = '100%',
  height = '1rem',
  borderRadius = 'var(--radius-sm)',
  count = 1,
}: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={`skeleton-${i}-${width}-${height}`}
          className="skeleton"
          style={{ width, height, borderRadius }}
          aria-hidden="true"
        />
      ))}
    </>
  )
}
