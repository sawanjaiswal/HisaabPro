import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function CallToAction() {
  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col justify-between gap-y-6 bg-[radial-gradient(35%_80%_at_25%_0%,--theme(--color-foreground/.08),transparent)] px-4 py-8">


      <div className="space-y-1">
        <h2 className="text-center font-bold text-2xl">
          Start billing smarter today.
        </h2>
        <p className="text-center text-muted-foreground">
          14-day free trial. No credit card required. Cancel anytime.
        </p>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button variant="ghost">Contact Us</Button>
        <Button>
          Start Free Trial <ArrowRightIcon className="size-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
