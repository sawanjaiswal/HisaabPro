# HisaabPro Brand & Logo System (SSOT)

This project uses a **Single Source of Truth (SSOT)** branding system. Whenever you want to change the logo in the future, you **only need to replace one file and run one command**.

---

## 🚀 How to Change the Logo in 1 Step

1. **Replace the master logo image** in `assets/branding/`:
   - Replace [`assets/branding/master-sheet.png`](file:///Users/sawanjaiswal/Projects/HisaabPro/assets/branding/master-sheet.png) with your new master logo sheet, **OR**
   - Place a standalone square icon as `assets/branding/master-icon.png` / horizontal logo as `assets/branding/master-logo.png`.

2. **Run the brand sync command**:
   ```bash
   npm run brand:sync
   ```

### ✨ What `npm run brand:sync` automatically does:
- Generates all web & PWA icons (`icon-512.png`, `icon-192.png`, `favicon.png`, `favicon.svg`, `icon-192.svg`, `icon-512.svg`).
- Crops and antialiases all official web logo variants into `public/logos/official/` (`hisaabpro-logo-horizontal.png`, `hisaabpro-logo-white.png`, `hisaabpro-icon-dark.png`, `hisaabpro-icon-light.png`, `hisaabpro-h-mark.png`).
- Generates all 5 Android launcher icon densities in `android/app/src/main/res/` (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`) for:
  - `ic_launcher.png` (Square launcher icon)
  - `ic_launcher_round.png` (Round launcher icon)
  - `ic_launcher_foreground.png` (Adaptive icon foreground)

---

## 💻 How to Use Logos in React Code

Never hardcode image paths in components. Always use the central `<BrandLogo />` component or `BRAND` config:

```tsx
import { BrandLogo } from '@/components/brand/BrandLogo'

// 1. Primary horizontal logo with tagline (Login, Storefront, Splash)
<BrandLogo variant="horizontal" size="md" />

// 2. White logo for dark headers or green hero cards
<BrandLogo variant="horizontal-white" size="lg" />

// 3. App icon squircle
<BrandLogo variant="icon" size="sm" />

// 4. Isolated 'H' mark
<BrandLogo variant="mark" size={32} />
```

Or access paths directly from [`src/config/brand.config.ts`](file:///Users/sawanjaiswal/Projects/HisaabPro/src/config/brand.config.ts):
```ts
import { BRAND } from '@/config/brand.config'

console.log(BRAND.assets.logoHorizontal)
console.log(BRAND.name)
console.log(BRAND.tagline)
```
