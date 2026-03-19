import { cn } from "@/lib/utils";
import { Download, Settings, FileText, TrendingUp } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1];

export function FeaturesSectionWithHoverEffects() {
  const reducedMotion = useReducedMotion();
  const features = [
    {
      title: "1. Download",
      description:
        "Get HisaabPro from Play Store or App Store. 30 seconds to install, 14 days free — no credit card.",
      icon: <Download />,
    },
    {
      title: "2. Setup",
      description:
        "Add your business name, logo, and first customer. You're ready to bill in under 2 minutes.",
      icon: <Settings />,
    },
    {
      title: "3. Start Billing",
      description:
        "Create your first invoice and share it on WhatsApp. Professional PDF delivered in 2 taps.",
      icon: <FileText />,
    },
    {
      title: "4. Grow",
      description:
        "Add staff, track payments, generate reports. Your entire business — organized, offline, always in your pocket.",
      icon: <TrendingUp />,
    },
  ];
  return (
    <section className="py-16 md:py-24">
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className="text-center mb-12 px-6"
      >
        <h2 className="text-4xl font-semibold lg:text-5xl">How it works</h2>
        <p className="mt-4 text-lg lp-text-muted">Download to first invoice in under 5 minutes. Seriously.</p>
      </motion.div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 relative z-10 max-w-7xl mx-auto">
        {features.map((feature, index) => (
          <Feature key={feature.title} {...feature} index={index} reducedMotion={reducedMotion} />
        ))}
      </div>
    </section>
  );
}

const Feature = ({
  title,
  description,
  icon,
  index,
  reducedMotion,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
  reducedMotion: boolean | null;
}) => {
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 25 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: EASE_OUT }}
      className={cn(
        "flex flex-col lg:border-r py-10 relative group/feature",
        index === 0 && "lg:border-l"
      )}
      style={{ borderColor: 'var(--lp-card-border)' }}
    >
      <div
        className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full pointer-events-none"
        style={{ background: `linear-gradient(to top, var(--lp-hover-from), transparent)` }}
      />
      <div className="mb-4 relative z-10 px-10" style={{ color: 'var(--lp-icon)' }}>
        {icon}
      </div>
      <div className="text-lg font-bold mb-2 relative z-10 px-10">
        <div
          className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full transition-all duration-200 origin-center"
          style={{
            backgroundColor: 'var(--lp-hover-bar)',
          }}
          /* The active color is applied via group-hover below */
        />
        {/* Separate hover-activated bar overlay */}
        <div
          className="absolute left-0 inset-y-0 h-6 group-hover/feature:h-8 w-1 rounded-tr-full rounded-br-full opacity-0 group-hover/feature:opacity-100 transition-all duration-200 origin-center"
          style={{ backgroundColor: 'var(--lp-hover-bar-active)' }}
        />
        <span className="group-hover/feature:translate-x-2 transition duration-200 inline-block lp-text-brand">
          {title}
        </span>
      </div>
      <p className="text-sm max-w-xs relative z-10 px-10 lp-text-body">
        {description}
      </p>
    </motion.div>
  );
};
