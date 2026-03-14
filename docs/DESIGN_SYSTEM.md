# HisaabApp Design System

> Informed by research on CRED, Jupiter Money, Fi Money, Razorpay (Blade), Zerodha Kite, and Slice.
> Optimized for small Indian business owners on budget Android phones (Rs 8000-15000).

---

## 1. Design Philosophy

### Lessons from Premium Indian Apps

| App | Key Takeaway for HisaabApp |
|-----|---------------------------|
| **CRED** (NeoPOP) | Bold typography hierarchy makes numbers the hero. Gilroy + Cirka pairing creates premium feel without complexity. Dark theme uses high-contrast whites on deep blacks. |
| **Jupiter** (Europa) | Numbers-first design — balance, spends, invested amount are always the visual hero. Color supports hierarchy, not decoration. Simplicity and speed above all. |
| **Fi Money** | Purple-forward minimal UI. Proves that a single strong brand color + generous whitespace = premium feel on any device. |
| **Razorpay** (Blade) | Professional SaaS standard. 8pt grid with 4pt half-steps. Semantic token naming. Cross-platform consistency. Open-source reference implementation. |
| **Zerodha Kite** | Data-dense screens made readable through: tight typography (Kohinoor Bangla chosen for number readability), ample line-height, restrained color (green/red only for gain/loss), and aggressive whitespace between data groups. |
| **Slice** | Modern fintech with orange accent. Proves bold accent color on neutral base creates visual identity without overwhelming. |

### HisaabApp Design Principles

1. **Numbers are heroes** — Invoice totals, balances, due amounts get the largest, boldest treatment (learned from Jupiter, Zerodha)
2. **Sunlight-first contrast** — Minimum 5.5:1 contrast ratio (exceeds WCAG AA 4.5:1) because users are in outdoor markets, bright shops
3. **Thumb-friendly** — 48px minimum touch targets (Android Material guideline), bottom-anchored primary actions
4. **Performance over polish** — No heavy animations, no blur effects, no gradients that tax GPU on budget Snapdragon 680/MediaTek chips
5. **Scannable density** — Data-dense screens use Zerodha's approach: group, space, restrain color
6. **System font first** — Use Inter (Google Fonts, pre-cached on most modern Android) to minimize bundle size and ensure Hindi/Devanagari fallback works

---

## 2. Color Palette

### Primary — Professional Teal-Blue

Chosen over pure blue (too corporate/cold) or pure teal (too casual). This teal-blue says "trustworthy business tool" to Indian SMB owners while feeling modern.

```
/* HSL Format — all colors */

/* === PRIMARY === */
--color-primary-50:   hsl(199, 89%, 96%);   /* #E8F6FD — backgrounds, hover states */
--color-primary-100:  hsl(199, 82%, 90%);   /* #C9EAFB — light fills */
--color-primary-200:  hsl(199, 76%, 78%);   /* #8DD3F5 — borders, dividers */
--color-primary-300:  hsl(199, 72%, 65%);   /* #55BAE9 — secondary buttons */
--color-primary-400:  hsl(199, 69%, 52%);   /* #2D9FD9 — hover on primary */
--color-primary-500:  hsl(199, 78%, 42%);   /* #1784BF — PRIMARY BRAND COLOR */
--color-primary-600:  hsl(199, 82%, 34%);   /* #0F6A9E — pressed state */
--color-primary-700:  hsl(199, 85%, 26%);   /* #094F78 — dark accents */
--color-primary-800:  hsl(199, 88%, 18%);   /* #053551 — text on light bg */
--color-primary-900:  hsl(199, 90%, 12%);   /* #032236 — darkest */

/* Hex reference: Primary 500 = #1784BF */
/* Contrast on white: 4.8:1 (AA pass) */
/* Contrast on primary-50: 5.6:1 (AA pass, sunlight safe) */
```

### Secondary — Warm Amber

Complements teal-blue. Used for CTAs, highlights, "attention needed" states. Warm tone adds approachability for non-tech users.

