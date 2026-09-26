/** Testimonials — marquee scroll of social proof cards */

import { Text } from '@/components/ui/Text'
import { TESTIMONIALS } from '../landing.constants.below'
import { formatInitials } from '@/lib/format'
import { Heading } from '@/components/ui/Heading'

const AVATAR_COLORS = ['#0d9488', '#0891b2', '#7c3aed', 'var(--color-error-600)', '#d97706', '#2563eb'] as const


const row1 = TESTIMONIALS.slice(0, 3)
const row2 = TESTIMONIALS.slice(3)

function TestimonialCard({ t, i }: { t: (typeof TESTIMONIALS)[number]; i: number }) {
  return (
    <div className="w-[320px] shrink-0 rounded-xl border border-gray-800 bg-gray-900 p-5">
      <Text className="text-sm leading-relaxed text-gray-300">
        &ldquo;{t.quote}&rdquo;
      </Text>
      <div className="mt-4 flex items-center gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
        >
          {formatInitials(t.name)}
        </div>
        <div>
          <Text className="text-sm font-semibold text-white">{t.name}</Text>
          <Text className="text-xs text-gray-500">{t.role} &middot; {t.location}</Text>
        </div>
      </div>
    </div>
  )
}

function MarqueeRow({
  items,
  direction,
}: {
  items: readonly (typeof TESTIMONIALS)[number][]
  direction: 'left' | 'right'
}) {
  const anim = direction === 'left' ? 'scroll-left 40s linear infinite' : 'scroll-right 40s linear infinite'
  return (
    <div className="group flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div className="flex gap-4 hover:[animation-play-state:paused]" style={{ animation: anim }}>
        {[...items, ...items].map((t, i) => (
          <TestimonialCard key={`${t.id}-${i}`} t={t} i={i} />
        ))}
      </div>
    </div>
  )
}

export function LandingTestimonials() {
  return (
    <section className="px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Heading level={2}
          className="mb-12 text-center text-3xl font-medium sm:text-4xl"
          style={{
            background: 'linear-gradient(to bottom, #fff, rgba(255,255,255,0.6))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Trusted by businesses across India
        </Heading>
        <div className="flex flex-col gap-4">
          <MarqueeRow items={row1} direction="left" />
          <MarqueeRow items={row2} direction="right" />
        </div>
      </div>
    </section>
  )
}
