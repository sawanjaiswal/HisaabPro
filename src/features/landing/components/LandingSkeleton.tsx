/** Landing page loading skeleton — shows while lazy-loaded landing chunks load */

export function LandingSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav skeleton */}
      <header className="fixed top-0 w-full z-50 border-b border-gray-800/50 bg-black/80 backdrop-blur-md">
        <nav className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="h-6 w-28 rounded bg-gray-800 animate-pulse" />
            <div className="hidden md:flex items-center gap-8">
              <div className="h-4 w-20 rounded bg-gray-800 animate-pulse" />
              <div className="h-4 w-20 rounded bg-gray-800 animate-pulse" />
              <div className="h-4 w-20 rounded bg-gray-800 animate-pulse" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 w-20 rounded-md bg-gray-800 animate-pulse" />
              <div className="h-10 w-24 rounded-md bg-gray-700 animate-pulse" />
            </div>
          </div>
        </nav>
      </header>

      {/* Hero skeleton */}
      <section className="flex flex-col items-center justify-start px-6 pt-32 pb-20">
        {/* Badge */}
        <div className="mb-8 h-8 w-64 rounded-full bg-gray-800 animate-pulse" />

        {/* Headline */}
        <div className="mb-3 h-12 w-[480px] max-w-full rounded bg-gray-800 animate-pulse" />
        <div className="mb-6 h-12 w-[520px] max-w-full rounded bg-gray-800 animate-pulse" />

        {/* Subtext */}
        <div className="mb-2 h-4 w-[400px] max-w-full rounded bg-gray-800/60 animate-pulse" />
        <div className="mb-10 h-4 w-[360px] max-w-full rounded bg-gray-800/60 animate-pulse" />

        {/* CTA button */}
        <div className="mb-16 h-12 w-36 rounded-lg bg-gray-700 animate-pulse" />

        {/* Dashboard mockup */}
        <div className="w-full max-w-5xl aspect-video rounded-lg bg-gray-800/50 animate-pulse" />
      </section>
    </div>
  )
}