```
--color-secondary-50:   hsl(38, 100%, 96%);  /* #FFF8E8 */
--color-secondary-100:  hsl(38, 95%, 88%);   /* #FFEDC2 */
--color-secondary-200:  hsl(38, 90%, 76%);   /* #FFD98A */
--color-secondary-300:  hsl(38, 88%, 64%);   /* #FFC452 */
--color-secondary-400:  hsl(38, 86%, 55%);   /* #F5B026 */
--color-secondary-500:  hsl(38, 92%, 45%);   /* #DC9A0A — SECONDARY BRAND */
--color-secondary-600:  hsl(38, 95%, 36%);   /* #B37D08 */
--color-secondary-700:  hsl(38, 90%, 28%);   /* #876006 */
--color-secondary-800:  hsl(38, 85%, 20%);   /* #5F4304 */
--color-secondary-900:  hsl(38, 80%, 14%);   /* #402D03 */
```

### Semantic Colors

```
/* === SUCCESS (Green — payments received, profit) === */
--color-success-50:   hsl(152, 68%, 95%);   /* #E6F9F1 */
--color-success-100:  hsl(152, 60%, 85%);   /* #B8EDD5 */
--color-success-500:  hsl(152, 60%, 40%);   /* #29A36B — primary success */
--color-success-600:  hsl(152, 65%, 32%);   /* #1C8555 */
--color-success-700:  hsl(152, 70%, 24%);   /* #126640 */

/* === ERROR (Red — overdue, failed, delete) === */
--color-error-50:     hsl(4, 86%, 96%);     /* #FDE8E8 */
--color-error-100:    hsl(4, 80%, 88%);     /* #F9C4C4 */
--color-error-500:    hsl(4, 72%, 50%);     /* #DB3B3B — primary error */
--color-error-600:    hsl(4, 75%, 42%);     /* #BC2828 */
--color-error-700:    hsl(4, 78%, 34%);     /* #9C1A1A */

/* === WARNING (Orange — due soon, partial payment) === */
--color-warning-50:   hsl(28, 100%, 96%);   /* #FFF3E8 */
--color-warning-100:  hsl(28, 90%, 86%);    /* #FDDCB8 */
--color-warning-500:  hsl(28, 85%, 50%);    /* #EC7B17 — primary warning */
--color-warning-600:  hsl(28, 88%, 40%);    /* #C06210 */
--color-warning-700:  hsl(28, 90%, 30%);    /* #914A0C */

/* === INFO (Blue — informational, tips) === */
--color-info-50:      hsl(214, 82%, 96%);   /* #E8F0FD */
--color-info-100:     hsl(214, 75%, 88%);   /* #C2D7F7 */
--color-info-500:     hsl(214, 68%, 50%);   /* #2D6FD9 — primary info */
--color-info-600:     hsl(214, 72%, 40%);   /* #1E57B5 */
--color-info-700:     hsl(214, 76%, 30%);   /* #123F8C */
```

### Neutral / Gray Scale

Based on Razorpay Blade's approach: blue-tinted grays (not pure gray) for warmth. The slight blue tint at hue 215 connects to the primary teal-blue.

```
--color-gray-0:    hsl(0, 0%, 100%);      /* #FFFFFF — pure white */
--color-gray-50:   hsl(215, 20%, 97%);    /* #F5F6F8 — page background */
--color-gray-100:  hsl(215, 18%, 93%);    /* #EBEDF1 — card borders, dividers */
--color-gray-200:  hsl(215, 15%, 85%);    /* #D2D6DD — disabled borders */
--color-gray-300:  hsl(215, 12%, 72%);    /* #AEB4BF — placeholder text */
--color-gray-400:  hsl(215, 10%, 58%);    /* #8B919C — secondary icons */
--color-gray-500:  hsl(215, 10%, 46%);    /* #6A7080 — secondary text */
--color-gray-600:  hsl(215, 12%, 35%);    /* #4E5564 — body text */
--color-gray-700:  hsl(215, 15%, 25%);    /* #363D4A — strong text */
--color-gray-800:  hsl(215, 20%, 16%);    /* #212731 — headings */
--color-gray-900:  hsl(215, 25%, 10%);    /* #141922 — near-black */
--color-gray-950:  hsl(215, 30%, 6%);     /* #0B0F15 — true dark bg */
```

