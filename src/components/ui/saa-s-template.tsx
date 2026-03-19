import React from "react";
import { Sun, Moon } from "lucide-react";

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

  return (
    <header className="fixed top-0 w-full z-50 border-b lp-nav backdrop-blur-md">
      <nav className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-xl font-semibold lp-text-brand">HisaabPro</div>

          <div className="hidden md:flex items-center justify-center gap-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <a href="#features" className="text-sm lp-text-secondary hover:opacity-100 transition-colors">Features</a>
            <a href="#pricing" className="text-sm lp-text-secondary hover:opacity-100 transition-colors">Pricing</a>
            <a href="#faq" className="text-sm lp-text-secondary hover:opacity-100 transition-colors">FAQ</a>
            <a href="#download" className="text-sm lp-text-secondary hover:opacity-100 transition-colors">Download</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="flex items-center justify-center w-9 h-9 rounded-full lp-text-secondary transition-all"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--lp-bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Button type="button" variant="default" size="sm">
              Start Free Trial
            </Button>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="flex items-center justify-center w-9 h-9 rounded-full lp-text-secondary transition-all"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              type="button"
              className="lp-text"
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
            <a href="#features" className="text-sm lp-text-secondary py-2 transition-colors" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#pricing" className="text-sm lp-text-secondary py-2 transition-colors" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <a href="#faq" className="text-sm lp-text-secondary py-2 transition-colors" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
            <a href="#download" className="text-sm lp-text-secondary py-2 transition-colors" onClick={() => setMobileMenuOpen(false)}>Download</a>
            <div className="flex flex-col gap-2 pt-4 border-t" style={{ borderColor: 'var(--lp-border-subtle)' }}>
              <Button type="button" variant="default" size="sm">
                Start Free Trial
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
});

Navigation.displayName = "Navigation";

// Hero Component
const Hero = React.memo(({ isDark }: { isDark: boolean }) => {
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-start px-6 py-20 md:py-24"
      style={{ animation: "fadeIn 0.6s ease-out" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        * { font-family: 'Poppins', sans-serif; }
      `}</style>

      <aside
        className="mb-8 inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm max-w-full"
        style={{ borderColor: 'var(--lp-border-badge)', backgroundColor: 'var(--lp-bg-badge)' }}
      >
        <span className="text-xs text-center whitespace-nowrap lp-text-muted">
          Launch offer — save up to ₹5,000/yr on yearly plans
        </span>
        <a
          href="#pricing"
          className="flex items-center gap-1 text-xs lp-text-muted transition-all active:scale-95 whitespace-nowrap"
          aria-label="View pricing plans"
        >
          View pricing
          <ArrowRight size={12} />
        </a>
      </aside>

      {/* h1 gradient controlled by landing.css tokens */}
      <h1 className="text-center max-w-3xl px-6 leading-tight mb-6 font-medium">
        Billing App That Never<br />Goes Offline
      </h1>

      <p className="text-sm md:text-base text-center max-w-2xl px-6 mb-10 lp-text-muted">
        Create GST invoices, manage inventory, track payments, and send bills on WhatsApp — works even without internet. Trusted by 10,000+ Indian businesses.
      </p>

      <div id="hero-cta" className="flex items-center gap-4 relative z-10 mb-16">
        <Button
          type="button"
          variant="gradient"
          size="lg"
          className="rounded-lg flex items-center justify-center"
          aria-label="Start your 14-day free trial"
        >
          Start 14-Day Free Trial
        </Button>
      </div>

      <div className="w-full max-w-5xl relative pb-20">
        {isDark && (
          <div
            className="absolute left-1/2 w-[90%] pointer-events-none z-0"
            style={{ top: "-23%", transform: "translateX(-50%)" }}
            aria-hidden="true"
          >
            <img
              src="https://i.postimg.cc/Ss6yShGy/glows.png"
              alt=""
              className="w-full h-auto"
              loading="eager"
            />
          </div>
        )}

        <div className="relative z-10">
          <img
            src="https://i.postimg.cc/SKcdVTr1/Dashboard2.png"
            alt="HisaabPro dashboard preview"
            className="w-full h-auto rounded-lg shadow-2xl"
            loading="eager"
          />
        </div>
      </div>
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
