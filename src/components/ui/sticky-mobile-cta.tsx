'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { LP_SECTIONS, LP_APP } from '@/config/landing-links.config';

export function StickyMobileCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sentinelIds = [LP_SECTIONS.HERO_CTA, LP_SECTIONS.FINAL_CTA];
    const inViewSet = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).id;
          if (entry.isIntersecting) {
            inViewSet.add(id);
          } else {
            inViewSet.delete(id);
          }
        });
        setVisible(inViewSet.size === 0);
      },
      { threshold: 0 }
    );

    const observed: Element[] = [];
    sentinelIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
        observed.push(el);
      }
    });

    // If no sentinels found, stay hidden
    if (observed.length === 0) return;

    return () => {
      observed.forEach((el) => observer.unobserve(el));
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed bottom-0 left-0 right-0 z-[40] md:hidden backdrop-blur-xl border-t pb-[env(safe-area-inset-bottom)]"
          style={{
            backgroundColor: 'var(--lp-bg-nav)',
            borderColor: 'var(--lp-border-subtle)',
          }}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-semibold text-sm lp-text">Try HisaabPro</p>
              <p className="text-xs lp-text-muted">14-day trial, no card</p>
            </div>
            <a href={LP_APP.REGISTER}>
              <button className="lp-cta flex items-center gap-1.5 rounded-lg px-5 py-2.5 font-semibold text-sm transition-colors cursor-pointer">
                Get started
                <ArrowRight className="w-4 h-4" />
              </button>
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
