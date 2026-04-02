# Compliance & Data Governance — HisaabPro

> **Status:** Draft
> **Date:** 2026-04-02
> **Laws Covered:** DPDP Act 2023, GST Act (Section 35/36), IT Act 2000

---

## 1. Applicable Laws

### 1.1 Digital Personal Data Protection Act, 2023 (DPDP)

India's primary data protection law. Applies to HisaabPro because we process personal data of:
- **Business owners** (name, phone, email, address, PAN, GSTIN, bank details)
- **Their customers/parties** (name, phone, address, GSTIN, outstanding balances)
- **Employees/staff** (name, phone, role, access logs)

Key obligations:
| Obligation | Section | Our Implementation |
|-----------|---------|-------------------|
| Lawful purpose | Section 4 | Service delivery (billing, invoicing) — legitimate purpose |
| Consent | Section 6 | OTP verification = consent to process for service. Explicit consent for marketing |
| Data minimization | Section 7 | Only collect what's needed for billing |
| Accuracy | Section 8(3) | Users can edit their data anytime |
| Storage limitation | Section 8(7) | Defined retention periods (see Section 3) |
| Right to erasure | Section 12 | Account deletion with anonymization (see Section 4) |
| Right to access | Section 11 | Data export feature (`/api/export/full`) |
| Breach notification | Section 8(6) | 72-hour notification to Data Protection Board |
| Data localization | Section 16 | Data stored in India (Neon ap-south-1) |
| Children's data | Section 9 | Not applicable (B2B app, business owners only) |

### 1.2 GST Act — Section 35 & 36

| Requirement | Duration | What |
|------------|----------|------|
| Books of account | 72 months (6 years) from due date of annual return | All invoices, credit/debit notes, payments |
| Purchase register | 72 months | All purchase invoices |
| Stock register | 72 months | Stock movements, adjustments |
| Tax records | 72 months | GST computations, returns (GSTR-1/3B/9) |

**Conflict with DPDP:** User requests data deletion, but GST requires 6-year retention.
**Resolution:** Anonymize personal data, retain financial records (see Section 4).

### 1.3 IT Act 2000 — Section 43A

Reasonable security practices for sensitive personal data:
- Body corporate handling sensitive data must implement "reasonable security"
- ISO 27001 or equivalent practices recommended
- Compensation liability for negligent data handling

Our security posture: JWT httpOnly cookies, bcrypt hashing, AES encryption for backups, rate limiting, CSRF protection, audit trails, role-based access.

---

## 2. Data Classification

### 2.1 Categories

| Category | Examples | Sensitivity | Retention |
|----------|---------|------------|-----------|
| **PII (Personal)** | Name, phone, email, address, PAN | HIGH | Until account deletion + anonymization |
| **Financial** | Invoices, payments, ledger entries, bank details | HIGH | 72 months (GST mandate) |
| **Business** | GSTIN, company name, business type | MEDIUM | Until business deletion |
| **Operational** | Audit logs, activity logs, error logs | MEDIUM | 24 months |
| **Technical** | Session tokens, device info, IP addresses | LOW | Session duration + 30 days |
| **Derived** | Reports, dashboards, analytics | LOW | Regenerable, no retention needed |

### 2.2 PII Inventory

| Data Field | Model(s) | Purpose | Lawful Basis |
|-----------|----------|---------|-------------|
| Phone number | User | Authentication (OTP), contact | Consent (OTP flow) |
| Email | User | Notifications, backup | Consent (optional field) |
| Full name | User, Party | Identification on invoices | Contractual necessity |
| Address | Party, PartyAddress | Invoicing, delivery | Contractual necessity |
| PAN | Party | GST compliance | Legal obligation |
| GSTIN | Party, Business | GST compliance | Legal obligation |
| Bank details | BankAccount | Accounting | Consent (user-entered) |
| IP address | AuditLog, Session | Security, fraud prevention | Legitimate interest |
| Device info | Session | Security, session management | Legitimate interest |

---

## 3. Data Retention Matrix

