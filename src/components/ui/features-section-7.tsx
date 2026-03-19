import { Cpu, Lock, MessageCircle, Zap } from 'lucide-react'

export function FeaturesSection7() {
    return (
        <section id="features" className="overflow-hidden py-16 md:py-32">
            <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-12">
                <div className="relative z-10 max-w-2xl">
                    <h2 className="text-4xl font-semibold lg:text-5xl">Everything your business needs</h2>
                    <p className="mt-6 text-lg lp-text-body">From billing to payments, all in one app that works on any phone — even without internet.</p>
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
                        <p className="text-sm lp-text-muted">Create GST-ready invoices in 10 seconds. Add items, apply discounts, share on WhatsApp — all faster than pen and paper.</p>
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
                        <p className="text-sm lp-text-muted">Share professional PDF invoices on WhatsApp in 2 taps. Your customers get a branded bill instantly — no app download needed.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Lock className="size-6" style={{ color: 'var(--lp-brand)' }} />
                            <p className="text-sm font-semibold lp-text">Your Data, Always Safe</p>
                        </div>
                        <p className="text-sm lp-text-muted">Bank-grade encryption protects your business data. Even if you lose your phone, restore everything on a new device in minutes.</p>
                    </div>
                </div>
            </div>
        </section>
    )
}
