"use client";

import { useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
    title: "Is there a free trial?",
    image: "",
    description:
      "Yes — 14 days, full access, any plan. No credit card required. Keep going after the trial or cancel — no questions asked.",
  },
  {
    id: 2,
    title: "Does it work without internet?",
    image: "",
    description:
      "100%. Create invoices, record payments, manage inventory — all without internet. Your data syncs automatically when you reconnect. Zero data loss, guaranteed.",
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
      "HisaabPro works fully offline (not partially), guarantees zero data loss, has a modern premium UI that your customers will notice, a custom staff role builder, and real WhatsApp support that replies in hours — not months. Plus transparent pricing with no hidden charges.",
  },
];

const Feature197 = ({ features = defaultFeatures }: Feature197Props) => {
  const [activeTabId, setActiveTabId] = useState<number | null>(1);

  return (
    <section id="faq" className="py-32 lp-heading-plain">
      <div className="container mx-auto">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-semibold lg:text-5xl" style={{ color: 'var(--lp-text)' }}>
            Got questions?
          </h2>
          <p className="mt-4 text-lg lp-text-muted">
            Everything you need to know before you start.
          </p>
        </div>
        <div className="mb-12 flex w-full items-start justify-center gap-12">
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
                      className="text-xl font-semibold"
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
        </div>
      </div>
    </section>
  );
};

export { Feature197 };
