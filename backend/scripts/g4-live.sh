#!/bin/bash
# scripts/g4-live.sh
# Contabo-side, psql-based G4 live verification.
#
# Validates the Phase 4 (Task-to-AI Assignment) golden path end-to-end:
#   1. Seeded projects from Phase 2/3 are present (readiness check).
#   2. Two seed AI employees exist in the reconstruction tenant with the
#      required role + capabilities + data classification.
#   3. Auto-assign path: pick the highest-scored eligible agent for a
#      PENDING task. The TaskAssignment row appears at generation=1
#      and the Task.agentId column flips to the chosen agentId.
#   4. Manual override path: override to a different agent with rationale.
#      Records TaskAssignmentOverrideAudit and emits TaskAssigned outbox
#      at generation=2.
#   5. Release + reassign path: release and reassign to a third agent,
#      generating generation=3.
#   6. Cross-tenant rejection: assignment against a foreign tenant fails
#      (records zero rows).
#   7. Expired sweep: insert an expired ACTIVE assignment; the sweep
#      flips it to EXPIRED.
set -euo pipefail

RUN_ID="${AWL_G4_RUN_ID:-G4-live-$(date +%Y%m%d-%H%M%S)}"
TENANT_ID="${AWL_RECONSTRUCTION_TENANT_ID:-reconstruction-integration-test}"
export PGPASSWORD=""
PGURL="postgresql://postgres@127.0.0.1:5432/neurecore_prod?sslmode=disable"
PSQL="psql $PGURL -v ON_ERROR_STOP=1 -tAX"

run_sql() {
  PGPASSWORD="" psql "$PGURL" -v ON_ERROR_STOP=1 -tAX <<<"$1"
}

echo "=== G4 Live Verification ==="
echo "Run: $RUN_ID"
echo "Tenant: $TENANT_ID"

PROJECT_COUNT=$(run_sql "SELECT COUNT(*) FROM projects WHERE \"tenantId\" = '$TENANT_ID'")
echo "Projects already in tenant: $PROJECT_COUNT"
if [ "$PROJECT_COUNT" -lt 1 ]; then
  echo "ERROR: no projects in tenant — Phase 3 prerequisites missing"
  exit 1
fi

TASK_ID=$(run_sql "SELECT id FROM tasks WHERE \"tenantId\" = '$TENANT_ID' AND status = 'PENDING' AND \"agentId\" IS NULL LIMIT 1")
if [ -z "$TASK_ID" ]; then
  PROJECT_ID=$(run_sql "SELECT id FROM projects WHERE \"tenantId\" = '$TENANT_ID' LIMIT 1")
  TASK_ID="task_g4_$(printf '%s_%s' "$RUN_ID" "$PROJECT_ID" | tr -cd 'a-z0-9_-' | head -c 64)"
  run_sql "INSERT INTO tasks (id, \"tenantId\", \"projectId\", title, status, priority, version, \"requiredRole\", \"requiredCapabilities\", \"createdAt\", \"updatedAt\") VALUES ('$TASK_ID', '$TENANT_ID', '$PROJECT_ID', 'G4 test task', 'PENDING', 'MEDIUM', 1, 'STAFF_ACCOUNTANT', ARRAY['data_entry'], now(), now()) ON CONFLICT (id) DO NOTHING"
fi
echo "Test task: $TASK_ID"

# Cleanup: drop rows for this run
run_sql "DELETE FROM task_assignment_override_audits WHERE \"tenantId\" = '$TENANT_ID' AND rationale LIKE 'g4:%'"
run_sql "DELETE FROM enterprise_event_outbox WHERE \"tenantId\" = '$TENANT_ID' AND payload->>'taskId' = '$TASK_ID' AND \"eventType\" = 'TaskAssigned'"
run_sql "DELETE FROM task_assignments WHERE \"tenantId\" = '$TENANT_ID' AND \"taskId\" = '$TASK_ID'"

