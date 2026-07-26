# Outbox Backlog Runbook

**Trigger:** Backlog > 100 or age > 5min

## Symptoms
- Outbox backlog size metric > 100
- Outbox event age > 5min
- Customers reporting slow project automation

## Diagnosis
```sql
SELECT status, COUNT(*), AVG(EXTRACT(EPOCH FROM (NOW() - "createdAt")))
FROM "EnterpriseEventOutbox"
GROUP BY status;
```

## Resolution
1. Check worker health: `systemctl status neurecore-worker`
2. Check for stuck transactions: `SELECT * FROM pg_stat_activity WHERE state = 'idle in transaction'`
3. Increase worker concurrency if needed
4. Check for poison events in dead letter
