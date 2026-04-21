import { cn } from "@/lib/utils"
import {
  TestimonialCard,
  type TestimonialAuthor,
} from "@/components/ui/testimonial-card"

interface TestimonialsSectionProps {
  title?: string
  description?: string
  testimonials?: Array<{
    author: TestimonialAuthor
    text: string
    href?: string
  }>
  className?: string
}

const defaultTestimonials: TestimonialsSectionProps["testimonials"] = [
  {
    author: { name: "Alex Rivera", handle: "@alexr", avatar: "https://i.pravatar.cc/150?img=1" },
    text: "This product has completely transformed how I manage my projects. The interface is intuitive and the features are exactly what I needed.",
  },
  {
    author: { name: "Sarah Chen", handle: "@sarahc", avatar: "https://i.pravatar.cc/150?img=5" },
    text: "I've tried dozens of similar tools, but nothing comes close. The attention to detail is remarkable.",
  },
  {
    author: { name: "Marcus Johnson", handle: "@marcusj", avatar: "https://i.pravatar.cc/150?img=3" },
    text: "The customer support alone makes this worth it. They went above and beyond to help me set everything up.",
  },
  {
    author: { name: "Emily Zhang", handle: "@emilyz", avatar: "https://i.pravatar.cc/150?img=9" },
    text: "Finally, a tool that actually delivers on its promises. My team's productivity has increased significantly.",
  },
  {
    author: { name: "David Kim", handle: "@davidk", avatar: "https://i.pravatar.cc/150?img=7" },
    text: "Beautiful design and powerful features. It's rare to find both in one package.",
  },
]

export function TestimonialsSection({
  title = "Loved by thousands",
  description = "See what our customers have to say about their experience.",
  testimonials = defaultTestimonials,
  className,
}: TestimonialsSectionProps) {
  return (
    <section
      className={cn(
        "bg-background text-foreground",
        "py-12 sm:py-24 md:py-32 px-0",
        className
      )}
    >
      <div className="mx-auto flex max-w-container flex-col items-center gap-4 text-center sm:gap-16 space-y-6">
        <div className="flex flex-col items-center gap-4 px-4 sm:gap-8">
          <h2 className="max-w-[720px] text-3xl font-semibold leading-tight sm:text-5xl sm:leading-tight">
            {title}
          </h2>
          <p className="text-md max-w-[600px] font-medium text-muted-foreground sm:text-xl">
            {description}
          </p>
        </div>

        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
          <div className="group flex overflow-hidden p-2 [--gap:1rem] [gap:var(--gap)] flex-row [--duration:40s]">
            <div className="flex shrink-0 justify-around [gap:var(--gap)] animate-marquee flex-row group-hover:[animation-play-state:paused]">
              {[...Array(4)].map((_, setIndex) =>
                testimonials?.map((testimonial, i) => (
                  <TestimonialCard
                    key={`${setIndex}-${i}`}
                    {...testimonial}
                  />
                ))
              )}
            </div>
          </div>

          <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-1/3 bg-gradient-to-r from-background sm:block" />
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-background sm:block" />
        </div>
      </div>
    </section>
  )
}
