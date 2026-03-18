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
    const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

    const variants = {
      default: "bg-[#1e3a5f] dark:bg-white text-white dark:text-black hover:bg-[#2563eb] dark:hover:bg-gray-100",
      secondary: "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700",
      ghost: "hover:bg-gray-100 dark:hover:bg-gray-800/50 text-gray-700 dark:text-white",
      gradient: "bg-[#1e3a5f] dark:bg-white text-white dark:text-black hover:bg-[#2563eb] dark:hover:bg-gray-100 hover:scale-105 active:scale-95"
    };

    const sizes = {
      default: "h-10 px-4 py-2 text-sm",
      sm: "h-10 px-5 text-sm",
      lg: "h-12 px-8 text-base"
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
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

  const linkClass = "text-sm text-gray-600 dark:text-white/60 hover:text-[#1e3a5f] dark:hover:text-white transition-colors";

  return (
    <header className="fixed top-0 w-full z-50 border-b border-gray-200/60 dark:border-gray-800/50 bg-white/90 dark:bg-black/80 backdrop-blur-md">
      <nav className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-xl font-semibold text-[#1e3a5f] dark:text-white">HisaabPro</div>

          <div className="hidden md:flex items-center justify-center gap-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <a href="#features" className={linkClass}>Features</a>
            <a href="#pricing" className={linkClass}>Pricing</a>
            <a href="#faq" className={linkClass}>FAQ</a>
            <a href="#download" className={linkClass}>Download</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {/* Theme toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="flex items-center justify-center w-9 h-9 rounded-full text-gray-600 dark:text-white/60 hover:text-[#1e3a5f] dark:hover:text-white hover:bg-[#e8f4ff] dark:hover:bg-gray-800/50 transition-all"
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
              className="flex items-center justify-center w-9 h-9 rounded-full text-gray-700 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-all"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              type="button"
              className="text-gray-700 dark:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <XIcon size={24} /> : <MenuIcon size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden bg-white/95 dark:bg-black/95 backdrop-blur-md border-t border-gray-200/60 dark:border-gray-800/50 animate-[slideDown_0.3s_ease-out]">
          <div className="px-6 py-4 flex flex-col gap-4">
            <a href="#features" className={`${linkClass} py-2`} onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#pricing" className={`${linkClass} py-2`} onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <a href="#faq" className={`${linkClass} py-2`} onClick={() => setMobileMenuOpen(false)}>FAQ</a>
            <a href="#download" className={`${linkClass} py-2`} onClick={() => setMobileMenuOpen(false)}>Download</a>
            <div className="flex flex-col gap-2 pt-4 border-t border-gray-200/60 dark:border-gray-800/50">
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
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <aside className="mb-8 inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-full border border-gray-300 dark:border-gray-700 bg-gray-100/70 dark:bg-gray-800/50 backdrop-blur-sm max-w-full">
        <span className="text-xs text-center whitespace-nowrap text-gray-500 dark:text-gray-400">
          Launch offer — save up to ₹5,000/yr on yearly plans
        </span>
        <a
          href="#pricing"
          className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all active:scale-95 whitespace-nowrap"
          aria-label="View pricing plans"
        >
          View pricing
          <ArrowRight size={12} />
        </a>
      </aside>

      {/* h1 gradient controlled by landing.css — dark: white fade, light: navy fade */}
      <h1 className="text-center max-w-3xl px-6 leading-tight mb-6 font-medium">
        Billing App That Never<br />Goes Offline
      </h1>

      <p className="text-sm md:text-base text-center max-w-2xl px-6 mb-10 text-gray-600 dark:text-gray-400">
        Create professional invoices, manage inventory, track payments — works even without internet. Built for Indian businesses.
      </p>

      <div className="flex items-center gap-4 relative z-10 mb-16">
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
        {/* Glow only in dark mode */}
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
    <main className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white">
      <Navigation isDark={isDark} onToggleTheme={onToggleTheme} />
      <Hero isDark={isDark} />
    </main>
  );
}
