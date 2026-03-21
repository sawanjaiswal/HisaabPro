import { Cpu, Lock, MessageCircle, Zap } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { InvoicesMockup } from '@/components/ui/invoices-mockup'
import { ScaledMockup } from '@/components/ui/scaled-mockup'

const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1]

const features = [
    { icon: Zap, title: '10-Second Invoicing', desc: 'Add items, apply discounts, generate a GST-ready PDF and share on WhatsApp — faster than writing it by hand.' },
    { icon: Cpu, title: 'Works Anywhere', desc: 'Bill customers in a village, at a mela, or during a power cut. Everything works on your phone. Syncs automatically in the background.' },
    { icon: MessageCircle, title: 'WhatsApp Sharing', desc: 'Two taps: generate PDF, send on WhatsApp. Your customers get a branded bill instantly — no app download needed on their side.' },
    { icon: Lock, title: 'Your Data, Always Safe', desc: 'Bank-grade encryption + automatic cloud backup. Lose your phone? Log in on a new one and everything is back in minutes.' },
]

export function FeaturesSection7() {
    const reducedMotion = useReducedMotion()

    return (
        <section id="features" className="overflow-hidden py-16 md:py-32">
            <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-12">
                <motion.div
                    initial={reducedMotion ? false : { opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.15 }}
                    transition={{ duration: 0.6, ease: EASE_OUT }}
                    className="relative z-10 max-w-2xl"
                >
                    <h2 className="text-4xl font-semibold lg:text-5xl">Built for how India does business</h2>
                    <p className="mt-6 text-lg lp-text-body">From your first invoice to your monthly CA report — all in one pocket-sized app that never needs WiFi.</p>
                </motion.div>
                <motion.div
                    initial={reducedMotion ? false : { opacity: 0, scale: 0.97, y: 20 }}
                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.15 }}
                    transition={{ duration: 0.7, delay: 0.1, ease: EASE_OUT }}
                    className="relative -mx-4 rounded-3xl p-3 md:-mx-12 lg:col-span-3"
                    style={{ perspective: '1200px' }}
                >
                    <div
                        className="relative overflow-hidden rounded-2xl transition-transform duration-700 ease-out"
                        style={{
                            transform: 'rotateX(2deg) rotateY(-3deg)',
                            transformOrigin: 'center center',
                        }}
                    >
                        <ScaledMockup designWidth={900}>
                            <InvoicesMockup />
                        </ScaledMockup>
                    </div>
                </motion.div>
                <div className="relative mx-auto grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-8 lg:grid-cols-4">
                    {features.map((f, i) => (
                        <motion.div
                            key={f.title}
                            initial={reducedMotion ? false : { opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.15 }}
                            transition={{ duration: 0.5, delay: i * 0.1, ease: EASE_OUT }}
                            className={i === 0 ? 'space-y-3' : 'space-y-2'}
                        >
                            <div className="flex items-center gap-2">
                                <f.icon className="size-6" style={{ color: 'var(--lp-brand)' }} />
                                <p className="text-sm font-semibold lp-text">{f.title}</p>
                            </div>
                            <p className="text-sm lp-text-muted">{f.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