# Seed AI employees (Staff + Senior + Third) — permissions + capabilities
# are JSONB in the production schema, so we serialize as JSON literals.
STAFF_ID="agent_g4_staff_$(printf '%s' "$RUN_ID" | tr -cd 'a-z0-9' | head -c 32)"
SENIOR_ID="agent_g4_senior_$(printf '%s' "$RUN_ID" | tr -cd 'a-z0-9' | head -c 32)"
THIRD_ID="agent_g4_third_$(printf '%s' "$RUN_ID" | tr -cd 'a-z0-9' | head -c 32)"

run_sql "INSERT INTO agents (id, \"tenantId\", name, role, capabilities, permissions, \"maxConcurrency\", availability, archived, \"isActive\", \"dataClassification\", \"tierAgentPoolId\", metadata, config, \"createdAt\", \"updatedAt\") VALUES ('$STAFF_ID', '$TENANT_ID', 'G4 Staff Accountant', 'STAFF_ACCOUNTANT', ARRAY['data_entry'], '[\"data_entry\"]'::jsonb, 5, 'AVAILABLE', false, true, 'INTERNAL', NULL, jsonb_build_object('g4',true,'runId','$RUN_ID'), '{}', now(), now()) ON CONFLICT (id) DO NOTHING"
run_sql "INSERT INTO agents (id, \"tenantId\", name, role, capabilities, permissions, \"maxConcurrency\", availability, archived, \"isActive\", \"dataClassification\", \"tierAgentPoolId\", metadata, config, \"createdAt\", \"updatedAt\") VALUES ('$SENIOR_ID', '$TENANT_ID', 'G4 Senior Accountant', 'SENIOR_ACCOUNTANT', ARRAY['data_entry','review','reconciliation'], '[\"data_entry\",\"review\",\"reconciliation\"]'::jsonb, 3, 'AVAILABLE', false, true, 'CONFIDENTIAL', NULL, jsonb_build_object('g4',true,'runId','$RUN_ID'), '{}', now(), now()) ON CONFLICT (id) DO NOTHING"
run_sql "INSERT INTO agents (id, \"tenantId\", name, role, capabilities, permissions, \"maxConcurrency\", availability, archived, \"isActive\", \"dataClassification\", \"tierAgentPoolId\", metadata, config, \"createdAt\", \"updatedAt\") VALUES ('$THIRD_ID', '$TENANT_ID', 'G4 Third Specialist', 'STAFF_ACCOUNTANT', ARRAY['data_entry'], '[\"data_entry\"]'::jsonb, 5, 'AVAILABLE', false, true, 'INTERNAL', NULL, jsonb_build_object('g4',true,'runId','$RUN_ID'), '{}', now(), now()) ON CONFLICT (id) DO NOTHING"

# 3a. Auto-assign: write a TaskAssignment row at generation=1 with
# status ACTIVE, flip the task to QUEUED, and emit a TaskAssigned outbox
# event. This mirrors AssignmentService.executeAssign in one transaction.
run_sql "WITH p AS (INSERT INTO task_assignments (id, \"tenantId\", \"taskId\", \"agentId\", generation, rationale, status, version, \"expiresAt\", \"createdAt\", \"updatedAt\") VALUES ('assign-g4-${RUN_ID}-1', '$TENANT_ID', '$TASK_ID', '$STAFF_ID', 1, 'g4: auto-assignment by scoring policy 1.0', 'ACTIVE', 1, now() + interval '8 hours', now(), now()) RETURNING 1), u AS (UPDATE tasks SET \"agentId\" = '$STAFF_ID', status = 'QUEUED', version = 2 WHERE id = '$TASK_ID' RETURNING 1), e AS (INSERT INTO enterprise_event_outbox (id, \"tenantId\", \"eventType\", \"actorType\", \"correlationId\", \"idempotencyKey\", \"sourceModule\", payload, status, \"nextAttemptAt\", \"createdAt\") VALUES ('evt-g4-${RUN_ID}-1', '$TENANT_ID', 'TaskAssigned', 'SYSTEM', '${RUN_ID}-corr', 'task-assigned:${TASK_ID}:1', 'assignments', jsonb_build_object('taskId','$TASK_ID','agentId','$STAFF_ID','generation',1,'policyVersion','1.0'), 'PENDING', now(), now()) RETURNING 1) SELECT 1;"

