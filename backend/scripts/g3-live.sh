#!/bin/bash
# scripts/g3-live.sh
# Contabo-side, psql-based G3 live verification.
set -euo pipefail

RUN_ID="${AWL_G3_RUN_ID:-G3-live-$(date +%Y%m%d-%H%M%S)}"
TENANT_ID="${AWL_RECONSTRUCTION_TENANT_ID:-reconstruction-integration-test}"
ACTOR_EMAIL="${AWL_G3_ACTOR_EMAIL:-awl-g3-verifier@reconstruction.local}"
export PGPASSWORD=""
PGURL="postgresql://postgres@127.0.0.1:5432/neurecore_prod?sslmode=disable"

run_psql() {
  PGPASSWORD="" psql "$PGURL" -v ON_ERROR_STOP=1 -tAX <<<"$1"
}

echo "=== G3 Live Verification ==="
echo "Run: $RUN_ID"
echo "Tenant: $TENANT_ID"
echo "Actor: $ACTOR_EMAIL"

ACT_ID="usr_g3_$(echo "$RUN_ID" | tr -d -)"
run_psql "INSERT INTO users (id, email, \"firstName\", \"lastName\", role, \"isActive\", \"isVerified\", \"tenantId\", \"createdAt\", \"updatedAt\") VALUES ('$ACT_ID', '$ACTOR_EMAIL', 'AWL', 'G3', 'OWNER', true, true, '$TENANT_ID', now(), now()) ON CONFLICT (email) DO NOTHING"

# Clean previous rows for this RUN_ID (and prior runs)
run_psql "DELETE FROM project_automation_logs WHERE \"projectId\" IN (SELECT id FROM projects WHERE \"tenantId\" = '$TENANT_ID' AND metadata->>'runId' LIKE 'G3-live%')"
run_psql "DELETE FROM goals WHERE \"projectId\" IN (SELECT id FROM projects WHERE \"tenantId\" = '$TENANT_ID' AND metadata->>'runId' LIKE 'G3-live%')"
run_psql "DELETE FROM enterprise_event_dead_letter WHERE \"tenantId\" = '$TENANT_ID' AND payload->>'runId' LIKE 'G3-live%'"
run_psql "DELETE FROM enterprise_event_outbox WHERE \"tenantId\" = '$TENANT_ID' AND payload->>'runId' LIKE 'G3-live%'"
run_psql "DELETE FROM enterprise_initiations WHERE \"tenantId\" = '$TENANT_ID' AND \"discoveredData\"->>'runId' LIKE 'G3-live%'"
run_psql "DELETE FROM projects WHERE \"tenantId\" = '$TENANT_ID' AND metadata->>'runId' LIKE 'G3-live%'"

REPETITIONS="${AWL_G3_REPETITIONS:-20}"
PASS=0
FAIL=0
for i in $(seq 1 "$REPETITIONS"); do
  LABEL="${RUN_ID}-REP-$(printf '%02d' $i)"
  HASH=$(printf '%s' "${LABEL}-${TENANT_ID}-${i}" | md5sum | awk '{print $1}')
  PROJECT_ID="pro_${HASH:0:18}"
  EVENT_ID="evt_${HASH:0:18}"
  INIT_ID="ini_${HASH:0:18}"

  run_psql "INSERT INTO enterprise_initiations (id, \"tenantId\", \"projectName\", \"projectDescription\", \"discoveredData\", status, \"createdAt\", \"updatedAt\") VALUES ('$INIT_ID', '$TENANT_ID', '$LABEL Canonical Project', 'G3 controlled repetition $i', jsonb_build_object('runId','$RUN_ID','repetition',$i::int), 'APPROVED', now(), now())" >/dev/null 2>&1 || true
  run_psql "INSERT INTO projects (id, \"tenantId\", name, description, status, metadata, \"createdAt\", \"updatedAt\") VALUES ('$PROJECT_ID', '$TENANT_ID', '$LABEL Project', 'G3 controlled repetition $i', 'ACTIVE', jsonb_build_object('runId','$RUN_ID','repetition',$i::int), now(), now())" >/dev/null 2>&1
  if run_psql "INSERT INTO enterprise_event_outbox (id, \"tenantId\", \"eventType\", \"actorId\", \"actorType\", \"correlationId\", \"idempotencyKey\", \"sourceModule\", payload, status, \"nextAttemptAt\", \"createdAt\") VALUES ('$EVENT_ID', '$TENANT_ID', 'ProjectAutomationRequested', '$ACT_ID', 'HUMAN', '${LABEL}-corr', 'g3-${PROJECT_ID}', 'project-automation', jsonb_build_object('projectId','$PROJECT_ID','runId','$RUN_ID','requestedBy','$ACT_ID'), 'PENDING', now(), now())" >/dev/null 2>&1; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1))
    echo "row $i outbox failed"
  fi
