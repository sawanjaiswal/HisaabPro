import { Cpu, Lock, MessageCircle, Zap } from 'lucide-react'

export function FeaturesSection7() {
    return (
        <section id="features" className="overflow-hidden py-16 md:py-32">
            <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-12">
                <div className="relative z-10 max-w-2xl">
                    <h2 className="text-4xl font-semibold lg:text-5xl">Built for how India does business</h2>
                    <p className="mt-6 text-lg lp-text-body">From your first invoice to your monthly CA report — all in one pocket-sized app that never needs WiFi.</p>
                </div>
                <div className="relative -mx-4 rounded-3xl p-3 md:-mx-12 lg:col-span-3">
                    <div className="aspect-[16/9] relative overflow-hidden rounded-2xl border" style={{ borderColor: 'color-mix(in srgb, var(--lp-text) 10%, transparent)' }}>
                        <div className="z-1 inset-0 absolute" style={{ backgroundImage: `radial-gradient(at 75% 25%, transparent, var(--lp-bg) 75%)` }} />
                        <img
                            src="https://i.postimg.cc/SKcdVTr1/Dashboard2.png"
                            className="absolute inset-0 h-full w-full object-cover object-top"
                            alt="HisaabPro billing dashboard showing invoices, payments and business overview"
                            loading="lazy"
                            width={1920}
                            height={1080}
                        />
                    </div>
                </div>
                <div className="relative mx-auto grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-8 lg:grid-cols-4">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Zap className="size-6" style={{ color: 'var(--lp-brand)' }} />
                            <p className="text-sm font-semibold lp-text">10-Second Invoicing</p>
                        </div>
                        <p className="text-sm lp-text-muted">Add items, apply discounts, generate a GST-ready PDF and share on WhatsApp — faster than writing it by hand.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Cpu className="size-6" style={{ color: 'var(--lp-brand)' }} />
                            <p className="text-sm font-semibold lp-text">100% Offline</p>
                        </div>
                        <p className="text-sm lp-text-muted">Bill customers in a village, at a mela, or during a power cut. Everything works without internet. Syncs when you're back online.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <MessageCircle className="size-6" style={{ color: 'var(--lp-brand)' }} />
                            <p className="text-sm font-semibold lp-text">WhatsApp Sharing</p>
                        </div>
                        <p className="text-sm lp-text-muted">Two taps: generate PDF, send on WhatsApp. Your customers get a branded bill instantly — no app download needed on their side.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Lock className="size-6" style={{ color: 'var(--lp-brand)' }} />
                            <p className="text-sm font-semibold lp-text">Your Data, Always Safe</p>
                        </div>
                        <p className="text-sm lp-text-muted">Bank-grade encryption + automatic cloud backup. Lose your phone? Log in on a new one and everything is back in minutes.</p>
                    </div>
                </div>
            </div>
        </section>
    )
}
