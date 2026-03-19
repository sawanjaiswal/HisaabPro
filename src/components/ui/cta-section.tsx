import { ArrowRightIcon } from "lucide-react";

export function CallToAction() {
  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col justify-between gap-y-6 px-4 py-8">
      <div className="space-y-1">
        <h2 className="text-center font-bold text-2xl">
          Start billing smarter today.
        </h2>
        <p className="text-center lp-text-muted">
          14-day free trial. No credit card required. Cancel anytime.
        </p>
      </div>

      <div className="flex items-center justify-center gap-2">
        <button className="lp-btn-ghost inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all h-10 px-4 py-2 text-sm">
          Contact Us
        </button>
        <button className="lp-cta inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all h-10 px-4 py-2 text-sm">
          Start Free Trial <ArrowRightIcon className="size-4 ml-1" />
        </button>
      </div>
    </div>
  );
}