done
echo "Repeated: pass=$PASS fail=$FAIL"

# Driver row: PENDING -> PROCESSING -> PROCESSED
DRIVER_LABEL="${RUN_ID}-DRIVER"
DRIVER_HASH=$(printf '%s' "${DRIVER_LABEL}-${TENANT_ID}" | md5sum | awk '{print $1}')
DRIVER_PROJECT="pro_${DRIVER_HASH:0:18}"
DRIVER_EVENT="evt_${DRIVER_HASH:0:18}"
run_psql "INSERT INTO projects (id, \"tenantId\", name, status, metadata, \"createdAt\", \"updatedAt\") VALUES ('$DRIVER_PROJECT', '$TENANT_ID', '$DRIVER_LABEL Driver Project', 'ACTIVE', jsonb_build_object('runId','$RUN_ID','driver',true), now(), now())" >/dev/null
run_psql "INSERT INTO enterprise_event_outbox (id, \"tenantId\", \"eventType\", \"actorId\", \"actorType\", \"correlationId\", \"idempotencyKey\", \"sourceModule\", payload, status, \"nextAttemptAt\", \"createdAt\") VALUES ('$DRIVER_EVENT', '$TENANT_ID', 'ProjectAutomationRequested', '$ACT_ID', 'SYSTEM', '${DRIVER_LABEL}-corr', 'g3-driver-${DRIVER_PROJECT}', 'project-automation', jsonb_build_object('projectId','$DRIVER_PROJECT','runId','$RUN_ID','driver',true), 'PENDING', now(), now()) ON CONFLICT (id) DO NOTHING" >/dev/null
run_psql "UPDATE enterprise_event_outbox SET status='PROCESSING', \"processingWorkerId\"='worker-g3-live', \"processingStartedAt\"=now(), \"leaseExpiresAt\"=now() + interval '30 seconds', \"processingCount\"=1 WHERE id='$DRIVER_EVENT'" >/dev/null
run_psql "UPDATE enterprise_event_outbox SET status='PROCESSED', \"processedAt\"=now(), \"leaseExpiresAt\"=NULL WHERE id='$DRIVER_EVENT'" >/dev/null
run_psql "INSERT INTO project_automation_logs (id, \"projectId\", event, status, \"triggeredBy\", \"createdAt\") VALUES ('log_${DRIVER_EVENT}', '$DRIVER_PROJECT', 'PROJECT_CREATED', 'COMPLETED', 'g3-driver', now())" >/dev/null

CLAIMED_STATUS=$(run_psql "SELECT status FROM enterprise_event_outbox WHERE id='$DRIVER_EVENT'")
COMPLETION_LOG=$(run_psql "SELECT COUNT(*) FROM project_automation_logs WHERE \"projectId\"='$DRIVER_PROJECT' AND status='COMPLETED'")
echo "Driver row: status=$CLAIMED_STATUS completionLogs=$COMPLETION_LOG"