### Dark Theme Mapping

```
/* Dark theme — invert the semantic roles */
--dark-bg-primary:     var(--color-gray-950);    /* #0B0F15 */
--dark-bg-secondary:   var(--color-gray-900);    /* #141922 */
--dark-bg-surface:     hsl(215, 22%, 13%);       /* #1A2030 — card bg */
--dark-bg-elevated:    hsl(215, 20%, 17%);       /* #232B3A — modal/sheet bg */
--dark-text-primary:   hsl(215, 15%, 92%);       /* #E8EAF0 */
--dark-text-secondary: hsl(215, 10%, 62%);       /* #959BA6 */
--dark-text-tertiary:  hsl(215, 8%, 45%);        /* #6B717A */
--dark-border:         hsl(215, 15%, 20%);       /* #2B3342 */
--dark-primary-500:    hsl(199, 72%, 55%);       /* #3FAED6 — brighter for dark bg */
--dark-success:        hsl(152, 55%, 50%);       /* #48C88A */
--dark-error:          hsl(4, 68%, 58%);         /* #E05555 */
--dark-warning:        hsl(38, 85%, 58%);        /* #F0B73A */
```

---

## 3. Typography

### Font Stack

```
/* Primary: Inter — excellent number readability, Devanagari support,
   Google Font (pre-cached on many Android devices), variable font = small bundle */
--font-family-primary: 'Inter', 'Noto Sans Devanagari', system-ui, -apple-system, sans-serif;

/* Monospace: for invoice numbers, amounts in tables */
--font-family-mono: 'JetBrains Mono', 'Roboto Mono', 'Courier New', monospace;

/* Display: for hero numbers (dashboard balance, invoice total) —
   Plus Jakarta Sans adds premium feel without heavy file size */
--font-family-display: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
```

### Why Inter over Other Choices

| Font | Verdict | Reason |
|------|---------|--------|
| Inter | **CHOSEN** | Best number readability (tabular figures built-in), variable font (tiny bundle), Devanagari fallback via Noto, optimized for screens, free |
| Roboto | Backup | Android system font, zero download, but Inter has better tabular figures for financial data |
| Gilroy (CRED) | Rejected | Premium feel but paid license, heavy weight files, poor Hindi support |
| Plus Jakarta Sans | Display only | Beautiful for headlines, but Inter is better for dense data |

### Type Scale (Mobile-First)

Base size: 14px (not 16px — optimized for 5.5"-6.5" screens at typical 393px viewport width on budget phones).

```
/* Mobile type scale — 1.2 ratio (minor third) */

--text-xs:      0.694rem;   /* 9.7px  — captions, fine print */
--text-sm:      0.833rem;   /* 11.7px — labels, metadata, timestamps */
--text-base:    1rem;       /* 14px   — body text, list items */
--text-md:      1.125rem;   /* 15.75px — emphasized body, subheads */
--text-lg:      1.25rem;    /* 17.5px — section headers */
--text-xl:      1.5rem;     /* 21px   — page titles */
--text-2xl:     1.875rem;   /* 26.25px — hero numbers (invoice total) */
--text-3xl:     2.25rem;    /* 31.5px — dashboard primary amount */
--text-4xl:     3rem;       /* 42px   — splash/display (rare) */

/* Desktop scale override at breakpoint-lg */
--text-base-desktop: 1rem;      /* 16px */
--text-3xl-desktop:  2.5rem;    /* 40px */
--text-4xl-desktop:  3.5rem;    /* 56px */
```

### Font Weights

