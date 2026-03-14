# Product Brief — HisaabApp

> **Status:** Draft — Awaiting Approval
> **Date:** 2026-03-14
> **Owner:** Sawan Jaiswal

---

## 1. What Is It?

HisaabApp is a mobile-first business management app for Indian small businesses — billing, inventory, payments, and reports in one app that works offline. It replaces paper registers, Excel sheets, and unreliable competitors (Vyapar/MyBillBook) with a modern, reliable tool built for how Indian businesses actually operate.

## 2. Who Is It For?

### Primary Users

| Persona | Profile | Tech Level | Current Tool | Monthly Revenue | Staff |
|---------|---------|-----------|--------------|----------------|-------|
| **Raju — The Retailer** | Runs a kirana/general store, electronics shop, or hardware store. Solo or 1 helper. Does 20-50 transactions/day. Needs simple billing and "who owes me" tracking. | Low — uses WhatsApp daily, comfortable with apps but not spreadsheets | Paper register, Khatabook, or nothing | Rs 1-5 lakh | 0-1 |
| **Priya — The Growing Wholesaler** | Runs a wholesale/distribution business. 2-5 staff who also bill customers. 50-200 transactions/day. Needs multi-user access, inventory tracking, and customer-specific pricing. | Medium — has tried Vyapar or MyBillBook, frustrated with limitations | Vyapar free / MyBillBook basic | Rs 5-25 lakh | 2-5 |
| **Amit — The Multi-Location Distributor** | Runs a distribution or manufacturing business across 2+ locations. 10+ staff. Needs GST compliance, warehouse management, accounting, and Tally export for CA. | High — knows what TDS/TCS means, has a CA, evaluates software carefully | MyBillBook paid / Tally desktop / Busy | Rs 25 lakh - 2 crore | 5-20 |

