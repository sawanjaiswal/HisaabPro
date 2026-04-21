import React from "react";
import { Sun, Moon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { LP_SECTIONS, LP_APP, hash } from "@/config/landing-links.config";
import { APP_NAME } from "@/config/app.config";
import { HeroDashboardMockup } from "@/components/ui/hero-dashboard-mockup";
import { HeroPhoneMockup } from "@/components/ui/hero-phone-mockup";
import { ScaledMockup } from "@/components/ui/scaled-mockup";

interface ThemeProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

// Inline Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "ghost" | "gradient";
  size?: "default" | "sm" | "lg";
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "default", className = "", children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer";

    const sizes = {
      default: "h-10 px-4 py-2 text-sm",
      sm: "h-10 px-5 text-sm",
      lg: "h-12 px-8 text-base"
    };

    // Token-driven variant classes (no Tailwind dark: needed)
    const variantClass = variant === "ghost" ? "lp-btn-ghost" : "lp-cta";
    const scaleClass = variant === "gradient" ? "hover:scale-105 active:scale-95" : "";

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${sizes[size]} ${variantClass} ${scaleClass} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

// Icons
const ArrowRight = ({ className = "", size = 16 }: { className?: string; size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const MenuIcon = ({ className = "", size = 24 }: { className?: string; size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </svg>
);

const XIcon = ({ className = "", size = 24 }: { className?: string; size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

// Navigation Component
const Navigation = React.memo(({ isDark, onToggleTheme }: ThemeProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className="fixed top-0 w-full z-50 border-b lp-nav transition-all duration-300"
      style={{
        backdropFilter: scrolled ? 'blur(16px) saturate(180%)' : 'blur(8px)',
        boxShadow: scrolled ? '0 4px 30px rgba(0,0,0,0.12)' : 'none',
      }}
    >
      <nav
        className="max-w-7xl mx-auto px-6 transition-all duration-300"
        style={{ padding: scrolled ? '0.625rem 1.5rem' : '1rem 1.5rem' }}
      >
        <div className="flex items-center justify-between">
          <div className="text-xl font-semibold lp-text-brand">{APP_NAME}</div>

          <div className="hidden md:flex items-center justify-center gap-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <a href={hash(LP_SECTIONS.FEATURES)} className="text-sm lp-text-secondary hover:opacity-100 transition-colors">Features</a>
            <a href={hash(LP_SECTIONS.PRICING)} className="text-sm lp-text-secondary hover:opacity-100 transition-colors">Pricing</a>
            <a href={hash(LP_SECTIONS.FAQ)} className="text-sm lp-text-secondary hover:opacity-100 transition-colors">FAQ</a>
            <a href={hash(LP_SECTIONS.DOWNLOAD)} className="text-sm lp-text-secondary hover:opacity-100 transition-colors">Download</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="flex items-center justify-center w-9 h-9 rounded-full lp-text-secondary transition-all cursor-pointer"
              style={{ backgroundColor: 'transparent' }}
              onPointerEnter={e => e.currentTarget.style.backgroundColor = 'var(--lp-bg-elevated)'}
              onPointerLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <a href={LP_APP.REGISTER}>
              <Button type="button" variant="default" size="sm">
                Get Started
              </Button>
            </a>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="flex items-center justify-center w-9 h-9 rounded-full lp-text-secondary transition-all cursor-pointer"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              type="button"
              className="lp-text cursor-pointer"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <XIcon size={24} /> : <MenuIcon size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden lp-mobile-menu backdrop-blur-md border-t animate-[slideDown_0.3s_ease-out]">
          <div className="px-6 py-4 flex flex-col gap-4">
            <a href={hash(LP_SECTIONS.FEATURES)} className="text-sm lp-text-secondary py-2 transition-colors" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href={hash(LP_SECTIONS.PRICING)} className="text-sm lp-text-secondary py-2 transition-colors" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <a href={hash(LP_SECTIONS.FAQ)} className="text-sm lp-text-secondary py-2 transition-colors" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
            <a href={hash(LP_SECTIONS.DOWNLOAD)} className="text-sm lp-text-secondary py-2 transition-colors" onClick={() => setMobileMenuOpen(false)}>Download</a>
            <div className="flex flex-col gap-2 pt-4 border-t" style={{ borderColor: 'var(--lp-border-subtle)' }}>
              <a href={LP_APP.REGISTER}>
                <Button type="button" variant="default" size="sm">
                  Get Started
                </Button>
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
});

Navigation.displayName = "Navigation";

// Shared easing — ease-out-quart (smooth, refined deceleration)
const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1];

// Hero Component
const Hero = React.memo(({ isDark }: { isDark: boolean }) => {
  const reducedMotion = useReducedMotion();
  const fade = (delay: number, y = 30) => ({
    initial: reducedMotion ? false : ({ opacity: 0, y } as const),
    animate: { opacity: 1, y: 0 } as const,
    transition: { duration: 0.6, delay, ease: EASE_OUT },
  });

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-start px-6 py-20 md:py-24 overflow-hidden">
      <motion.aside
        {...fade(0.1, 20)}
        className="mb-8 inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm max-w-full"
        style={{ borderColor: 'var(--lp-border-badge)', backgroundColor: 'var(--lp-bg-badge)' }}
      >
        <span className="text-xs text-center whitespace-nowrap lp-text-muted">
          Launch offer — save up to ₹5,000/yr on yearly plans
        </span>
        <a
          href={hash(LP_SECTIONS.PRICING)}
          className="flex items-center gap-1 text-xs lp-text-muted transition-all active:scale-95 whitespace-nowrap"
          aria-label="View pricing plans"
        >
          View pricing
          <ArrowRight size={12} />
        </a>
      </motion.aside>

      {/* h1 gradient controlled by landing.css tokens */}
      <motion.h1 {...fade(0.2)} className="text-center max-w-3xl px-6 leading-tight mb-6 font-medium" style={{ fontSize: 'var(--fs-2xl)' }}>
        Your Entire Business.<br />In Your Pocket.
      </motion.h1>

      <motion.p {...fade(0.3)} className="text-sm md:text-base text-center max-w-2xl px-6 mb-10 lp-text-muted">
        Invoices, inventory, payments, WhatsApp sharing — all from your phone. Built for Indian businesses.
      </motion.p>

      <motion.div {...fade(0.4, 20)} id={LP_SECTIONS.HERO_CTA} className="flex items-center gap-4 relative z-10 mb-16">
        <a href={LP_APP.REGISTER}>
          <Button
            type="button"
            variant="gradient"
            size="lg"
            className="rounded-lg flex items-center justify-center"
            aria-label="Start your 14-day trial"
          >
            Start 14-Day Trial
          </Button>
        </a>
      </motion.div>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: EASE_OUT }}
        className="w-full max-w-5xl relative pb-6 lg:pb-20 px-6"
      >
        {isDark && (
          <div
            className="absolute left-1/2 w-[140%] lg:w-[120%] pointer-events-none z-0"
            style={{ top: "-15%", transform: "translateX(-50%)" }}
            aria-hidden="true"
          >
            <img
              src="https://i.postimg.cc/Ss6yShGy/glows.png"
              alt=""
              className="w-full h-auto"
              loading="lazy"
              width={1920}
              height={1080}
            />
          </div>
        )}

        {/* Desktop: Dashboard + Phone side by side */}
        <div className="relative z-10 hidden lg:flex items-start justify-center gap-8">
          <div className="flex-1 min-w-0">
            <ScaledMockup designWidth={900}>
              <HeroDashboardMockup />
            </ScaledMockup>
          </div>
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, x: 30, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.8, ease: EASE_OUT }}
            className="shrink-0"
            style={{ marginRight: -16 }}
          >
            <HeroPhoneMockup />
          </motion.div>
        </div>

        {/* Mobile/Tablet: Phone only, gradient fade at bottom */}
        <div className="relative z-10 lg:hidden flex justify-center">
          <div className="relative">
            <HeroPhoneMockup className="w-[240px] sm:w-[280px]" />
            {/* Gradient fade at bottom */}
            <div
              className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
              style={{ background: 'linear-gradient(to top, var(--lp-bg), transparent)' }}
            />
          </div>
        </div>
      </motion.div>
    </section>
  );
});

Hero.displayName = "Hero";

// Main Export
export default function SaaSHero({ isDark, onToggleTheme }: ThemeProps) {
  return (
    <main className="min-h-screen" style={{ background: 'var(--lp-bg)', color: 'var(--lp-text)' }}>
      <Navigation isDark={isDark} onToggleTheme={onToggleTheme} />
      <Hero isDark={isDark} />
    </main>
  );
}
