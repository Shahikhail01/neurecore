# Stuck Execution Runbook

**Trigger:** Attempt running > 30min

## Symptoms
- Execution attempts in RUNNING state for > 30min
- No heartbeat updates

## Diagnosis
```sql
SELECT * FROM "ExecutionAttempt"
WHERE status = 'RUNNING'
AND "startedAt" < NOW() - INTERVAL '30 minutes';
```

## Resolution
1. Check worker process: `ps aux | grep neurecore`
2. Check heartbeat: should be every 30s
3. Cancel stuck attempt if needed
4. Trigger retry
