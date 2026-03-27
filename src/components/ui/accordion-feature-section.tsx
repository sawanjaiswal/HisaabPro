"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { APP_NAME } from "@/config/app.config";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1];

interface FeatureItem {
  id: number;
  title: string;
  image: string;
  description: string;
}

interface Feature197Props {
  features?: FeatureItem[];
}

const defaultFeatures: FeatureItem[] = [
  {
    id: 1,
    title: "How does the trial work?",
    image: "",
    description:
      "14 days, full access, any plan. No credit card required. Keep going after the trial or cancel — no questions asked.",
  },
  {
    id: 2,
    title: "Does it need internet to work?",
    image: "",
    description:
      "No. Create invoices, record payments, manage inventory — everything works on your phone. Your data syncs automatically in the background. Zero data loss, guaranteed.",
  },
  {
    id: 3,
    title: "Is my data safe?",
    image: "",
    description:
      "Encrypted end-to-end and backed up to the cloud automatically. Lose your phone? Log in on a new device — everything is restored. We never share or sell your data.",
  },
  {
    id: 4,
    title: "Can I share invoices on WhatsApp?",
    image: "",
    description:
      "Absolutely. Generate a PDF and share it on WhatsApp, Email, or print — 2 taps from the invoice screen. Your customers get a professional PDF with your business name, logo, and branding.",
  },
  {
    id: 5,
    title: "How is this different from Vyapar or MyBillBook?",
    image: "",
    description:
      `${APP_NAME} guarantees zero data loss, has a modern premium UI that your customers will notice, a custom staff role builder, and real WhatsApp support that replies in hours — not months. Plus transparent pricing with no hidden charges.`,
  },
];

const Feature197 = ({ features = defaultFeatures }: Feature197Props) => {
  const [activeTabId, setActiveTabId] = useState<number | null>(1);
  const reducedMotion = useReducedMotion();

  return (
    <section id="faq" className="py-16 md:py-32 px-6 lp-heading-plain">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="mb-12 text-center"
        >
          <h2 className="text-4xl font-semibold lg:text-5xl" style={{ color: 'var(--lp-text)' }}>
            Got questions?
          </h2>
          <p className="mt-4 text-lg lp-text-muted">
            Everything you need to know before you start.
          </p>
        </motion.div>
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6, delay: 0.15, ease: EASE_OUT }}
          className="mb-12 flex w-full items-start justify-center"
        >
          <div className="w-full max-w-2xl">
            <Accordion type="single" className="w-full" defaultValue="item-1">
              {features.map((tab) => (
                <AccordionItem
                  key={tab.id}
                  value={`item-${tab.id}`}
                  style={{ borderColor: 'var(--lp-border-subtle)' }}
                >
                  <AccordionTrigger
                    onClick={() => {
                      setActiveTabId(tab.id);
                    }}
                    className="cursor-pointer py-5 !no-underline transition"
                  >
                    <span
                      className="text-base sm:text-xl font-semibold text-left"
                      style={{
                        color: tab.id === activeTabId ? 'var(--lp-text)' : 'var(--lp-text-muted)',
                      }}
                    >
                      {tab.title}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="mt-3 lp-text-muted">
                      {tab.description}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export { Feature197 };
