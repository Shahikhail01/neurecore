-- 20260802_oob_agent_audit_actions
-- Plan ref: NC-AI-CREATIO-PARITY-V3 / P4 — adds OOB-specific values to the
-- AgentLifecycleAuditAction enum so the OOTB agent registration service
-- can record its own lifecycle events (CREATE_OOB_VERSION, ACTIVATE_OOB).
--
-- These values are additive; they do not change the meaning of existing
-- values. Forward-only; no rollback path needed beyond restoring the DB
-- from a snapshot taken before this migration.

ALTER TYPE "AgentLifecycleAuditAction" ADD VALUE IF NOT EXISTS 'ACTIVATE_OOB';
ALTER TYPE "AgentLifecycleAuditAction" ADD VALUE IF NOT EXISTS 'CREATE_OOB_VERSION';
ALTER TYPE "AgentLifecycleAuditAction" ADD VALUE IF NOT EXISTS 'SUSPEND_OOB';
ALTER TYPE "AgentLifecycleAuditAction" ADD VALUE IF NOT EXISTS 'RETIRE_OOB';