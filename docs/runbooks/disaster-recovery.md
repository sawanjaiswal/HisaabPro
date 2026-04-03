# Disaster Recovery Runbook

> Last updated: 2026-04-03
> RTO target: < 1 hour | RPO target: < 5 minutes

## Prerequisites

- Neon dashboard access (neon.tech)
- Render dashboard access (render.com)
- Database credentials in 1Password/Vault
- This runbook printed or accessible offline

## Scenario 1: App Down (Render)

**Symptoms:** 5xx errors, health check failing, users can't load app
**RTO:** < 5 minutes

1. Check Render dashboard → Service status
2. If deploy failed: click "Manual Deploy" → select last working commit
3. If service crashed: click "Restart Service"
4. If region issue: Render auto-routes to healthy instance
5. Verify: `curl https://api.hisaabpro.in/api/health`

## Scenario 2: Database Corruption / Bad Migration

**Symptoms:** 5xx on data endpoints, Prisma errors in logs
**RTO:** < 30 minutes

1. Open Neon dashboard → Project → Branches
2. Click "Restore" → select point-in-time BEFORE the bad migration
3. Note: this creates a new branch. Update DATABASE_URL in Render env vars.
4. Run: `npx prisma migrate deploy` on the restored branch
5. Verify: `curl https://api.hisaabpro.in/api/health/detailed` → check db.status

## Scenario 3: Accidental Data Deletion

**Symptoms:** User reports missing data
**RTO:** < 1 hour

1. Check recycle bin first — soft-deleted data is recoverable:
   - `SELECT * FROM "Document" WHERE "isDeleted" = true AND "businessId" = 'xxx'`
2. If not in recycle bin (hard delete or recycle bin purged):
   - Neon PITR → restore to timestamp before deletion
   - Extract the missing rows from restored branch
   - Insert into production branch
3. Verify with user that data is restored

## Scenario 4: Full Region Outage (ap-south-1)

**Symptoms:** Neon and Render both unreachable
**RTO:** < 2 hours

1. If Neon Pro: auto-failover to replica (should happen automatically)
2. If Neon Free: restore from daily snapshot:
   - Create new Neon project in available region
   - Import latest daily snapshot
3. Deploy API to alternate Render region or Railway
4. Update DNS (Cloudflare) to point to new API URL
5. Verify end-to-end

## Scenario 5: Compromised Credentials

**Symptoms:** Suspicious activity, unauthorized access
**RTO:** Immediate

1. Rotate JWT_SECRET and JWT_REFRESH_SECRET in Render env vars
2. This invalidates ALL active sessions (users must re-login)
3. Rotate DATABASE_URL password in Neon
4. Check AuditLog for suspicious actions:
   - `SELECT * FROM "AuditLog" WHERE "createdAt" > NOW() - INTERVAL '24 hours' ORDER BY "createdAt" DESC`
5. If user accounts compromised: lock affected accounts, notify users

## Backup Schedule

| Type | Frequency | Retention | Location |
|------|-----------|-----------|----------|
| Neon PITR | Continuous | 7 days (Free) / 30 days (Pro) | Neon managed |
| Daily snapshot | Daily 2AM IST | 30 days | Neon branching |
| Schema migrations | Every deploy | Forever | Git repository |

## Monthly Testing Checklist

- [ ] Restore daily snapshot to Neon branch → verify data integrity
- [ ] Test health endpoints respond correctly
- [ ] Verify backup retention (oldest backup within expected window)
- [ ] Review AuditLog for anomalies

## Quarterly Testing

- [ ] Full disaster simulation: restore from backup, deploy to test environment, verify app works end-to-end
- [ ] Update this runbook with any lessons learned

## Contacts

| Role | Who | Contact |
|------|-----|---------|
| App Owner | Sawan Jaiswal | (update with contact info) |
| Neon Support | — | support@neon.tech |
| Render Support | — | support@render.com |
