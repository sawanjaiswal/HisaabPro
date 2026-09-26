# HisaabPro — Agent Memory & Core Operating Instructions

## 1. Authentication & Email Verification (SSOT)
- **Primary Auth Mode**: Pure Resend Email Verification + Password (+ Google SSO).
- **No SMS/Phone OTP Requirement**: SMS gateway (MSG91) is optional; all verification codes (signup, password reset, login OTP) are dispatched via Resend Email Service (`server/src/services/email.service.ts`).
- **Resend Configuration**:
  - `RESEND_API_KEY`: Managed via environment variables (`server/.env` in dev, Coolify in production).
  - `RESEND_FROM_EMAIL` / `EMAIL_FROM`: `HisaabPro <noreply@hisaabpro.in>` (or `HisaabPro <onboarding@resend.dev>`).
- **Endpoints**:
  - `POST /api/auth/register`: Sends 6-digit email OTP.
  - `POST /api/auth/verify-registration`: Verifies OTP and atomically provisions User + Business workspace + roles + GL accounts.
  - `POST /api/auth/forgot-password`: Dispatches password recovery OTP to registered email.
  - `POST /api/auth/reset-password`: Verifies OTP and updates password, revoking stale sessions.
  - `POST /api/auth/login`: Authenticates with Email/Phone/Username + Password.
  - `POST /api/auth/sso/google/exchange-web`: Exchanges Google OAuth ID token for session cookies.

## 2. Multi-Tenant SaaS Architecture
- **Tenant Context**: Managed via AsyncLocalStorage (`server/src/middleware/scoped-context.ts` and `auth.ts`).
- **Data Scoping**: Every Prisma query for business entities MUST be scoped by `businessId`.
- **Default Business Creation**: Handled atomically during signup in `server/src/services/auth/register.ts` (`createUserWithDefaultBusiness`).

## 3. Secret Management & Git Hygiene
- **Never commit `.env` or raw secrets**: `.env`, `.env.*.local`, and all secret files are strictly git-ignored.
- **Coolify Integration**: Live production secrets are configured directly in Coolify backend environment settings.
