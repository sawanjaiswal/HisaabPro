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
      "Yes — 14 days with full access to any plan. No credit card required. Pick a plan after your trial ends, or cancel with no questions asked.",
  },
  {
    id: 2,
    title: "Does it work without internet?",
    image: "",
    description:
      "100% offline. Create invoices, record payments, manage inventory — all without internet. Your data syncs automatically when you're back online. Zero data loss, ever.",
  },
  {
    id: 3,
    title: "Is my data safe?",
    image: "",
    description:
      "Your data is encrypted end-to-end and backed up to the cloud. Even if you lose your phone, log in on any new device and everything is restored. We never sell your data.",
  },
  {
    id: 4,
    title: "Can I share invoices on WhatsApp?",
    image: "",
    description:
      "Yes! Generate a PDF invoice and share it on WhatsApp, Email, or print it — all in 2 taps from the invoice screen. Customers receive a professional PDF with your business branding.",
  },
  {
    id: 5,
    title: "How is this different from Vyapar or MyBillBook?",
    image: "",
    description:
      "HisaabPro works fully offline (not partially), has zero data loss by design, a modern premium UI, custom staff role builder, and faster WhatsApp support. Plus transparent pricing — no hidden charges.",
  },
];

const Feature197 = ({ features = defaultFeatures }: Feature197Props) => {
  const [activeTabId, setActiveTabId] = useState<number | null>(1);

  return (
    <section id="faq" className="py-32 lp-heading-plain">
      <div className="container mx-auto">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-semibold lg:text-5xl" style={{ color: 'var(--lp-text)' }}>
            Frequently asked questions
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
