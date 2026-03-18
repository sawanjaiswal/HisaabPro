import { ArrowRightIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function CallToAction() {
  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col justify-between gap-y-6 bg-[radial-gradient(35%_80%_at_25%_0%,--theme(--color-foreground/.08),transparent)] px-4 py-8">


      <div className="space-y-1">
        <h2 className="text-center font-bold text-2xl">
          Let your plans shape the future.
        </h2>
        <p className="text-center text-muted-foreground">
          Start your free trial today. No credit card required.
        </p>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button variant="ghost">Contact Sales</Button>
        <Button>
          Get Started <ArrowRightIcon className="size-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
