import { cn } from "@/lib/utils";
import { Download, Settings, FileText, TrendingUp } from "lucide-react";

export function FeaturesSectionWithHoverEffects() {
  const features = [
    {
      title: "1. Download",
      description:
        "Get HisaabPro from Play Store or App Store. Takes 30 seconds. 14-day free trial — no credit card needed.",
      icon: <Download />,
    },
    {
      title: "2. Setup",
      description:
        "Add your business name, logo, and first customer. Everything ready in under 2 minutes.",
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
        "Add staff, track payments, run reports. Your entire business — organized, offline, always available.",
      icon: <TrendingUp />,
    },
  ];
  return (
    <section className="py-16 md:py-24">
      <div className="text-center mb-12 px-6">
        <h2 className="text-4xl font-semibold lg:text-5xl">How it works</h2>
        <p className="mt-4 text-lg lp-text-muted">From download to your first invoice in under 5 minutes.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 relative z-10 max-w-7xl mx-auto">
        {features.map((feature, index) => (
          <Feature key={feature.title} {...feature} index={index} />
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
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
}) => {
  return (
    <div
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
    </div>
  );
};
