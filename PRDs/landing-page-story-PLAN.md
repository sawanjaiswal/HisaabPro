# PRD: Landing Page — Real HisaabPro Story

> **Status:** Approved
> **Date:** 2026-03-19
> **Type:** Frontend only (no API, no DB)

---

## 1. What

Transform the current 19-section component showcase into a 7-section conversion-focused landing page with real HisaabPro copy, ₹INR pricing, and a clear story: Problem → Solution → Features → How → Pricing → Proof → CTA.

## 2. Why

Current landing page stacks 19 21st.dev components with placeholder text ("Logo", "Built for developers", "$9/month", "Asme" footer). Zero conversion value — looks like a template demo, not a product page.

## 3. Target Audience

- **Primary:** Raju — micro retailer, 0-1 staff, low tech, Rs 1-5L/month. Wants simple billing + "who owes me"
- **Secondary:** Priya — growing wholesaler, 2-5 staff, Rs 5-25L/month. Needs multi-user + inventory

## 4. Section Plan (9 total: nav + 7 sections + footer)

### Section 1: Nav + Hero (`saa-s-template`)
- **Nav logo:** "HisaabPro"
- **Nav links:** Features, Pricing, FAQ, Download
- **Nav CTA:** "Start Free Trial"
- **Announcement bar:** "Launch offer — save up to ₹5,000/yr on yearly plans"
- **Headline:** "Billing App That Never Goes Offline"
- **Subheading:** "Create GST invoices, manage inventory, track payments — works even without internet. Built for Indian businesses."
- **Primary CTA:** "Start 14-Day Free Trial"
- **Hero image:** Keep current dashboard mockup (replace later with real screenshots)

### Section 2: Key Features (`features-section-7`)
- **Heading:** "Everything your business needs"
- **Subheading:** "From billing to payments, all in one app that works on any phone — even without internet."
- 4 feature pills:
  1. ⚡ **10-Second Invoicing** — "Create and share professional invoices faster than writing by hand."
  2. 📱 **100% Offline** — "Bill, track payments, manage stock — all without internet. Syncs when you're back online."
  3. 💬 **WhatsApp Sharing** — "Send PDF invoices to customers on WhatsApp in 2 taps."
  4. 🔒 **Your Data, Always Safe** — "Encrypted backups. Even if you lose your phone, your data is recoverable."

### Section 3: Feature Deep-Dive (`feature-bento-grid`)
- **Heading:** "One app, complete business control"
- **Subheading:** "Invoicing, inventory, payments, reports — all connected, all offline."
- 4 bento cards:
  1. **Smart Invoicing** — "7 document types: Sale, Purchase, Estimate, Proforma, Challan, Credit Note, Debit Note. Auto-number, custom templates, thermal print support."
  2. **Payment Tracking** — "See who owes you at a glance. Send payment reminders on WhatsApp. Record cash, UPI, bank transfer, cheque."
  3. **Inventory Management** — "Real-time stock tracking. Low stock alerts. Party-wise pricing. Purchase orders."
  4. **Reports & Insights** — "Sales reports, stock summary, party statements, day book. Download PDF or share directly."

### Section 4: How It Works (`radial-orbital-timeline`)
- 4 steps:
  1. **Download** — "Get HisaabPro from Play Store or App Store. Takes 30 seconds."
  2. **Setup** — "Add your business name, logo, and first customer. Under 2 minutes."
  3. **Start Billing** — "Create your first invoice and share on WhatsApp. Done in 10 seconds."
  4. **Grow** — "Add staff, track payments, run reports. Your business, organized."

### Section 5: FAQ (`accordion-feature-section`)
- Remove image panel (text-only accordion for FAQ is cleaner)
- 5 questions:
  1. "Is there a free trial?" → "Yes, 14 days with full access to any plan. No credit card required."
  2. "Does it work without internet?" → "100% offline. Create invoices, record payments, manage inventory — all without internet. Your data syncs automatically when you're back online."
  3. "Is my data safe?" → "Your data is encrypted and backed up to the cloud. Even if you lose your phone, log in on a new device and everything is there."
  4. "Can I share invoices on WhatsApp?" → "Yes! Generate a PDF invoice and share it on WhatsApp, Email, or print it — all in 2 taps from the invoice screen."
  5. "How is this different from Vyapar or MyBillBook?" → "HisaabPro works fully offline (not partially), has zero data loss, a modern premium UI, custom staff roles, and faster WhatsApp support."

### Section 6: Pricing (`pricing-section`)
- **Heading:** "Simple, transparent pricing"
- **Subheading:** "Start with a 14-day free trial. No credit card required."
- **Toggle:** Monthly / Yearly
- **3 tiers (auto-recurring subscriptions):**

| | Starter | Pro | Business |
|---|---|---|---|
| Monthly | ~~₹399~~ **₹199/mo** | ~~₹799~~ **₹499/mo** | ~~₹1,499~~ **₹999/mo** |
| Yearly | ~~₹3,999~~ **₹1,999/yr** | ~~₹7,999~~ **₹4,999/yr** | ~~₹14,999~~ **₹9,999/yr** |
| Save (yearly) | ₹2,000/yr | ₹3,000/yr | ₹5,000/yr |
| Badge | — | Most Popular | Best Value |
| Users | 1 | 3 | Unlimited |
| Invoices | Unlimited | Unlimited | Unlimited |
| Offline | Full | Full | Full |
| Reports | Basic | Advanced | Advanced + Export |
| Staff Roles | — | 4 preset roles | Custom role builder |
| Support | Email (48h) | WhatsApp (24h) | WhatsApp (4h) |
| Branding | HisaabPro watermark | Your logo | Your logo + domain |

