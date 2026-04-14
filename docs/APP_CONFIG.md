# App Configuration — Single Source of Truth

> **Change the name here, and update it across all docs.**
> When code exists, this will be a `config.ts` constant instead.

## Brand

| Key | Value |
|-----|-------|
| **App Name** | HisaabPro |
| **Domain** | hisaabpro.in |
| **Tagline** | Billing, Inventory & Payments for Indian Businesses |

## Subdomains

| Host | Purpose | Hosted on |
|------|---------|-----------|
| `hisaabpro.in` / `www.hisaabpro.in` | Marketing landing page | Vercel |
| `app.hisaabpro.in` | PWA / web app (login + dashboard) | Vercel |
| `admin.hisaabpro.in` | Internal admin panel | Vercel |
| `api.hisaabpro.in` | Backend API (Express + Prisma) | Render |

## Email

| Address | Purpose | Destination |
|---------|---------|-------------|
| `support@hisaabpro.in` | Public support, Play Console contact, privacy/delete-account contact, landing footer | Forwards to `sawanj2311@gmail.com` via ImprovMX |

- **Provider:** ImprovMX (free tier, 25 aliases)
- **MX records:** `mx1.improvmx.com` (10), `mx2.improvmx.com` (20)
- **SPF:** `v=spf1 include:spf.improvmx.com ~all`
- **DNS managed at:** Hostinger
- To add more aliases: improvmx.com dashboard → `hisaabpro.in` → Aliases

## Notes

- Domain hisaabpro.in — **purchased** (2026-03)
- File trademark in Class 9 (mobile app) + Class 42 (SaaS)
- Secure @hisaabpro on Twitter/X, Instagram, YouTube, Facebook
- When renaming in code: update this file → search-replace across all docs
