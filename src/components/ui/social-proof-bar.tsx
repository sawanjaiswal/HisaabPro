import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1];

interface Stat {
  prefix?: string;
  value: number;
  suffix: string;
  label: string;
  isStars?: boolean;
}

const STATS: Stat[] = [
  { value: 10000, suffix: "+", label: "Indian businesses" },
  { prefix: "₹", value: 50, suffix: "Cr+", label: "invoices created" },
  { value: 4.8, suffix: "", label: "Play Store rating", isStars: true },
  { value: 99.9, suffix: "%", label: "uptime guarantee" },
];

function useCountUp(target: number, active: boolean, duration = 1500) {
  const [count, setCount] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const isDecimal = !Number.isInteger(target);

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;
      setCount(isDecimal ? Math.round(current * 10) / 10 : Math.floor(current));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      else setCount(target);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, target, duration]);

  return count;
}

function StatItem({ stat, active, index }: { stat: Stat; active: boolean; index: number }) {
  const count = useCountUp(stat.value, active);
  const display = stat.value === 4.8 ? count.toFixed(1) : count.toLocaleString("en-IN");
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: EASE_OUT }}
      className="flex flex-col items-center gap-1 text-center"
    >
      <span className="text-2xl font-bold lp-heading tabular-nums flex items-center gap-1.5">
        {stat.isStars && (
          <span className="text-amber-500 text-base leading-none" aria-hidden="true">
            ★★★★★
          </span>
        )}
        {stat.prefix ?? ""}{display}{stat.suffix}
      </span>
      <span className="text-sm lp-body">{stat.label}</span>
    </motion.div>
  );
}

export function SocialProofBar() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const reducedMotion = useReducedMotion();
  const active = reducedMotion ? true : isInView;

  return (
    <div className="w-full landing-section-tinted py-0">
      <div ref={ref} className="max-w-7xl mx-auto px-6 py-8">
        {/* Desktop: horizontal row with dividers */}
        <div className="hidden md:flex items-center justify-center gap-10">
          {STATS.map((stat, i) => (
            <div key={stat.label} className="flex items-center gap-10">
              <StatItem stat={stat} active={active} index={i} />
              {i < STATS.length - 1 && (
                <div className="w-px h-8" style={{ background: 'var(--lp-divider)' }} aria-hidden="true" />
              )}
            </div>
          ))}
        </div>

        {/* Mobile: 2x2 grid, no dividers */}
        <div className="grid grid-cols-2 gap-6 md:hidden">
          {STATS.map((stat, i) => (
            <StatItem key={stat.label} stat={stat} active={active} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