- **CTA per card:** "Start Free Trial"
- **Fine print:** "Auto-renews. Cancel anytime from Settings."
- **Coupon:** "Have a coupon code?" link (checkout feature — separate PRD)

### Section 7: Testimonials (`testimonial-v2`)
- **Heading:** "Trusted by Indian businesses"
- **Subheading:** "See why business owners are switching to HisaabPro."
- 9 realistic fictional testimonials (Indian names, relatable roles):
  1. Rajesh Sharma, Kirana Store Owner — "Mera purana billing app internet ke bina kaam nahi karta tha. HisaabPro mein sab kuch offline hota hai. Ab bills kabhi nahi kho-te."
  2. Priya Patel, Wholesale Trader — "I have 3 staff members and each one has their own login with limited access. I finally know who did what."
  3. Amit Gupta, Garment Shop — "I send invoices on WhatsApp in 2 taps. My customers love getting professional PDFs instead of handwritten bills."
  4. Sunita Verma, Stationery Shop — "Setting up took 2 minutes. I created my first invoice the same day. Very easy to use."
  5. Mohammed Irfan, Electronics Dealer — "The payment tracking is excellent. I can see who owes me and send reminders directly on WhatsApp."
  6. Kavita Joshi, Boutique Owner — "Beautiful app. My customers think I hired a designer for my invoices. It's just HisaabPro."
  7. Vikram Singh, Hardware Store — "Stock management is automatic. When I sell something, stock updates instantly. No more manual counting."
  8. Neha Agarwal, Beauty Salon — "I was using paper registers for 5 years. Switching to HisaabPro was the best decision for my business."
  9. Deepak Tiwari, Auto Parts Shop — "Reports are clear and simple. End of month I just download PDF and send to my CA. Done."

### Section 8: CTA (`cta-section`)
- **Heading:** "Start billing smarter today."
- **Subheading:** "14-day free trial. No credit card required. Cancel anytime."
- **Primary CTA:** "Start Free Trial"
- **Secondary CTA:** "Contact Us"

### Section 9: Footer (`footer-section`)
- **Logo:** HisaabPro icon + text
- **Copyright:** © 2026 HisaabPro. Made in India.
- **Product:** Features, Pricing, Download
- **Company:** About Us, Privacy Policy, Terms of Service
- **Support:** Help Center, WhatsApp Support, FAQs
- **Social:** Instagram, YouTube, Twitter/X, LinkedIn

## 5. Sections Removed (12)

- `feature-section` — redundant with bento grid
- `feature-hover-effects` — redundant
- `features-section-8` — redundant (39KB file)
- `gallery-section` — case studies, not relevant
- `cybernetic-bento-grid` — off-brand for Indian MSME
- `bento-grid` — redundant with feature-bento-grid
- `features-section-10` — redundant
- `features-section-6` — redundant
- `features-section-5` — redundant
- `database-rest-api` — wrong audience (developers)
- `features-section-11` — already commented out
- `section-with-mockup` — already commented out

## 6. Files to Modify

1. `src/features/landing/LandingPage.tsx` — trim to 7 sections
2. `src/components/ui/saa-s-template.tsx` — hero + nav copy
3. `src/components/ui/features-section-7.tsx` — feature pills copy
4. `src/components/ui/feature-bento-grid.tsx` — deep-dive copy
5. `src/components/ui/radial-orbital-timeline.tsx` — how it works copy
6. `src/components/ui/accordion-feature-section.tsx` — FAQ copy
7. `src/components/ui/pricing-section.tsx` — ₹INR pricing + 3 tiers + strikethrough
8. `src/components/ui/testimonial-v2.tsx` — Indian testimonials
9. `src/components/ui/cta-section.tsx` — final CTA copy
10. `src/components/ui/footer-section.tsx` — HisaabPro branding + links
11. `src/features/landing/components/LandingSEO.tsx` — verify meta tags

## 7. Acceptance Criteria

- [ ] 7 sections + nav + footer (down from 19)
- [ ] Zero placeholder text remaining
- [ ] All copy is HisaabPro-specific, targeting Indian MSMEs
- [ ] Pricing in ₹INR with Indian formatting
- [ ] Strikethrough MRP + discounted price on all tiers
- [ ] Monthly/Yearly toggle with absolute savings shown
- [ ] "Auto-renews. Cancel anytime." fine print
- [ ] 3 pricing tiers: Starter, Pro, Business
- [ ] Testimonials with Indian names and relatable quotes
- [ ] Footer branded as HisaabPro with correct links
- [ ] `tsc --noEmit` passes
- [ ] `npm run build` passes
- [ ] Visually verified at 375px and 1280px

## 8. Out of Scope

- No GST features mentioned (Phase 2)
- No Tally export (Phase 3)
- No actual Play Store / App Store links (pre-launch)
- No coupon input on landing page (separate checkout feature — added to backlog)
- No barcode scanning mention
- No real screenshots (placeholder dashboard for now)