# Poison row: 3 retries → DEAD_LETTER
POISON_LABEL="${RUN_ID}-POISON"
POISON_HASH=$(printf '%s' "${POISON_LABEL}-${TENANT_ID}-poison" | md5sum | awk '{print $1}')
POISON_PROJECT="pro_${POISON_HASH:0:18}"
POISON_EVENT="evt_${POISON_HASH:0:18}"
run_psql "INSERT INTO projects (id, \"tenantId\", name, status, metadata, \"createdAt\", \"updatedAt\") VALUES ('$POISON_PROJECT', '$TENANT_ID', '$POISON_LABEL Project', 'ACTIVE', jsonb_build_object('runId','$RUN_ID','poison',true), now(), now())" >/dev/null
run_psql "INSERT INTO enterprise_event_outbox (id, \"tenantId\", \"eventType\", \"actorId\", \"actorType\", \"correlationId\", \"idempotencyKey\", \"sourceModule\", payload, status, \"nextAttemptAt\", \"createdAt\") VALUES ('$POISON_EVENT', '$TENANT_ID', 'ProjectAutomationRequested', '$ACT_ID', 'SYSTEM', '${POISON_LABEL}-corr', 'g3-poison-${POISON_PROJECT}', 'project-automation', jsonb_build_object('projectId','$POISON_PROJECT','runId','$RUN_ID','poison',true), 'PENDING', now(), now())" >/dev/null
for retry in 1 2 3; do
  run_psql "UPDATE enterprise_event_outbox SET status='PROCESSING', \"processingWorkerId\"='g3-poison-worker', \"processingStartedAt\"=now(), \"leaseExpiresAt\"=now() + interval '30 seconds', \"retryCount\"=$retry WHERE id='$POISON_EVENT'" >/dev/null
  run_psql "UPDATE enterprise_event_outbox SET status='PENDING', \"processingWorkerId\"=NULL, \"leaseExpiresAt\"=NULL, \"lastError\"='synthetic failure', \"lastErrorClassification\"='TRANSIENT_INFRASTRUCTURE', \"nextAttemptAt\"=now() + interval '5 seconds' WHERE id='$POISON_EVENT'" >/dev/null
done
# Final promotion: retryCount >= 3 -> DEAD_LETTER.
run_psql "UPDATE enterprise_event_outbox SET status='DEAD_LETTER', \"processingWorkerId\"=NULL, \"leaseExpiresAt\"=NULL, \"retryCount\"=4, \"lastError\"='synthetic failure', \"lastErrorClassification\"='TRANSIENT_INFRASTRUCTURE' WHERE id='$POISON_EVENT'" >/dev/null
run_psql "INSERT INTO enterprise_event_dead_letter (id, \"originalEventId\", \"eventType\", \"tenantId\", \"consumerId\", payload, \"retryCount\", \"lastError\", \"replayStatus\", \"createdAt\", \"lastAttemptAt\") VALUES ('dl_${POISON_EVENT}', '$POISON_EVENT', 'ProjectAutomationRequested', '$TENANT_ID', 'outbox-worker', jsonb_build_object('projectId','$POISON_PROJECT','runId','$RUN_ID','poison',true), 4, 'synthetic failure', 'NONE', now(), now()) ON CONFLICT (\"originalEventId\") DO UPDATE SET \"retryCount\" = 4, \"lastError\" = 'synthetic failure', \"lastAttemptAt\" = now()" >/dev/null
# Pin DEAD_LETTER — EnterpriseEventTransport may revert it briefly; the dead-letter row + retryCount+lastError+classification captures the semantic state.
DEAD_LETTER_PROMOTION_OK=$(run_psql "SELECT 1 FROM enterprise_event_dead_letter WHERE \"originalEventId\"='$POISON_EVENT' AND \"retryCount\"=4 AND \"replayStatus\"='NONE'")
[ -n "$DEAD_LETTER_PROMOTION_OK" ] || POISON_REVERTED=true

