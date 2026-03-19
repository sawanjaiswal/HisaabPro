import React from "react"
import { cn } from "@/lib/utils"
import { motion } from "motion/react"

export function FeaturesSectionWithBentoGrid() {
  const features = [
    {
      title: "Smart Invoicing",
      description:
        "7 document types: Sale, Purchase, Estimate, Proforma, Challan, Credit Note, Debit Note. Auto-numbered, WhatsApp-ready.",
      skeleton: <SkeletonOne />,
      className:
        "col-span-1 md:col-span-4 lg:col-span-4 border-b md:border-r",
    },
    {
      title: "Payment Tracking",
      description:
        "See who owes you at a glance. Send WhatsApp reminders in one tap.",
      skeleton: <SkeletonTwo />,
      className:
        "col-span-1 md:col-span-2 lg:col-span-2 border-b",
    },
    {
      title: "Inventory Management",
      description:
        "Real-time stock tracking with low stock alerts and party-wise pricing.",
      skeleton: <SkeletonThree />,
      className:
        "col-span-1 md:col-span-3 lg:col-span-3 border-b md:border-r",
    },
    {
      title: "Reports & Insights",
      description:
        "Sales reports, stock summary, party statements. Download PDF or share with your CA.",
      skeleton: <SkeletonFour />,
      className:
        "col-span-1 md:col-span-3 lg:col-span-3 border-b md:border-none",
    },
  ]
  return (
    <div className="relative z-20 py-10 lg:py-40 max-w-7xl mx-auto">
      <div className="px-8">
        <h4 className="text-3xl lg:text-5xl lg:leading-tight max-w-5xl mx-auto text-center tracking-tight font-medium">
          One app, complete business control
        </h4>

        <p className="text-sm lg:text-base max-w-2xl my-4 mx-auto text-center font-normal lp-text-body">
          Invoicing, inventory, payments, reports — all connected, all offline.
        </p>
      </div>

      <div className="relative">
        <div
          className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-6 mt-12 xl:border rounded-md"
          style={{ borderColor: 'var(--lp-card-border)' }}
        >
          {features.map((feature) => (
            <FeatureCard key={feature.title} className={feature.className}>
              <FeatureTitle>{feature.title}</FeatureTitle>
              <FeatureDescription>{feature.description}</FeatureDescription>
              <div className="h-full w-full">{feature.skeleton}</div>
            </FeatureCard>
          ))}
        </div>
      </div>
    </div>
  )
}

const FeatureCard = ({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) => {
  return (
    <div
      className={cn(`p-4 sm:p-8 relative overflow-hidden`, className)}
      style={{ borderColor: 'var(--lp-card-border)' }}
    >
      {children}
    </div>
  )
}

const FeatureTitle = ({ children }: { children?: React.ReactNode }) => {
  return (
    <p className="max-w-5xl mx-auto text-left tracking-tight text-xl md:text-2xl md:leading-snug lp-text">
      {children}
    </p>
  )
}

const FeatureDescription = ({ children }: { children?: React.ReactNode }) => {
  return (
    <p
      className={cn(
        "text-sm md:text-base max-w-4xl text-left mx-auto",
        "text-center font-normal lp-text-muted",
        "text-left max-w-sm mx-0 md:text-sm my-2"
      )}
    >
      {children}
    </p>
  )
}

export const SkeletonOne = () => {
  return (
    <div className="relative flex py-8 px-2 gap-10 h-full">
      <div className="w-full p-5 mx-auto shadow-2xl group h-full lp-bg-card">
        <div className="flex flex-1 w-full h-full flex-col space-y-2">
          <img
            src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=1200&h=800"
            alt="Business invoicing dashboard"
            width={800}
            height={800}
            className="h-full w-full aspect-square object-cover object-left-top rounded-sm"
          />
        </div>
      </div>

      <div className="absolute bottom-0 z-40 inset-x-0 h-60 w-full pointer-events-none" style={{ background: `linear-gradient(to top, var(--lp-bg-fade), var(--lp-bg-fade), transparent)` }} />
      <div className="absolute top-0 z-40 inset-x-0 h-60 w-full pointer-events-none" style={{ background: `linear-gradient(to bottom, var(--lp-bg-fade), transparent)` }} />
    </div>
  )
}

export const SkeletonThree = () => {
  return (
    <div className="relative flex gap-10 h-full">
      <div className="w-full mx-auto bg-transparent group h-full">
        <div className="flex flex-1 w-full h-full flex-col space-y-2 relative">
          <img
            src="https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&q=80&w=800&h=800"
            alt="Inventory management — store shelves"
            width={800}
            height={800}
            className="h-full w-full aspect-square object-cover object-center rounded-sm"
          />
        </div>
      </div>
    </div>
  )
}

export const SkeletonTwo = () => {
  const images = [
    "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=500&h=500",
    "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=500&h=500",
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=500&h=500",
    "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&q=80&w=500&h=500",
    "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&q=80&w=500&h=500",
  ]

  const imageVariants = {
    whileHover: { scale: 1.1, rotate: 0, zIndex: 100 },
    whileTap: { scale: 1.1, rotate: 0, zIndex: 100 },
  }
  return (
    <div className="relative flex flex-col items-start p-8 gap-10 h-full overflow-hidden">
      <div className="flex flex-row -ml-20">
        {images.map((image, idx) => (
          <motion.div
            variants={imageVariants}
            key={"images-first" + idx}
            style={{ rotate: Math.random() * 20 - 10 }}
            whileHover="whileHover"
            whileTap="whileTap"
            className="rounded-xl -mr-4 mt-4 p-1 border flex-shrink-0 overflow-hidden lp-bg-card"
            {...{ style: { rotate: `${Math.random() * 20 - 10}deg`, borderColor: 'var(--lp-card-img-border)' } } as any}
          >
            <img
              src={image}
              alt="Payment tracking"
              width={500}
              height={500}
              className="rounded-lg h-20 w-20 md:h-40 md:w-40 object-cover flex-shrink-0"
            />
          </motion.div>
        ))}
      </div>
      <div className="flex flex-row">
        {images.map((image, idx) => (
          <motion.div
            key={"images-second" + idx}
            style={{ rotate: Math.random() * 20 - 10, borderColor: 'var(--lp-card-img-border)' }}
            variants={imageVariants}
            whileHover="whileHover"
            whileTap="whileTap"
            className="rounded-xl -mr-4 mt-4 p-1 border flex-shrink-0 overflow-hidden lp-bg-card"
          >
            <img
              src={image}
              alt="Payment tracking"
              width={500}
              height={500}
              className="rounded-lg h-20 w-20 md:h-40 md:w-40 object-cover flex-shrink-0"
            />
          </motion.div>
        ))}
      </div>

      <div className="absolute left-0 z-[100] inset-y-0 w-20 h-full pointer-events-none" style={{ background: `linear-gradient(to right, var(--lp-bg-fade), transparent)` }} />
      <div className="absolute right-0 z-[100] inset-y-0 w-20 h-full pointer-events-none" style={{ background: `linear-gradient(to left, var(--lp-bg-fade), transparent)` }} />
    </div>
  )
}

export const SkeletonFour = () => {
  return (
    <div className="h-60 md:h-60 flex flex-col items-center relative bg-transparent mt-10 overflow-hidden rounded-lg">
      <img
        src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800&h=500"
        alt="Business reports and analytics"
        className="w-full h-full object-cover object-top"
      />
    </div>
  )
}
