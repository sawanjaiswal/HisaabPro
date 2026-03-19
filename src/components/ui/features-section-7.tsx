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
                    <div className="[perspective:800px]">
                        <div className="[transform:skewY(-2deg)skewX(-2deg)rotateX(6deg)]">
                            <div className="aspect-[88/36] relative">
                                <div className="z-1 -inset-[4.25rem] absolute" style={{ backgroundImage: `radial-gradient(at 75% 25%, transparent, var(--lp-bg) 75%)` }} />
                                <img src="https://tailark.com/_next/image?url=%2Fmail-upper.png&w=3840&q=75" className="absolute inset-0 z-10" alt="payments illustration" width={2797} height={1137} />
                                <img src="https://tailark.com/_next/image?url=%2Fmail-back.png&w=3840&q=75" className="lp-dark-only" alt="payments illustration dark" width={2797} height={1137} />
                                <img src="https://tailark.com/_next/image?url=%2Fmail-back-light.png&w=3840&q=75" className="lp-light-only" alt="payments illustration light" width={2797} height={1137} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="relative mx-auto grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-8 lg:grid-cols-4">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Zap className="size-6" style={{ color: 'var(--lp-brand)' }} />
                            <p className="text-sm font-semibold lp-text">10-Second Invoicing</p>
                        </div>
                        <p className="text-sm lp-text-muted">Create and share professional invoices faster than writing by hand.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Cpu className="size-6" style={{ color: 'var(--lp-brand)' }} />
                            <p className="text-sm font-semibold lp-text">100% Offline</p>
                        </div>
                        <p className="text-sm lp-text-muted">Bill, track payments, manage stock — all without internet. Syncs when you're back online.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <MessageCircle className="size-6" style={{ color: 'var(--lp-brand)' }} />
                            <p className="text-sm font-semibold lp-text">WhatsApp Sharing</p>
                        </div>
                        <p className="text-sm lp-text-muted">Send PDF invoices to customers on WhatsApp in 2 taps.</p>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Lock className="size-6" style={{ color: 'var(--lp-brand)' }} />
                            <p className="text-sm font-semibold lp-text">Your Data, Always Safe</p>
                        </div>
                        <p className="text-sm lp-text-muted">Encrypted backups. Even if you lose your phone, your data is recoverable.</p>
                    </div>
                </div>
            </div>
        </section>
    )
}
