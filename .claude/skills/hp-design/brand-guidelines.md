# HisaabPro Brand Guidelines

## Brand Identity

| Attribute | Value |
|-----------|-------|
| **Name** | HisaabPro |
| **Hindi** | हिसाब प्रो |
| **Meaning** | "Professional Accounts" |
| **Domain** | hisaabpro.in |
| **Tagline** | Smart billing for Indian businesses |
| **Industry** | Business Management / Billing / SaaS |
| **Audience** | Indian MSMEs — retailers, wholesalers, distributors |
| **Competitors** | Vyapar (15M+), MyBillBook (9.7M+), Khatabook |

## Logo

- **Config**: `src/config/app.config.ts` — `APP_NAME`, `APP_DOMAIN`
- PWA icons in `public/`: icon-192, icon-512, maskable variants
- Favicon: `favicon.ico`, `favicon-16.png`, `favicon-32.png`
- Apple: `apple-touch-icon.png`

### Logo Usage Rules
- Always use app name from `app.config.ts` — never hardcode "HisaabPro"
- Minimum clear space: 8px around all sides
- Never stretch, rotate, or recolor the logo

## Brand Voice

| Attribute | Description |
|-----------|-------------|
| **Tone** | Premium yet accessible — "this looks expensive and it's free?" |
| **Language** | English + Hindi (i18n via `translations.ts`). All strings via `t.keyName` |
| **Numbers** | Indian format: `₹1,00,000` (not `₹100,000`). Use `Intl.NumberFormat('en-IN')` |
| **Units** | Pieces (pcs), Kilograms (kg), Litres (L), Boxes, Rupees (₹) |
| **Dates** | DD/MM/YYYY (Indian standard) |
| **Currency** | All amounts stored in **paise** (integer), displayed in **rupees** |

## Visual Identity

### Design Inspiration
- **Primary**: NexoWallet by InksStudio (ui8.net) — layout/warm cream base; brand hue re-themed to deep emerald green (#026F39)
- **Feature depth**: MyBillBook — but beat them on design quality
- **Polish level**: Cred/Jupiter/Fi — premium fintech aesthetic for business users

### Color Philosophy
- **Deep Emerald Green** (#026F39): Trust, growth, money — the brand primary
  (migrated 2026-07 from deep teal #0B4F5E). Used for identity, primary CTAs,
  nav-active, FAB, and dark hero surfaces.
- **Success green** (#22C55E): a SEPARATE, brighter green reserved for status
  only (paid / up / good) — never brand or CTA. Keep the two greens distinct.
- **Lime-Yellow** (#E0EA49): Energy, modernity, CTA emphasis
- **Warm cream** (#F8F7F4): Premium, elegant, NOT cold sterile white
- **Warm neutrals**: Warm-tinted grays (#2A2824), NOT cold blue-grays (#374151)

### Design Principles
1. **Emerald Hero two-tone** — the signature layout (see below): every primary
   screen recolours its header to deep emerald and lifts its content off a
   white rounded sheet. Home + Party detail are the reference skins.
2. **Numbers are heroes** — largest, boldest treatment for amounts
3. **Sunlight-first** — high contrast (5.5:1+ WCAG AA), readable outdoors
4. **Thumb-friendly** — 44px+ touch targets, bottom-anchored CTAs
5. **Warm cream aesthetic** — NexoWallet signature, not generic white
6. **Minimal shadows** — optimized for budget Rs 8K-15K Android phones
7. **Two densities, on purpose** — HisaabPro serves both a shopkeeper glancing
   at his phone AND an accountant scanning a day book. So the app runs two
   densities, chosen per surface, never mixed within one screen:
   - **Consumer-comfortable** (default) — Raju the micro-retailer. Spaced,
     scannable, thumb-first: ≥44px rows, tinted icon-square list items, generous
     whitespace (Zerodha Kite / Cred calm). This is every list, detail, form,
     and settings screen (archetypes A–N).
     - **Accounting-compact** — Priya & Amit doing real bookkeeping. Dense grids
     that show more rows per screen: ~36px rows, `tabular-nums`, right-aligned
     numbers, zebra striping, sticky headers, totals rows (archetype O — day
     book, trial balance, stock register, GST tables). Opt-in via
     `<ResponsiveTable density="compact" alwaysTable zebra>`.
   Compact is *earned* by the data — never a shortcut to cram consumer screens.
   The page chrome around a grid (header, toolbar, CTAs) stays comfortable.

### Signature Layout — Emerald Hero (skin v2, 2026-07)
The defining look of the app. One continuous field split in two:
- The global **header recolours to deep emerald** (`--color-hero-surface`,
  #003121) with white title + white icons — no seam between OS bar and app.
- A **hero field** on the emerald holds the greeting / summary tiles / hero
  amount (white text, `--color-hero-text-secondary` for labels).
- The **main content lifts off in a white rounded sheet** (`--radius-xl` top
  corners, `--shadow-drawer-inset`), overlapping the emerald by `space-4`.

Reusable primitive: `HeroPage` (`src/components/layout/HeroPage.tsx`). Reference
implementations: `DashboardPage` (Home 2) and `PartyDetailPage`. Never hand-roll
a dark-header + white-sheet — mount `HeroPage`.

## Indian-Specific Requirements

| Feature | Implementation |
|---------|---------------|
| Number format | `Intl.NumberFormat('en-IN')` — Rs 1,00,000 |
| UPI payments | First-class citizen, not afterthought |
| WhatsApp sharing | One-tap invoice share via deep link |
| Thermal printing | 58mm/80mm receipt support |
| Offline-first | Works on 2G/3G networks |
| Low-end phones | First paint < 2s on Rs 8K devices |
| Hindi support | i18n from day 1, 160+ translation keys |

## Do's and Don'ts

### Do
- Use CSS variables for ALL colors — auto-adapts to dark mode
- Use Indian number formatting (₹, paise, kg, pcs)
- Use Hindi+English strings via `t.keyName`
- Keep UI warm (warm cream, warm grays) and premium
- Use `tabular-nums` on all financial figures

### Don't
- Don't use raw hex values — use `var(--color-*)` tokens
- Don't use Tailwind color classes (`bg-green-500`) — use CSS variables
- Don't hardcode English strings — use `t.keyName`
- Don't use cold blue-gray neutrals — use warm-tinted neutrals
- Don't use aggressive red for amounts owed — use subtle error-50 backgrounds
- Don't hardcode "HisaabPro" — import from `app.config.ts`
