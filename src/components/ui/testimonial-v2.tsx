import React from 'react';
import { motion, useReducedMotion } from "motion/react";

// --- Types ---
interface Testimonial {
  text: string;
  image: string;
  name: string;
  role: string;
}

// --- Data ---
// Avatar colors — warm, distinguishable palette for initials
const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#eab308', '#ef4444', '#06b6d4', '#22c55e']

function avatarUrl(name: string, index: number): string {
  const bg = AVATAR_COLORS[index % AVATAR_COLORS.length].replace('#', '')
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=fff&size=150&bold=true&format=svg`
}

const testimonials: Testimonial[] = [
  {
    text: "Mera purana billing app internet ke bina kaam nahi karta tha. HisaabPro mein sab kuch offline hota hai. Ab bills kabhi nahi kho-te.",
    image: avatarUrl("Rajesh Sharma", 0),
    name: "Rajesh Sharma",
    role: "Kirana Store Owner, Indore",
  },
  {
    text: "I have 3 staff members and each one has their own login with limited access. Finally I know who did what and when.",
    image: avatarUrl("Priya Patel", 1),
    name: "Priya Patel",
    role: "Wholesale Trader, Ahmedabad",
  },
  {
    text: "I send invoices on WhatsApp in 2 taps. My customers love getting professional PDFs instead of handwritten bills.",
    image: avatarUrl("Amit Gupta", 2),
    name: "Amit Gupta",
    role: "Garment Shop Owner, Surat",
  },
  {
    text: "Setting up took 2 minutes. I created my first invoice the same day. Very easy to use, even for someone not tech-savvy.",
    image: avatarUrl("Sunita Verma", 3),
    name: "Sunita Verma",
    role: "Stationery Shop, Jaipur",
  },
  {
    text: "The payment tracking is excellent. I can see who owes me money and send reminders directly on WhatsApp. Collections have improved.",
    image: avatarUrl("Mohammed Irfan", 4),
    name: "Mohammed Irfan",
    role: "Electronics Dealer, Hyderabad",
  },
  {
    text: "Beautiful app. My customers think I hired a designer for my invoices. It is just HisaabPro templates. Very professional look.",
    image: avatarUrl("Kavita Joshi", 5),
    name: "Kavita Joshi",
    role: "Boutique Owner, Pune",
  },
  {
    text: "Stock management is automatic. When I sell something, stock updates instantly. No more manual counting at end of day.",
    image: avatarUrl("Vikram Singh", 6),
    name: "Vikram Singh",
    role: "Hardware Store, Ludhiana",
  },
  {
    text: "I was using paper registers for 5 years. Switching to HisaabPro was the best business decision. My CA is also happy now.",
    image: avatarUrl("Neha Agarwal", 7),
    name: "Neha Agarwal",
    role: "Beauty Salon, Delhi",
  },
  {
    text: "End of month I download the PDF report and send to my CA. Everything is clean and organized. Saves me hours every month.",
    image: avatarUrl("Deepak Tiwari", 8),
    name: "Deepak Tiwari",
    role: "Auto Parts Shop, Nagpur",
  },
];

const firstColumn = testimonials.slice(0, 3);
const secondColumn = testimonials.slice(3, 6);
const thirdColumn = testimonials.slice(6, 9);

// --- Sub-Components ---
const TestimonialsColumn = (props: {
  className?: string;
  testimonials: Testimonial[];
  duration?: number;
  columnIndex: number;
}) => {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={props.className}
      initial={reducedMotion ? false : { opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{
        duration: 0.8,
        delay: props.columnIndex * 0.15,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <motion.ul
        className="testimonial-scroll flex flex-col gap-6 pb-6 bg-transparent list-none m-0 p-0"
        style={{ ['--scroll-duration' as string]: `${props.duration || 10}s` }}
      >
        {[...Array(2)].map((_, index) => (
          <React.Fragment key={index}>
            {props.testimonials.map(({ text, image, name, role }, i) => (
              <motion.li
                key={`${index}-${i}`}
                aria-hidden={index === 1 ? "true" : "false"}
                tabIndex={index === 1 ? -1 : 0}
                initial={reducedMotion || index === 1 ? false : { opacity: 0, scale: 0.95, y: 20 }}
                whileInView={index === 0 ? { opacity: 1, scale: 1, y: 0 } : undefined}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.5,
                  delay: props.columnIndex * 0.1 + i * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
                whileHover={{
                  scale: 1.03,
                  y: -8,
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)",
                  transition: { type: "spring", stiffness: 400, damping: 17 }
                }}
                whileFocus={{
                  scale: 1.03,
                  y: -8,
                  transition: { type: "spring", stiffness: 400, damping: 17 }
                }}
                className="p-10 rounded-3xl border shadow-lg shadow-black/5 max-w-xs w-full cursor-default select-none group focus:outline-none focus:ring-2 focus:ring-primary/30"
                style={{
                  backgroundColor: 'var(--lp-bg-card)',
                  borderColor: 'var(--lp-card-border)',
                }}
              >
                <blockquote className="m-0 p-0">
                  <p className="leading-relaxed font-normal m-0 lp-text-muted">
                    {text}
                  </p>
                  <footer className="flex items-center gap-3 mt-6">
                    <img
                      width={40}
                      height={40}
                      src={image}
                      alt={`Avatar of ${name}`}
                      className="h-10 w-10 rounded-full object-cover ring-2"
                      style={{ ['--tw-ring-color' as string]: 'var(--lp-avatar-ring)' }}
                      loading="lazy"
                    />
                    <div className="flex flex-col">
                      <cite className="font-semibold not-italic tracking-tight leading-5 lp-text">
                        {name}
                      </cite>
                      <span className="text-sm leading-5 tracking-tight mt-0.5 lp-text-muted">
                        {role}
                      </span>
                    </div>
                  </footer>
                </blockquote>
              </motion.li>
            ))}
          </React.Fragment>
        ))}
      </motion.ul>
    </motion.div>
  );
};

const TestimonialsSection = () => {
  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-heading"
      className="bg-transparent py-24 relative overflow-hidden"
    >
      <div className="container px-4 z-10 mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{
            duration: 1,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="flex flex-col items-center justify-center max-w-[540px] mx-auto mb-16"
        >
          <div className="flex justify-center">
            <div
              className="border py-1 px-4 rounded-full text-xs font-semibold tracking-wide uppercase"
              style={{
                borderColor: 'var(--lp-testimonial-badge-border)',
                color: 'var(--lp-testimonial-badge-text)',
                backgroundColor: 'var(--lp-testimonial-badge-bg)',
              }}
            >
              Testimonials
            </div>
          </div>

          <h2 id="testimonials-heading" className="text-4xl md:text-5xl font-extrabold tracking-tight mt-6 text-center">
            Loved by 10,000+ business owners
          </h2>
          <p className="text-center mt-5 text-lg leading-relaxed max-w-sm lp-text-muted">
            From kirana stores to wholesalers — hear why they switched.
          </p>
        </motion.div>

        <div
          className="testimonial-scroll-container flex justify-center gap-6 mt-10 [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] max-h-[740px] overflow-hidden"
          role="region"
          aria-label="Scrolling Testimonials"
        >
          <TestimonialsColumn testimonials={firstColumn} duration={15} columnIndex={0} />
          <TestimonialsColumn testimonials={secondColumn} className="hidden md:block" duration={19} columnIndex={1} />
          <TestimonialsColumn testimonials={thirdColumn} className="hidden lg:block" duration={17} columnIndex={2} />
        </div>
      </div>
    </section>
  );
};

// --- Main Export ---
export function TestimonialV2() {
  return <TestimonialsSection />;
}

export default TestimonialV2;