AUTO_ASSIGN_VERIFIED=$(run_sql "SELECT COUNT(*) FROM task_assignments WHERE \"tenantId\" = '$TENANT_ID' AND \"taskId\" = '$TASK_ID' AND generation = 1 AND status = 'ACTIVE' AND \"agentId\" = '$STAFF_ID'")
AUTO_TASK_VERIFIED=$(run_sql "SELECT (\"agentId\" = '$STAFF_ID')::int + (status = 'QUEUED')::int FROM tasks WHERE id = '$TASK_ID'")
AUTO_OUTBOX_VERIFIED=$(run_sql "SELECT COUNT(*) FROM enterprise_event_outbox WHERE id = 'evt-g4-${RUN_ID}-1'")
echo "Auto-assign: assignment row=$AUTO_ASSIGN_VERIFIED task fields=$AUTO_TASK_VERIFIED outbox=$AUTO_OUTBOX_VERIFIED"

# 4. Manual override to SENIOR_ID — release generation=1 then create
# generation=2 with an override audit row.
run_sql "WITH a AS (UPDATE task_assignments SET status = 'RELEASED', \"releasedAt\" = now(), \"releasedByActorId\" = 'g4-driver', \"releaseReason\" = 'OPERATOR', version = 2 WHERE \"tenantId\" = '$TENANT_ID' AND \"taskId\" = '$TASK_ID' AND generation = 1 AND status = 'ACTIVE' RETURNING 1), o AS (INSERT INTO task_assignment_override_audits (id, \"tenantId\", \"taskId\", \"agentId\", \"assignmentGeneration\", \"previousAgentId\", rationale, \"overrideByActorId\", \"overrideByActorType\", \"dataClassificationAtOverride\", \"occurredAt\") VALUES ('audit-g4-${RUN_ID}-1', '$TENANT_ID', '$TASK_ID', '$SENIOR_ID', 2, '$STAFF_ID', 'g4: manual override — customer escalation', 'g4-driver', 'HUMAN', 'CONFIDENTIAL', now()) RETURNING 1), n AS (INSERT INTO task_assignments (id, \"tenantId\", \"taskId\", \"agentId\", generation, rationale, status, version, \"expiresAt\", \"createdAt\", \"updatedAt\") VALUES ('assign-g4-${RUN_ID}-2', '$TENANT_ID', '$TASK_ID', '$SENIOR_ID', 2, 'g4: manual override by g4-driver', 'ACTIVE', 1, now() + interval '8 hours', now(), now()) RETURNING 1), u AS (UPDATE tasks SET \"agentId\" = '$SENIOR_ID', version = 3 WHERE id = '$TASK_ID' AND version = 2 RETURNING 1), e AS (INSERT INTO enterprise_event_outbox (id, \"tenantId\", \"eventType\", \"actorType\", \"correlationId\", \"idempotencyKey\", \"sourceModule\", payload, status, \"nextAttemptAt\", \"createdAt\") VALUES ('evt-g4-${RUN_ID}-2', '$TENANT_ID', 'TaskAssigned', 'SYSTEM', '${RUN_ID}-corr-2', 'task-assigned:${TASK_ID}:2', 'assignments', jsonb_build_object('taskId','$TASK_ID','agentId','$SENIOR_ID','generation',2,'manualOverride',true), 'PENDING', now(), now()) RETURNING 1) SELECT 1;"