| Data Type | Active Retention | Post-Deletion | Hard Delete After |
|-----------|-----------------|---------------|-------------------|
| User account | While active | Anonymized on request | Never (anonymized record kept) |
| Business profile | While active | Anonymized on request | Never (anonymized record kept) |
| Invoices (sale/purchase) | While active | Retained (anonymized party refs) | 72 months after FY end |
| Payments | While active | Retained (anonymized party refs) | 72 months after FY end |
| Parties (customers/suppliers) | While active | Anonymized on request | 72 months after last transaction |
| Products | While active | Soft-deleted | 72 months after last invoice |
| Stock movements | While active | Retained | 72 months |
| GST records (GSTR-1/3B/9) | While active | Retained | 72 months after FY end |
| Journal entries / ledger | While active | Retained | 72 months |
| Audit logs | While active | Retained (anonymized user refs) | 24 months |
| Admin action logs | While active | Retained | 24 months |
| Sessions | While active | Auto-expired | 30 days after expiry |
| Token blacklist | While valid | Auto-expired | 24 hours after token expiry |
| Error logs (Sentry) | While useful | Auto-rotated | 90 days (Sentry default) |
| Backups | While relevant | Auto-rotated | 30 days (Neon PITR) |

---

## 4. Right to Erasure (Account Deletion)

### 4.1 Flow

```
User requests account deletion
  → Confirm via OTP (prevent unauthorized deletion)
  → 30-day cooling period (user can cancel)
  → After 30 days: anonymization job runs
    → Personal data replaced with "Deleted User" / "XXXXXXXXXX"
    → Financial records retained with anonymized references
    → User account marked inactive
    → All sessions revoked
    → Notification sent confirming deletion
```

### 4.2 What Gets Anonymized

| Field | Before | After |
|-------|--------|-------|
| User.name | "Raju Sharma" | "Deleted User" |
| User.phone | "+919876543210" | "XXXXXXXXXX" |
| User.email | "raju@gmail.com" | null |
| Party.name | "Priya Traders" | "Deleted Party [P-001]" |
| Party.phone | "+919876543210" | null |
| Party.email | "priya@gmail.com" | null |
| Party.address | "123 MG Road, Indore" | null |
| Party.gstin | "23AABCU9603R1ZM" | null |
| AuditLog.userId | "clx123..." | "anonymized-user" |

### 4.3 What Gets Retained (GST Compliance)

- Invoice numbers, dates, amounts, tax breakup
- Payment amounts, dates, modes
- Stock movements, quantities
- Ledger entries, journal entries
- GST return data (GSTR-1/3B/9)
- Document line items (product snapshots)

**Legal basis:** DPDP Act Section 8(8) — retention permitted when "necessary for compliance with any law."

### 4.4 Implementation

```typescript
// server/src/services/account-deletion.service.ts

async function anonymizeUser(userId: string) {
  await prisma.$transaction(async (tx) => {
    // 1. Anonymize user
    await tx.user.update({
      where: { id: userId },
      data: {
        name: 'Deleted User',
        phone: 'XXXXXXXXXX',
        email: null,
        isActive: false,
        deletedAt: new Date(),
      },
    });

    // 2. Anonymize parties they own (across all businesses)
    const businessUsers = await tx.businessUser.findMany({
      where: { userId, role: 'OWNER' },
    });

    for (const bu of businessUsers) {
      await tx.party.updateMany({
        where: { businessId: bu.businessId },
        data: {
          phone: null,
          email: null,
          address: null,
          gstin: null,
          pan: null,
          // Keep: name → "Deleted Party [code]", type, balances
        },
      });
    }

    // 3. Revoke all sessions
    await tx.session.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });

    // 4. Anonymize audit log references
    await tx.auditLog.updateMany({
      where: { userId },
      data: { userId: 'anonymized-user' },
    });

    // 5. Log the deletion itself
    await tx.adminAction.create({
      data: {
        adminId: 'system',
        action: 'ACCOUNT_DELETED',
        targetType: 'User',
        targetId: userId,
        metadata: { reason: 'User-requested erasure', anonymizedAt: new Date() },
      },
    });
  });
}
```

---

## 5. Consent Management

### 5.1 Consent Types

| Purpose | Collection Point | Mechanism | Withdrawable |
|---------|-----------------|-----------|-------------|
| Service delivery | Registration (OTP) | Implicit (using the service) | Yes (delete account) |
| Transaction emails | Invoice creation | Implicit (part of service) | No (required for invoicing) |
| Marketing emails | Settings toggle | Explicit opt-in | Yes (toggle off) |
| WhatsApp notifications | Settings toggle | Explicit opt-in | Yes (toggle off) |
| Push notifications | OS permission prompt | Explicit opt-in | Yes (OS settings) |
| Analytics/crash reports | First launch | Explicit opt-in | Yes (settings) |
| Data sharing with CA | Manual export | Explicit action | N/A (one-time action) |

### 5.2 Consent Records