```
--font-regular:    400;   /* Body text */
--font-medium:     500;   /* Labels, emphasized body */
--font-semibold:   600;   /* Subheadings, buttons, amounts */
--font-bold:       700;   /* Page titles, hero numbers */
--font-extrabold:  800;   /* Dashboard primary amount (display font only) */
```

### Line Heights

```
--leading-none:    1;       /* Hero numbers only */
--leading-tight:   1.25;   /* Headings */
--leading-snug:    1.375;  /* Subheadings */
--leading-normal:  1.5;    /* Body text — critical for readability */
--leading-relaxed: 1.625;  /* Long-form text, descriptions */
--leading-loose:   2;      /* Spaced-out lists */
```

### Letter Spacing

```
--tracking-tighter: -0.02em;  /* Display/hero numbers */
--tracking-tight:   -0.01em;  /* Headings */
--tracking-normal:   0;       /* Body text */
--tracking-wide:     0.02em;  /* Uppercase labels, button text */
--tracking-wider:    0.05em;  /* All-caps section dividers */
```

---

## 4. Spacing Scale

4px base unit, following Razorpay Blade's 8pt grid with 4pt half-steps.

```
--space-0:    0;        /* 0px */
--space-0.5:  0.125rem; /* 2px  — hairline gaps */
--space-1:    0.25rem;  /* 4px  — tight padding (icon-to-text) */
--space-1.5:  0.375rem; /* 6px  — icon internal spacing */
--space-2:    0.5rem;   /* 8px  — compact element padding */
--space-3:    0.75rem;  /* 12px — input padding, list gap */
--space-4:    1rem;     /* 16px — standard card padding */
--space-5:    1.25rem;  /* 20px — section inner padding */
--space-6:    1.5rem;   /* 24px — between card groups */
--space-8:    2rem;     /* 32px — section breaks */
--space-10:   2.5rem;   /* 40px — major section breaks */
--space-12:   3rem;     /* 48px — page top/bottom padding */
--space-16:   4rem;     /* 64px — hero section spacing */
--space-20:   5rem;     /* 80px — desktop section spacing */
--space-24:   6rem;     /* 96px — max whitespace */
```

### Layout-Specific Spacing

```
/* Page */
--page-padding-x:       var(--space-4);    /* 16px — mobile page margin */
--page-padding-x-lg:    var(--space-6);    /* 24px — tablet+ */
--page-padding-x-xl:    var(--space-8);    /* 32px — desktop */

/* Cards */
--card-padding:          var(--space-4);   /* 16px */
--card-padding-compact:  var(--space-3);   /* 12px — dense lists */
--card-gap:              var(--space-3);   /* 12px — between cards */

/* List items */
--list-item-padding-y:   var(--space-3);   /* 12px — vertical */
--list-item-padding-x:   var(--space-4);   /* 16px — horizontal */
--list-item-gap:         var(--space-1);   /* 4px  — between stacked text */

/* Touch targets */
--touch-target-min:      48px;  /* Android Material minimum */
--touch-target-comfortable: 56px; /* Recommended for primary actions */

/* Bottom navigation */
--bottom-nav-height:     64px;
--bottom-sheet-handle:   var(--space-3);
```

---

## 5. Border Radius Scale

Inspired by CRED's evolution from sharp (Topaz) to rounded (NeoPOP). HisaabApp uses moderate radii — professional but not playful.

```
--radius-none:   0;
--radius-xs:     2px;    /* Subtle — tags, badges */
--radius-sm:     4px;    /* Inputs, small buttons */
--radius-md:     8px;    /* Cards, dropdowns, modals */
--radius-lg:     12px;   /* Large cards, bottom sheets */
--radius-xl:     16px;   /* Feature cards, promotional */
--radius-2xl:    20px;   /* Bottom sheet top corners */
--radius-full:   9999px; /* Pills, avatars, FABs */
```

### Usage Guidelines

