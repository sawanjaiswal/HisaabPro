import React from 'react';
import { motion } from "motion/react";
import { APP_NAME } from '@/config/app.config';

// --- Types ---
interface Testimonial {
  text: string;
  image: string;
  name: string;
  role: string;
}

// --- Data ---
const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#eab308', '#ef4444', '#06b6d4', '#22c55e']

function avatarUrl(name: string, index: number): string {
  const bg = AVATAR_COLORS[index % AVATAR_COLORS.length].replace('#', '')
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=fff&size=150&bold=true&format=svg`
}

const testimonials: Testimonial[] = [
  {
    text: `Mera purana billing app bahut slow tha aur data kho jaata tha. ${APP_NAME} mein sab kuch fast hai aur bills kabhi nahi kho-te.`,
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
    text: `Beautiful app. My customers think I hired a designer for my invoices. It is just ${APP_NAME} templates. Very professional look.`,
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
    text: `I was using paper registers for 5 years. Switching to ${APP_NAME} was the best business decision. My CA is also happy now.`,
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
}) => {
  return (
    <div className={props.className}>
      <motion.ul
        animate={{
          translateY: "-50%",
        }}
        transition={{
          duration: props.duration || 10,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6 bg-transparent transition-colors duration-300 list-none m-0 p-0"
      >
        {[
          ...new Array(2).fill(0).map((_, index) => (
            <React.Fragment key={index}>
              {props.testimonials.map(({ text, image, name, role }, i) => (
                <li
                  key={`${index}-${i}`}
                  aria-hidden={index === 1 ? "true" : "false"}
                  className="p-6 sm:p-10 rounded-3xl border shadow-lg shadow-black/5 max-w-xs w-full select-none"
                  style={{
                    backgroundColor: 'var(--lp-bg-card)',
                    borderColor: 'var(--lp-card-border)',
                  }}
                >
                  <blockquote className="m-0 p-0">
                    <p className="leading-relaxed font-normal m-0 transition-colors duration-300 lp-text-muted">
                      {text}
                    </p>
                    <footer className="flex items-center gap-3 mt-6">
                      <img
                        width={40}
                        height={40}
                        src={image}
                        alt={`Avatar of ${name}`}
                        className="h-10 w-10 rounded-full object-cover ring-2 transition-all duration-300 ease-in-out"
                        style={{ ['--tw-ring-color' as string]: 'var(--lp-avatar-ring)' }}
                        loading="lazy"
                      />
                      <div className="flex flex-col">
                        <cite className="font-semibold not-italic tracking-tight leading-5 transition-colors duration-300 lp-text">
                          {name}
                        </cite>
                        <span className="text-sm leading-5 tracking-tight mt-0.5 transition-colors duration-300 lp-text-muted">
                          {role}
                        </span>
                      </div>
                    </footer>
                  </blockquote>
                </li>
              ))}
            </React.Fragment>
          )),
        ]}
      </motion.ul>
    </div>
  );
};

const TestimonialsSection = () => {
  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-heading"
      className="bg-transparent py-24 relative overflow-hidden"
    >
      <motion.div
        initial={{ opacity: 0, y: 50, rotate: -2 }}
        whileInView={{ opacity: 1, y: 0, rotate: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{
          duration: 1.2,
          ease: [0.16, 1, 0.3, 1],
          opacity: { duration: 0.8 }
        }}
        className="container px-4 z-10 mx-auto"
      >
        <div className="flex flex-col items-center justify-center max-w-[540px] mx-auto mb-10 md:mb-16 px-6">
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
        </div>

        <div
          className="flex justify-center gap-6 mt-10 [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] max-h-[740px] overflow-hidden"
          role="region"
          aria-label="Scrolling Testimonials"
        >
          <TestimonialsColumn testimonials={firstColumn} duration={15} />
          <TestimonialsColumn testimonials={secondColumn} className="hidden md:block" duration={19} />
          <TestimonialsColumn testimonials={thirdColumn} className="hidden lg:block" duration={17} />
        </div>
      </motion.div>
    </section>
  );
};

// --- Main Export ---
export function TestimonialV2() {
  return <TestimonialsSection />;
}

export default TestimonialV2;
