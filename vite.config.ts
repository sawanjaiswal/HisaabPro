import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icon-192.svg', 'icon-512.svg', 'offline.html'],
      manifest: {
        name: 'HisaabPro — Billing & Inventory',
        short_name: 'HisaabPro',
        description: 'Billing, Inventory & Payments for Indian Businesses',
        theme_color: '#0f3638',
        background_color: '#f8fafb',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache navigation requests → offline fallback
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          // API calls → stale-while-revalidate (fast + fresh)
          // SECURITY: Whitelist ONLY non-PII, safe reference/catalog endpoints.
          // DO NOT cache: /api/parties, /api/payments, /api/customers,
          //   /api/documents, /api/expenses, /api/auth, /api/users, /api/businesses
          // Reason: those endpoints return PII (phone, address, balances) which must
          //   not persist in the SW cache across sessions.
          {
            urlPattern: /^.*\/api\/(products|tax-categories|hsn|units|health|godowns)\b.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'hisaabpro-api',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 }, // 1 hour
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts stylesheets → stale-while-revalidate
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // Google Fonts files → cache-first (immutable)
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Static assets (images, SVGs) → cache-first
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'hisaabpro-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 days
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],

        // Pre-cache the offline fallback page
        additionalManifestEntries: [
          { url: '/offline.html', revision: '1' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@shared': resolve(__dirname, './shared'),
    },
  },
  server: {
    port: 5002,
    host: true, // expose on LAN for mobile testing
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