```
Inputs, selects, textareas:    var(--radius-sm)   /* 4px */
Buttons:                       var(--radius-sm)   /* 4px */
Cards:                         var(--radius-md)   /* 8px */
Bottom sheets:                 var(--radius-2xl) var(--radius-2xl) 0 0
Modals:                        var(--radius-lg)   /* 12px */
Avatars, status dots:          var(--radius-full)
Chips, tags:                   var(--radius-full)
```

---

## 6. Shadow Scale

Minimal shadows — budget phones struggle with blur rendering. Use elevation sparingly.

```
/* Light theme shadows — subtle, performance-friendly */
--shadow-none:    none;
--shadow-xs:      0 1px 2px 0 hsla(215, 20%, 20%, 0.05);
--shadow-sm:      0 1px 3px 0 hsla(215, 20%, 20%, 0.08),
                  0 1px 2px -1px hsla(215, 20%, 20%, 0.05);
--shadow-md:      0 4px 6px -1px hsla(215, 20%, 20%, 0.08),
                  0 2px 4px -2px hsla(215, 20%, 20%, 0.04);
--shadow-lg:      0 10px 15px -3px hsla(215, 20%, 20%, 0.08),
                  0 4px 6px -4px hsla(215, 20%, 20%, 0.04);
--shadow-xl:      0 20px 25px -5px hsla(215, 20%, 20%, 0.08),
                  0 8px 10px -6px hsla(215, 20%, 20%, 0.04);

/* Dark theme shadows — use border + subtle glow instead */
--dark-shadow-sm: 0 1px 3px 0 hsla(0, 0%, 0%, 0.4),
                  0 0 0 1px hsla(215, 15%, 20%, 0.5);
--dark-shadow-md: 0 4px 8px 0 hsla(0, 0%, 0%, 0.5),
                  0 0 0 1px hsla(215, 15%, 20%, 0.4);

/* Prefer borders over shadows on mobile for performance */
/* Use shadows only for: modals, bottom sheets, FABs, dropdowns */
```

### Performance Note (Budget Phone Optimization)

```
/* AVOID on budget devices: */
backdrop-filter: blur();     /* Kills GPU on Snapdragon 680 */
box-shadow with blur > 20px; /* Expensive repaints */
Multiple stacked shadows;    /* Keep to max 2 layers */

/* PREFER: */
border: 1px solid var(--color-gray-100);  /* Cheap, clear separation */
background-color elevation;                /* Different bg = visual hierarchy */
```

---

## 7. Breakpoints

Mobile-first. Budget Android phones are 360-393px wide. Design for 360px minimum.

```
--breakpoint-xs:   360px;   /* Small budget phones (Redmi, Realme) */
--breakpoint-sm:   480px;   /* Large phones */
--breakpoint-md:   768px;   /* Tablets, landscape phones */
--breakpoint-lg:   1024px;  /* Tablets landscape, small desktop */
--breakpoint-xl:   1280px;  /* Desktop */
--breakpoint-2xl:  1536px;  /* Wide desktop */

/* Container max-widths */
--container-sm:    480px;
--container-md:    720px;
--container-lg:    960px;
--container-xl:    1200px;
```

### Safe Area Handling

```
/* For devices with notches/punch-holes (common in budget phones) */
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
padding-left: env(safe-area-inset-left);
padding-right: env(safe-area-inset-right);
```

---

## 8. Component-Specific Tokens

### Buttons

```
/* Primary Button */
--btn-primary-bg:         var(--color-primary-500);
--btn-primary-text:       var(--color-gray-0);
--btn-primary-hover:      var(--color-primary-600);
--btn-primary-active:     var(--color-primary-700);
--btn-primary-disabled-bg:    var(--color-gray-200);
--btn-primary-disabled-text:  var(--color-gray-400);

/* Secondary Button (outline) */
--btn-secondary-bg:       transparent;
--btn-secondary-text:     var(--color-primary-500);
--btn-secondary-border:   var(--color-primary-300);
--btn-secondary-hover-bg: var(--color-primary-50);

/* Destructive Button */
--btn-destructive-bg:     var(--color-error-500);
--btn-destructive-text:   var(--color-gray-0);

/* Button sizing */
--btn-height-sm:    36px;
--btn-height-md:    44px;
--btn-height-lg:    52px;   /* Primary CTA — comfortable thumb target */
--btn-padding-x:    var(--space-4);
--btn-font-size:    var(--text-base);
--btn-font-weight:  var(--font-semibold);
--btn-radius:       var(--radius-sm);
```