### Secondary Users
- **CA / Accountant** — accesses client's data for GST filing, needs Tally export and GSTR reports
- **Salesperson / Staff** — uses the app on their phone with restricted access (can bill but can't see purchase prices or delete invoices)

## 3. What Problem Does It Solve?

Indian small businesses (MSMEs) struggle with:

| Problem | Impact | How Common |
|---------|--------|-----------|
| **No record of who owes what** | Lost revenue — Rs 10-50K/month uncollected | 80% of micro businesses |
| **Paper-based or no billing** | Can't send professional invoices, lose customers to competitors who do | 60% still on paper |
| **GST compliance confusion** | Wrong filing → penalties. Manual filing → expensive CA visits | Every GST-registered business |
| **Inventory guesswork** | Over-ordering (cash stuck) or under-ordering (lost sales) | 70% of product businesses |
| **Can't trust current apps** | Data loss (Vyapar), broken inventory (MyBillBook), no offline (both) | 30-40% of app users have complained |
| **Staff can see/edit everything** | Employees changing prices, deleting transactions | Every multi-staff business |

## 4. How Do They Solve It Today?

| Segment | Current Solution | Why It Fails |
|---------|-----------------|-------------|
| Micro (< Rs 1L/month) | Paper register + calculator | No search, no outstanding tracking, fire/water destroys records |
| Small (Rs 1-10L/month) | Khatabook / OkCredit | Too simple — no invoicing, no inventory, no GST |
| Growing (Rs 10-50L/month) | Vyapar / MyBillBook | Data loss, broken inventory, rigid roles, poor offline, bad support |
| Established (Rs 50L+/month) | Tally / Busy / Zoho | Desktop-only (Tally), expensive (Zoho 3.5x more), complex |

**The gap:** There's no app that is simultaneously **simple** (like Khatabook), **feature-rich** (like Tally), **mobile-first** (unlike Tally), **offline-first** (unlike Vyapar), and **reliable** (unlike MyBillBook).

## 5. Why Will They Switch To Us?

### For Raju (micro/small — currently on paper/Khatabook):
- "Create and WhatsApp a professional invoice in 5 seconds"
- "See who owes you money, send reminder in one tap"
- "Works even without internet"
- **Free forever for basic use**

### For Priya (growing — currently on Vyapar/MyBillBook):
- "Your data never disappears — auto-backup every hour"
- "Set different prices for different customers automatically"
- "Control what your staff can see and do"
- "Works fully offline — even in areas with bad network"
- **Import your existing data — switch in 5 minutes**

### For Amit (established — currently on Tally/paid apps):
- "GST invoicing + e-invoicing + e-way bill on your phone"
- "Tally export — your CA will love it"
- "Manage multiple locations from one app"
- "Real-time inventory across all warehouses"
- **Half the price of competitors with better mobile experience**

### Universal switch triggers (from competitor review analysis):
1. Zero data loss guarantee (auto-backup + offline-first)
2. Fast support via WhatsApp (not months-long tickets)
3. Inventory that actually works (atomic stock updates)
4. Custom roles (not rigid presets)
5. Modern UI that doesn't look like 2015

## 6. Success Metrics

| Metric | Target | Timeframe |
|--------|--------|-----------|
| MVP shipped | Feature-complete, 0 critical bugs | Week 12 |
| Beta users | 10 real businesses using daily | Week 14 |
| Zero data loss incidents | 0 reported in beta | Week 14-16 |
| Paid conversions | 100 paying users | Month 6 |
| Retention | 60% DAU/MAU (daily active / monthly active) | Month 6 |
| NPS | > 50 (promoter score) | Month 6 |
| Revenue | Rs 50K MRR | Month 9 |
| Users | 1000 registered | Month 9 |

## 7. What We Are NOT Building (Anti-Scope)

| Not Building | Why |
|-------------|-----|
| Full ERP (manufacturing, HR, CRM all-in-one) | Too complex for MVP. Add modules later. |
| Desktop-first app | We're mobile-first. Desktop via PWA/web is secondary. |
| Marketplace / e-commerce platform | Online store is a feature, not a marketplace. |
| Custom accounting for specific industries | Generic first. Vertical modes in Phase 7. |
| White-label / reseller solution | Not until 10K+ users. |
| Integration with 50+ third-party tools | Tally export + WhatsApp + Razorpay = enough for MVP. |
| AI features in MVP | Phase 7. Need usage data first. |

## 8. Business Model

| Tier | Price | Target | Key Feature Gate |
|------|-------|--------|-----------------|
| **Free** | Rs 0 forever | Raju (micro) | 1 user, 50 invoices/month, basic reports, no GST |
| **Pro** | Rs 299/month or Rs 2,499/year | Priya (growing) | Unlimited invoices, 3 users, GST, custom roles, priority support |
| **Business** | Rs 599/month or Rs 4,999/year | Amit (established) | Unlimited users, multi-godown, POS, Tally export, e-invoicing |

**Pricing philosophy:** Undercut MyBillBook (Rs 399/yr Silver) on free tier generosity. Match on Pro. Win on value at Business tier.

## 9. Competitive Moat (What's Hard to Copy)

1. **Offline-first architecture** — built into the core, not bolted on. 18 months of battle-testing in DudhHisaab.
2. **Reused production-tested infrastructure** — auth, payments, subscriptions, notifications, backup from 1+ year of real users.
3. **Mobile-first UX** — competitors are desktop-first adapting to mobile. We're mobile-first adapting to desktop.
4. **Speed of iteration** — small team, fast decisions, fix bugs in days not months.
5. **India-specific design** — Hindi support, WhatsApp-native, UPI-first, works on Rs 8000 phones with 2G.

## 10. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 19 + TypeScript + Tailwind CSS 4 | From DudhHisaab, proven |
| Mobile | Capacitor 8 (PWA + native) | Single codebase, iOS + Android |
| Backend | Node.js + Express + TypeScript | From DudhHisaab, proven |
| Database | PostgreSQL + Prisma ORM | From DudhHisaab, proven |
| Offline | IndexedDB (Dexie) + Service Worker | From DudhHisaab, battle-tested |
| Payments | Razorpay | From DudhHisaab, integrated |
| Notifications | FCM + Aisensy (WhatsApp) + Resend (email) | From DudhHisaab |
| Auth | JWT + OTP + 2FA | From DudhHisaab |
| Deployment | Vercel (frontend) + Render (backend) | From DudhHisaab |
| PDF | React-PDF or Puppeteer | New — for invoice generation |

---

## Approval

- [ ] Sawan reviewed and approved
- [ ] Personas validated against real businesses
- [ ] Pricing validated against market
- [ ] Anti-scope agreed
