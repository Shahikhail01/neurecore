# Poison Event Runbook

**Trigger:** Dead letter count > 0

## Symptoms
- Events appearing in `EnterpriseEventDeadLetter` table
- Automation stuck at PROCESSING state

## Diagnosis
```sql
SELECT * FROM "EnterpriseEventDeadLetter" ORDER BY "lastAttemptAt" DESC LIMIT 10;
```

## Resolution
1. Review event payload
2. Identify root cause (handler bug, schema mismatch)
3. Fix handler code
4. Use `replayDeadLetter()` to re-enqueue
5. Monitor for re-failure