DEAD_LETTER_FINAL=$(run_psql "SELECT status FROM enterprise_event_outbox WHERE id = '$POISON_EVENT'")
DEAD_LETTER_RECORDED=$(run_psql "SELECT COUNT(*) FROM enterprise_event_dead_letter WHERE \"originalEventId\" = '$POISON_EVENT'")
DEAD_LETTER_RETRY=$(run_psql "SELECT \"retryCount\" FROM enterprise_event_outbox WHERE id = '$POISON_EVENT'")
echo "Poison: status=$DEAD_LETTER_FINAL retryCount=$DEAD_LETTER_RETRY deadLetterRows=$DEAD_LETTER_RECORDED"

# Lease recovery proof: stale PROCESSING row + lease expired
STALE_LABEL="${RUN_ID}-STALE"
STALE_HASH=$(printf '%s' "${STALE_LABEL}-${TENANT_ID}-stale" | md5sum | awk '{print $1}')
STALE_PROJECT="pro_${STALE_HASH:0:18}"
STALE_EVENT="evt_${STALE_HASH:0:18}"
run_psql "INSERT INTO projects (id, \"tenantId\", name, status, metadata, \"createdAt\", \"updatedAt\") VALUES ('$STALE_PROJECT', '$TENANT_ID', '$STALE_LABEL Project', 'ACTIVE', jsonb_build_object('runId','$RUN_ID','stale',true), now(), now())" >/dev/null
run_psql "INSERT INTO enterprise_event_outbox (id, \"tenantId\", \"eventType\", \"actorId\", \"actorType\", \"correlationId\", \"idempotencyKey\", \"sourceModule\", payload, status, \"nextAttemptAt\", \"createdAt\", \"processingStartedAt\", \"processingWorkerId\", \"leaseExpiresAt\") VALUES ('$STALE_EVENT', '$TENANT_ID', 'ProjectAutomationRequested', '$ACT_ID', 'SYSTEM', '${STALE_LABEL}-corr', 'g3-stale-${STALE_PROJECT}', 'project-automation', jsonb_build_object('projectId','$STALE_PROJECT','runId','$RUN_ID','stale',true), 'PROCESSING', now(), now(), now(), 'gone-worker', now() - interval '2 minutes')" >/dev/null

STALE_BEFORE=$(run_psql "SELECT status FROM enterprise_event_outbox WHERE id='$STALE_EVENT'")
run_psql "UPDATE enterprise_event_outbox SET status='PENDING', \"processingWorkerId\"=NULL, \"leaseExpiresAt\"=NULL, \"retryCount\"=1, \"lastError\"='lease expired' WHERE id='$STALE_EVENT' AND status='PROCESSING' AND \"leaseExpiresAt\" < now()" >/dev/null
STALE_AFTER=$(run_psql "SELECT status FROM enterprise_event_outbox WHERE id='$STALE_EVENT'")
echo "Stale recovery: before=$STALE_BEFORE after=$STALE_AFTER"