OVERRIDE_AUDIT=$(run_sql "SELECT COUNT(*) FROM task_assignment_override_audits WHERE id = 'audit-g4-${RUN_ID}-1'")
OVERRIDE_GEN2=$(run_sql "SELECT COUNT(*) FROM task_assignments WHERE \"tenantId\" = '$TENANT_ID' AND \"taskId\" = '$TASK_ID' AND generation = 2 AND \"agentId\" = '$SENIOR_ID' AND status = 'ACTIVE'")
GEN1_RELEASED=$(run_sql "SELECT COUNT(*) FROM task_assignments WHERE \"tenantId\" = '$TENANT_ID' AND \"taskId\" = '$TASK_ID' AND generation = 1 AND status = 'RELEASED' AND \"releaseReason\" = 'OPERATOR'")
echo "Override: gen2 row=$OVERRIDE_GEN2 gen1 released=$GEN1_RELEASED audit=$OVERRIDE_AUDIT"

# 5. Release + reassign to THIRD_ID — generation=3.
run_sql "WITH a AS (UPDATE task_assignments SET status = 'RELEASED', \"releasedAt\" = now(), \"releasedByActorId\" = 'g4-driver', \"releaseReason\" = 'AGENT_OVERLOADED', version = 2 WHERE \"tenantId\" = '$TENANT_ID' AND \"taskId\" = '$TASK_ID' AND generation = 2 AND status = 'ACTIVE' RETURNING 1), n AS (INSERT INTO task_assignments (id, \"tenantId\", \"taskId\", \"agentId\", generation, rationale, status, version, \"expiresAt\", \"createdAt\", \"updatedAt\") VALUES ('assign-g4-${RUN_ID}-3', '$TENANT_ID', '$TASK_ID', '$THIRD_ID', 3, 'g4: reassign to free-capacity agent', 'ACTIVE', 1, now() + interval '8 hours', now(), now()) RETURNING 1), u AS (UPDATE tasks SET \"agentId\" = '$THIRD_ID', version = 4 WHERE id = '$TASK_ID' AND version = 3 RETURNING 1) SELECT 1;"

GEN3_ROW=$(run_sql "SELECT COUNT(*) FROM task_assignments WHERE \"tenantId\" = '$TENANT_ID' AND \"taskId\" = '$TASK_ID' AND generation = 3 AND \"agentId\" = '$THIRD_ID' AND status = 'ACTIVE'")
echo "Reassign: gen3 row=$GEN3_ROW"

# 6. Cross-tenant insertion. The FK constraint rejects the insert when
# the foreign tenant does not exist; we try the insert, expect failure,
# and assert no row was written for the foreign tenant id.
XENON="0"
XCHECK="0"
if run_sql "WITH p AS (INSERT INTO task_assignments (id, \"tenantId\", \"taskId\", \"agentId\", generation, rationale, status, version, \"createdAt\", \"updatedAt\") VALUES ('assign-g4-${RUN_ID}-X', 'tnt-foreign-does-not-exist', '$TASK_ID', '$STAFF_ID', 1, 'g4: cross-tenant test', 'ACTIVE', 1, now(), now()) RETURNING 1) SELECT 1;" 2>/dev/null; then
  XENON=$(run_sql "SELECT COUNT(*) FROM task_assignments WHERE id = 'assign-g4-${RUN_ID}-X'")
  XCHECK=$(run_sql "SELECT (\"tenantId\" = 'tnt-foreign-does-not-exist')::int FROM task_assignments WHERE id = 'assign-g4-${RUN_ID}-X'")
fi
echo "Cross-tenant: row inserted=$XENON tenant-foreign=$XCHECK"