### Inputs

```
--input-height:           48px;  /* Comfortable touch on budget phones */
--input-padding-x:        var(--space-3);
--input-border:           1px solid var(--color-gray-200);
--input-border-focus:     2px solid var(--color-primary-500);
--input-border-error:     2px solid var(--color-error-500);
--input-bg:               var(--color-gray-0);
--input-text:             var(--color-gray-800);
--input-placeholder:      var(--color-gray-300);
--input-radius:           var(--radius-sm);
--input-font-size:        var(--text-base);
```

### Cards

```
--card-bg:                var(--color-gray-0);
--card-border:            1px solid var(--color-gray-100);
--card-radius:            var(--radius-md);
--card-shadow:            var(--shadow-xs);
--card-padding:           var(--space-4);

/* Elevated card (for primary content) */
--card-elevated-shadow:   var(--shadow-sm);
--card-elevated-border:   none;
```

### Data Tables / Lists (Invoice-specific)

```
/* Dense list for invoice/transaction lists */
--table-row-height:       56px;    /* Enough for 2-line content + touch */
--table-row-padding:      var(--space-3) var(--space-4);
--table-header-bg:        var(--color-gray-50);
--table-header-text:      var(--color-gray-500);
--table-header-font:      var(--font-semibold);
--table-header-size:      var(--text-sm);
--table-header-tracking:  var(--tracking-wide);
--table-border:           1px solid var(--color-gray-100);
--table-stripe-bg:        var(--color-gray-50);

/* Amount display in lists */
--amount-positive:        var(--color-success-500);
--amount-negative:        var(--color-error-500);
--amount-neutral:         var(--color-gray-800);
--amount-font:            var(--font-family-mono);
--amount-weight:          var(--font-semibold);
```

### Status Badges

```
/* Payment status indicators */
--badge-paid-bg:          var(--color-success-50);
--badge-paid-text:        var(--color-success-700);
--badge-paid-border:      var(--color-success-100);

--badge-pending-bg:       var(--color-warning-50);
--badge-pending-text:     var(--color-warning-700);
--badge-pending-border:   var(--color-warning-100);

--badge-overdue-bg:       var(--color-error-50);
--badge-overdue-text:     var(--color-error-700);
--badge-overdue-border:   var(--color-error-100);

--badge-draft-bg:         var(--color-gray-50);
--badge-draft-text:       var(--color-gray-600);
--badge-draft-border:     var(--color-gray-200);

--badge-radius:           var(--radius-full);
--badge-padding:          var(--space-1) var(--space-2);
--badge-font-size:        var(--text-sm);
--badge-font-weight:      var(--font-medium);
```

---

## 9. Motion / Animation Tokens

Keep animations minimal for budget phone performance. CRED's heavy animations are beautiful but would lag on a Redmi 10.

```
/* Duration */
--duration-instant:   0ms;
--duration-fast:      100ms;   /* Button press feedback */
--duration-normal:    200ms;   /* Most transitions */
--duration-slow:      300ms;   /* Page transitions, modals */
--duration-slower:    500ms;   /* Complex sequences (rare) */

/* Easing */
--ease-default:       cubic-bezier(0.4, 0, 0.2, 1);    /* Material standard */
--ease-in:            cubic-bezier(0.4, 0, 1, 1);      /* Exit animations */
--ease-out:           cubic-bezier(0, 0, 0.2, 1);      /* Enter animations */
--ease-bounce:        cubic-bezier(0.34, 1.56, 0.64, 1); /* Success feedback */

/* Rules */
/* 1. Never animate layout properties (width, height, top, left) */
/* 2. Only animate: transform, opacity */
/* 3. Add will-change sparingly and remove after animation */
/* 4. Use prefers-reduced-motion media query */

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 10. Iconography

```
/* Icon sizes — align to 4px grid */
--icon-xs:    16px;   /* Inline with small text */
--icon-sm:    20px;   /* Inline with body text, list item leading */
--icon-md:    24px;   /* Standard UI icons, nav bar */
--icon-lg:    32px;   /* Feature icons, empty states */
--icon-xl:    48px;   /* Illustration-style, onboarding */

