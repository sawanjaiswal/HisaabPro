import { ArrowRightIcon, Check } from "lucide-react";

const AVATAR_URLS = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=64&h=64&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=64&h=64&fit=crop&crop=faces",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=faces",
];

const TRUST_POINTS = [
  "No credit card needed",
  "Setup in 2 minutes",
  "Cancel anytime",
];

export function CallToAction() {
  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-y-8 px-4 py-12">
      {/* Trust signal — avatars + count */}
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {AVATAR_URLS.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              width={32}
              height={32}
              loading="lazy"
              className="rounded-full object-cover"
              style={{
                width: 32,
                height: 32,
                outline: '2px solid var(--lp-bg-card)',
              }}
            />
          ))}
        </div>
        <span className="text-sm font-medium lp-text-muted">
          Trusted by <span className="lp-text">10,000+</span> Indian businesses
        </span>
      </div>

      {/* Heading */}
      <div className="space-y-3 text-center">
        <h2 className="font-bold">
          Your kirana store deserves software that never sleeps
        </h2>
        <p className="text-base lp-text-body max-w-xl mx-auto">
          Join 10,000+ Indian business owners who save 2+ hours daily on billing.
          14-day free trial, no credit card.
        </p>
      </div>

      {/* CTA buttons */}
      <div className="flex items-center justify-center gap-3">
        <button className="lp-btn-ghost inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all h-12 px-6 py-2 cursor-pointer">
          Contact Us
        </button>
        <button className="lp-cta inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all h-12 px-6 py-2 cursor-pointer">
          Start Free Trial <ArrowRightIcon className="size-4 ml-1" />
        </button>
      </div>

      {/* Mini trust points */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {TRUST_POINTS.map((point) => (
          <span key={point} className="inline-flex items-center gap-1.5 text-sm lp-text-muted">
            <Check className="size-4" style={{ color: 'var(--lp-accent)' }} />
            {point}
          </span>
        ))}
      </div>
    </div>
  );
}