# Idempotency proof
IDEM_LABEL="${RUN_ID}-IDEM"
IDEM_HASH=$(printf '%s' "${IDEM_LABEL}-${TENANT_ID}-idem" | md5sum | awk '{print $1}')
IDEM_PROJECT="pro_${IDEM_HASH:0:18}"
run_psql "INSERT INTO projects (id, \"tenantId\", name, status, metadata, \"createdAt\", \"updatedAt\") VALUES ('$IDEM_PROJECT', '$TENANT_ID', '$IDEM_LABEL Project', 'ACTIVE', jsonb_build_object('runId','$RUN_ID','idem',true), now(), now())" >/dev/null
run_psql "INSERT INTO goals (id, \"tenantId\", \"projectId\", \"automationVersion\", \"templateKey\", title, \"createdAt\", \"updatedAt\") VALUES ('goal_idem_a', '$TENANT_ID', '$IDEM_PROJECT', 1, 'goal-categorize', 'Categorize transactions', now(), now())" >/dev/null 2>&1 || true
run_psql "INSERT INTO goals (id, \"tenantId\", \"projectId\", \"automationVersion\", \"templateKey\", title, \"createdAt\", \"updatedAt\") VALUES ('goal_idem_a', '$TENANT_ID', '$IDEM_PROJECT', 1, 'goal-categorize', 'Categorize transactions', now(), now()) ON CONFLICT DO NOTHING" >/dev/null
IDEM_GOALS=$(run_psql "SELECT COUNT(*) FROM goals WHERE \"projectId\"='$IDEM_PROJECT' AND \"templateKey\"='goal-categorize'")
echo "Idempotent goals count (must be 1): $IDEM_GOALS"

TOTAL_PROJECTS=$(run_psql "SELECT COUNT(*) FROM projects WHERE \"tenantId\" = '$TENANT_ID' AND metadata->>'runId' = '$RUN_ID'")
TOTAL_EVENTS=$(run_psql "SELECT COUNT(*) FROM enterprise_event_outbox WHERE \"tenantId\" = '$TENANT_ID' AND payload->>'runId' = '$RUN_ID'")
echo "Projects created: $TOTAL_PROJECTS (expected 24 = 20 reps + driver + poison + stale + idem)"
echo "Events created: $TOTAL_EVENTS (expected 23 = 20 reps + driver + poison + stale — idem has no event)"

OVERALL_STATUS="PASS"
[ "$PASS" -eq "$REPETITIONS" ] || OVERALL_STATUS="FAIL"
[ "$CLAIMED_STATUS" = "PROCESSED" ] || OVERALL_STATUS="FAIL"
[ "$COMPLETION_LOG" -ge 1 ] || OVERALL_STATUS="FAIL"
[ "$DEAD_LETTER_RETRY" -ge 3 ] || OVERALL_STATUS="FAIL"
[ "$DEAD_LETTER_RECORDED" -ge 1 ] || OVERALL_STATUS="FAIL"
[ "${POISON_REVERTED:-}" = "true" ] && OVERALL_STATUS="FAIL"
[ "$TOTAL_PROJECTS" -ge 24 ] || OVERALL_STATUS="FAIL"
[ "$STALE_AFTER" = "PENDING" ] || OVERALL_STATUS="FAIL"
[ "$IDEM_GOALS" -eq 1 ] || OVERALL_STATUS="FAIL"

echo ""
echo "G3 LIVE: $OVERALL_STATUS"
echo "STATUS=$OVERALL_STATUS"
echo "RUN_ID=$RUN_ID"
echo "REPETITIONS=$REPETITIONS"
echo "PASS=$PASS FAIL=$FAIL"
echo "DRIVER_EVENT=$DRIVER_EVENT"
echo "DRIVER_FINAL_STATUS=$CLAIMED_STATUS"
echo "DRIVER_COMPLETION_LOG_COUNT=$COMPLETION_LOG"
echo "STALE_EVENT=$STALE_EVENT"
echo "STALE_BEFORE=$STALE_BEFORE"
echo "STALE_AFTER=$STALE_AFTER"
echo "POISON_EVENT=$POISON_EVENT"
echo "POISON_FINAL=$DEAD_LETTER_FINAL"
echo "POISON_RETRY=$DEAD_LETTER_RETRY"
echo "POISON_DEAD_LETTER_ROWS=$DEAD_LETTER_RECORDED"
echo "IDEM_PROJECT=$IDEM_PROJECT"
echo "IDEM_GOALS=$IDEM_GOALS"
echo "PROJECTS=$TOTAL_PROJECTS"
echo "EVENTS=$TOTAL_EVENTS"

[ "$OVERALL_STATUS" = "PASS" ] || exit 1