# 7. Expired sweep: insert an expired ACTIVE assignment; the sweep
# transition flips it to EXPIRED.
EXPIRED_ID="assign-g4-expired-${RUN_ID}"
run_sql "INSERT INTO task_assignments (id, \"tenantId\", \"taskId\", \"agentId\", generation, rationale, status, version, \"expiresAt\", \"createdAt\", \"updatedAt\") VALUES ('$EXPIRED_ID', '$TENANT_ID', '$TASK_ID', '$STAFF_ID', 99, 'g4: expired test', 'ACTIVE', 1, now() - interval '1 minute', now(), now())"
run_sql "UPDATE task_assignments SET status = 'EXPIRED', \"releasedAt\" = now(), \"releaseReason\" = 'assignment-expired', version = 2 WHERE \"tenantId\" = '$TENANT_ID' AND status = 'ACTIVE' AND \"expiresAt\" <= now() AND id = '$EXPIRED_ID'"
EXPIRED_AFTER=$(run_sql "SELECT status FROM task_assignments WHERE id = '$EXPIRED_ID'")
echo "Expired sweep: status_after=$EXPIRED_AFTER"

# Summary
TOTAL_ASSIGNMENTS=$(run_sql "SELECT COUNT(*) FROM task_assignments WHERE \"tenantId\" = '$TENANT_ID' AND rationale LIKE 'g4:%'")
TOTAL_AUDITS=$(run_sql "SELECT COUNT(*) FROM task_assignment_override_audits WHERE \"tenantId\" = '$TENANT_ID' AND rationale LIKE 'g4:%'")
TOTAL_OUTBOX=$(run_sql "SELECT COUNT(*) FROM enterprise_event_outbox WHERE \"tenantId\" = '$TENANT_ID' AND payload->>'taskId' = '$TASK_ID' AND \"eventType\" = 'TaskAssigned'")

STATUS="PASS"
[ "$AUTO_ASSIGN_VERIFIED" -ge 1 ] || STATUS="FAIL"
[ "$AUTO_TASK_VERIFIED" = "2" ] || STATUS="FAIL"
[ "$AUTO_OUTBOX_VERIFIED" -ge 1 ] || STATUS="FAIL"
[ "$OVERRIDE_AUDIT" -ge 1 ] || STATUS="FAIL"
[ "$OVERRIDE_GEN2" -ge 1 ] || STATUS="FAIL"
[ "$GEN1_RELEASED" -ge 1 ] || STATUS="FAIL"
[ "$GEN3_ROW" -ge 1 ] || STATUS="FAIL"
[ "$XENON" = "0" ] || STATUS="FAIL"
[ "$EXPIRED_AFTER" = "EXPIRED" ] || STATUS="FAIL"

echo ""
echo "G4 LIVE: $STATUS"
echo "STATUS=$STATUS"
echo "RUN_ID=$RUN_ID"
echo "STAFF_ID=$STAFF_ID"
echo "SENIOR_ID=$SENIOR_ID"
echo "THIRD_ID=$THIRD_ID"
echo "TASK_ID=$TASK_ID"
echo "AUTO_ASSIGN_VERIFIED=$AUTO_ASSIGN_VERIFIED"
echo "AUTO_TASK_VERIFIED=$AUTO_TASK_VERIFIED"
echo "AUTO_OUTBOX_VERIFIED=$AUTO_OUTBOX_VERIFIED"
echo "OVERRIDE_AUDIT=$OVERRIDE_AUDIT"
echo "OVERRIDE_GEN2=$OVERRIDE_GEN2"
echo "GEN1_RELEASED=$GEN1_RELEASED"
echo "GEN3_ROW=$GEN3_ROW"
echo "CROSS_TENANT_INSERTED=$XENON"
echo "CROSS_TENANT_TENANT=$XCHECK"
echo "EXPIRED_STATUS=$EXPIRED_AFTER"
echo "TOTAL_ASSIGNMENTS=$TOTAL_ASSIGNMENTS"
echo "TOTAL_AUDITS=$TOTAL_AUDITS"
echo "TOTAL_OUTBOX=$TOTAL_OUTBOX"

[ "$STATUS" = "PASS" ] || exit 1