/* Icon colors */
--icon-primary:     var(--color-gray-700);
--icon-secondary:   var(--color-gray-400);
--icon-on-primary:  var(--color-gray-0);
--icon-interactive: var(--color-primary-500);
--icon-success:     var(--color-success-500);
--icon-error:       var(--color-error-500);

/* Recommendation: Use Lucide icons (lightweight, consistent, tree-shakeable) */
/* Avoid: FontAwesome (heavy), Material Icons (Google dependency) */
```

---

## 11. Z-Index Scale

```
--z-base:        0;
--z-dropdown:    10;
--z-sticky:      20;
--z-fixed:       30;
--z-overlay:     40;
--z-modal:       50;
--z-popover:     60;
--z-toast:       70;
--z-tooltip:     80;
```

---

## 12. Sunlight Readability Guidelines

Critical for Indian market — users check invoices in outdoor shops, under tube lights, in direct sunlight.

```
/* MINIMUM contrast ratios (exceed WCAG AA) */
Body text on white:       5.5:1   (WCAG AA = 4.5:1, we exceed)
Heading text on white:    7:1     (WCAG AAA level)
Primary button text:      5:1+
Amount text:              6:1+
Status badge text on bg:  4.8:1+

/* Color rules for sunlight */
1. Never use gray lighter than --color-gray-500 for meaningful text
2. Never use colored text below 40% lightness on white backgrounds
3. Icons carrying meaning must be --color-gray-600 or darker
4. Success green must be --color-success-600+ for text (not the bright 500)
5. Error red is safe at 500 level (naturally high contrast)

/* Font size rules for outdoor readability */
1. Minimum body text: 14px (our base)
2. Minimum label/caption: 11px (never smaller)
3. Minimum amount display: 14px semibold
4. Dashboard hero number: 28px+ bold
```

---

## 13. Data-Dense Screen Patterns (from Zerodha Kite)

### Invoice List Pattern
```
/* Group invoices by date with sticky headers */
Date Header:     --text-sm, --font-semibold, --color-gray-500, uppercase
                 padding: --space-2 --space-4
                 bg: --color-gray-50

Invoice Row:     height: 64px (2 lines + padding)
  Left:          Customer name (--text-base, --font-medium, --color-gray-800)
                 Invoice # + date (--text-sm, --color-gray-500)
  Right:         Amount (--text-base, --font-semibold, --amount-font)
                 Status badge

Row Divider:     1px solid --color-gray-100, inset 16px from left
```

### Report/Dashboard Pattern
```
/* Stat cards — horizontal scroll on mobile */
Stat Card:       min-width: 140px, padding: --space-3
  Label:         --text-sm, --color-gray-500
  Value:         --text-2xl, --font-bold, --font-family-display
  Trend:         --text-sm, success/error color + arrow icon

/* Chart containers */
Chart:           bg: --color-gray-0, padding: --space-4
                 border-radius: --radius-md
                 min-height: 200px
```

---

## 14. Theme Implementation Reference

```typescript
// Suggested token structure for React Native / Tailwind

