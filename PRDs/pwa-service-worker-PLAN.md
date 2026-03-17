# Mission Plan: Service Worker + PWA Manifest  |  Status: Shipped

## 1. What
Register a service worker with Workbox cache strategies and add a PWA manifest for installability. Completes the offline-first PWA feature (#6 in Feature Map) — Dexie sync queue and offline banner were already built.

## 2. User Flows
- **Install**: User visits app → browser shows "Add to Home Screen" → taps → installs as standalone app
- **Offline navigation**: User loses connectivity → cached pages load from SW → mutations queue in Dexie → sync on reconnect
- **Update**: New version deployed → SW detects update → shows "Update Available" toast → user taps "Update" → app refreshes

## 3. Technical Implementation

### Cache Strategies (Workbox via vite-plugin-pwa)
| Resource | Strategy | TTL | Max Entries |
|----------|----------|-----|-------------|
| App shell (HTML/JS/CSS) | Precache | Build-time | All (125 entries) |
| API calls (`/api/*`) | StaleWhileRevalidate | 1 hour | 200 |
| Google Fonts CSS | StaleWhileRevalidate | 1 year | 10 |
| Google Fonts files | CacheFirst | 1 year | 30 |
| Images (png/jpg/svg/webp) | CacheFirst | 30 days | 100 |
| Offline fallback | Precache | Build-time | 1 |

### Files Created/Modified
| File | Action |
|------|--------|
| `vite.config.ts` | Modified — added VitePWA plugin with manifest + workbox config |
| `vite-env.d.ts` | Modified — added PWA type reference |
| `src/main.tsx` | Modified — calls `initServiceWorker()` + `recoverStuckItems()` |
| `src/App.tsx` | Modified — added `<SWUpdatePrompt />` |
| `src/lib/sw-register.ts` | Created — SW registration + update prompt state |
| `src/components/feedback/SWUpdatePrompt.tsx` | Created — update toast UI |
| `src/components/feedback/feedback.css` | Modified — added SW update prompt styles |
| `public/favicon.svg` | Created — 32x32 app icon |
| `public/icon-192.svg` | Created — 192x192 PWA icon |
| `public/icon-512.svg` | Created — 512x512 PWA icon |
| `public/offline.html` | Created — static offline fallback page |
| `index.html` | Modified — added iOS PWA meta tags |

### Manifest
- `name`: HisaabPro — Billing & Inventory
- `short_name`: HisaabPro
- `display`: standalone
- `orientation`: portrait
- `theme_color`: #0f3638
- `background_color`: #f8fafb

## 4. Acceptance Criteria
- [x] `npm run build` generates `dist/sw.js` and `dist/manifest.webmanifest`
- [x] Manifest contains correct app name, icons, display mode
- [x] SW precaches 125 build assets
- [x] API calls use StaleWhileRevalidate
- [x] Static assets use CacheFirst
- [x] Offline fallback page exists at `/offline.html`
- [x] `<SWUpdatePrompt>` shows when new version available
- [x] `tsc --noEmit` passes
- [x] Build succeeds
- [x] iOS meta tags present in index.html
- [x] SW auto-checks for updates every 60 minutes