```prisma
model ConsentRecord {
  id        String   @id @default(cuid())
  userId    String
  purpose   String   // 'marketing_email', 'whatsapp_notifications', etc.
  granted   Boolean
  grantedAt DateTime?
  revokedAt DateTime?
  ipAddress String?
  user      User     @relation(fields: [userId], references: [id])

  @@unique([userId, purpose])
  @@index([userId])
}
```

---

## 6. Breach Response Plan

### 6.1 Definition

A "personal data breach" under DPDP Act means unauthorized access, disclosure, or loss of personal data.

### 6.2 Response Timeline

| Time | Action |
|------|--------|
| T+0 | Breach detected (Sentry alert, user report, or audit log anomaly) |
| T+1h | Incident commander assigned (Sawan). Initial assessment. |
| T+4h | Scope determined: what data, how many users, attack vector |
| T+24h | Containment: credentials rotated, sessions revoked, vulnerability patched |
| T+72h | **Notification to Data Protection Board of India** (DPDP Act requirement) |
| T+72h | Affected users notified via SMS/email with: what happened, what data, what we're doing |
| T+7d | Post-incident report completed |
| T+30d | Preventive measures implemented and verified |

### 6.3 Breach Notification Template

```
Subject: Important Security Notice — HisaabPro

Dear [User],

We are writing to inform you of a security incident that may have affected your data.

What happened: [Brief description]
When: [Date range]
What data was affected: [Specific fields]
What we've done: [Actions taken]
What you should do: [Password change, monitor accounts, etc.]

We take the security of your data seriously and have implemented [measures] to prevent this from happening again.

If you have questions, contact us at security@hisaabpro.in or WhatsApp [number].

— Team HisaabPro
```

---

## 7. Third-Party Data Processing

### 7.1 Sub-Processors

| Service | Data Accessed | Purpose | Data Residency | DPA |
|---------|-------------|---------|---------------|-----|
| Neon | All DB data | Primary storage | India (Mumbai) | Neon DPA ✓ |
| Upstash | Cache data (no PII) | Caching, rate limiting | India (Mumbai) | Upstash DPA ✓ |
| Render | API transit data | Application hosting | Singapore | Render DPA ✓ |
| Vercel | Static assets only | Frontend hosting | Global edge (no PII) | N/A |
| Razorpay | Payment amounts | Payment processing | India | Razorpay DPA ✓ |
| MSG91 | Phone numbers | OTP delivery | India | MSG91 terms ✓ |
| Aisensy | Phone numbers | WhatsApp messaging | India | Aisensy terms ✓ |
| Resend | Email addresses | Email delivery | US (no PII in body) | Resend DPA ✓ |
| Sentry | Stack traces (no PII) | Error tracking | US (PII stripped) | Sentry DPA ✓ |
| FCM/Firebase | Device tokens only | Push notifications | Global | Google DPA ✓ |

### 7.2 Data Flow Diagram

```
User's device
  ↓ (HTTPS)
Cloudflare (passes through, no storage)
  ↓
Render (processes, doesn't store permanently)
  ↓
Neon (stores all business data — India)
  ↓
Upstash (caches — India, auto-expires)

Outbound:
Render → MSG91 (phone number for OTP)
Render → Aisensy (phone number for WhatsApp)
Render → Resend (email address for notifications)
Render → Razorpay (payment amount + order ID)
Render → Sentry (error stack trace, NO PII)
Render → FCM (device token, NO PII)
```

---

## 8. Security Audit Schedule

| Audit | Frequency | Scope | Who |
|-------|-----------|-------|-----|
| Dependency vulnerability scan | Weekly | `npm audit` | Automated (CI) |
| OWASP Top 10 review | Quarterly | Backend routes, auth, input handling | Manual / tool |
| Permission audit | Monthly | Verify all routes have correct guards | Script |
| Access log review | Monthly | Admin actions, suspicious patterns | Manual |
| Penetration testing | Annually | Full app | External (when budget allows) |
| Compliance review | Annually | DPDP + GST requirements | Manual |
| Secret rotation | Annually | All API keys, JWT secrets | Manual |

---

## 9. Data Processing Agreement (DPA) — Template for Business Owners

When a business owner uses HisaabPro, they are the **Data Controller** for their customers' data. HisaabPro is the **Data Processor**.

Key terms (summarized):
1. We process their customers' data only for providing the billing service
2. We don't sell, share, or use their data for any other purpose
3. We implement reasonable security measures (documented in this doc)
4. We notify them within 72 hours of any breach affecting their data
5. We delete/anonymize data upon account deletion (with GST retention exception)
6. We provide data export on request (within 24 hours)

This DPA should be part of the Terms of Service accepted during onboarding.