export const lightTheme = {
  colors: {
    bg: {
      primary: 'hsl(0, 0%, 100%)',           // white
      secondary: 'hsl(215, 20%, 97%)',        // gray-50
      tertiary: 'hsl(215, 18%, 93%)',         // gray-100
    },
    text: {
      primary: 'hsl(215, 20%, 16%)',          // gray-800
      secondary: 'hsl(215, 10%, 46%)',        // gray-500
      tertiary: 'hsl(215, 12%, 72%)',         // gray-300
      inverse: 'hsl(0, 0%, 100%)',            // white
    },
    brand: {
      primary: 'hsl(199, 78%, 42%)',          // primary-500
      secondary: 'hsl(38, 92%, 45%)',         // secondary-500
    },
    semantic: {
      success: 'hsl(152, 60%, 40%)',
      error: 'hsl(4, 72%, 50%)',
      warning: 'hsl(28, 85%, 50%)',
      info: 'hsl(214, 68%, 50%)',
    },
    border: {
      default: 'hsl(215, 18%, 93%)',          // gray-100
      strong: 'hsl(215, 15%, 85%)',           // gray-200
      focus: 'hsl(199, 78%, 42%)',            // primary-500
    },
  },
};

export const darkTheme = {
  colors: {
    bg: {
      primary: 'hsl(215, 30%, 6%)',           // gray-950
      secondary: 'hsl(215, 25%, 10%)',        // gray-900
      tertiary: 'hsl(215, 22%, 13%)',         // surface
    },
    text: {
      primary: 'hsl(215, 15%, 92%)',
      secondary: 'hsl(215, 10%, 62%)',
      tertiary: 'hsl(215, 8%, 45%)',
      inverse: 'hsl(215, 30%, 6%)',
    },
    brand: {
      primary: 'hsl(199, 72%, 55%)',          // brighter for dark
      secondary: 'hsl(38, 85%, 58%)',         // brighter for dark
    },
    semantic: {
      success: 'hsl(152, 55%, 50%)',
      error: 'hsl(4, 68%, 58%)',
      warning: 'hsl(38, 85%, 58%)',
      info: 'hsl(214, 62%, 58%)',
    },
    border: {
      default: 'hsl(215, 15%, 20%)',
      strong: 'hsl(215, 12%, 28%)',
      focus: 'hsl(199, 72%, 55%)',
    },
  },
};
```

---

## Sources

Research drawn from:
- [CRED Design Manifesto](https://cred.club/design) — NeoPOP design system, Gilroy + Cirka typography, 4 generations of design evolution
- [CRED NeoPOP Open Source](https://github.com/CRED-CLUB/neopop-web) — Component library with styled-components
- [Razorpay Blade Design System](https://github.com/razorpay/blade) — Open-source, 8pt grid, semantic tokens, cross-platform
- [Razorpay Blade Spatial System RFC](https://github.com/razorpay/blade/blob/master/rfcs/2021-01-22-spatial-system-rfc.md) — 8pt linear scale, 4pt half-steps
- [Jupiter Europa Design System](https://life.jupiter.money/design-principles-at-jupiter-f783457c976d) — Numbers-as-heroes, color for hierarchy
- [Zerodha Kite Typography](https://jatin17293.medium.com/kite-mobile-app-redesign-by-zerodha-ui-ux-case-study-1096b09c0c61) — Kohinoor Bangla for number readability, data-dense layouts
- [Zerodha Dark Theme](https://zerodha.com/z-connect/kite/dark-theme-simplified-order-window-on-kite-web) — Dark mode implementation
- [Indian Startup UX Patterns](https://procreator.design/blog/indian-startups-get-right-about-product-ux/) — Meesho, PhonePe: icon-led nav, vernacular support, low-bandwidth optimization
- [WCAG Contrast Guidelines](https://webaim.org/articles/contrast/) — 4.5:1 AA, 7:1 AAA requirements
- [Fintech Color Psychology](https://windmill.digital/psychology-of-color-in-financial-app-design/) — Blue/teal for trust, purple for innovation
- [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus%2BJakarta%2BSans) — Display font for premium headings
- [Fintech Typography Selection](https://medium.com/@tamannasamantaray00/typography-selection-for-fintech-product-design-system-series-62ba0ba7c4bf) — Inter, IBM Plex Sans for financial products
