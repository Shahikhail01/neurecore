-- ═══════════════════════════════════════════════════════════════════════════
-- 20260802_phase5_feature_snapshot
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Plan ref: NC-AWL-IMP-1 §Phase 5 — replace stub Prediction/Recommendation
-- providers with real, provenance-bearing, abstain-aware implementations.
--
-- Adds:
--   * `feature_snapshots` table — immutable, tenant-isolated feature
--     snapshots pinned to a (subjectType, subjectId, modelId) triple.
--   * Back-relation on `analytics_models` (featureSnapshots).
--   * Back-relation on `tenants` (featureSnapshots).
--
-- Tenant isolation: every row carries tenantId; the FeatureSnapshotRepository
-- always filters by tenantId. The (tenantId, subjectType, subjectId, recordedAt)
-- index supports the recent-snapshot query used by the abstain gate.

CREATE TABLE "feature_snapshots" (
    "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "tenantId"      TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "subjectType"   TEXT NOT NULL,
    "subjectId"     TEXT NOT NULL,
    "featuresJson"  JSONB NOT NULL,
    "modelId"       TEXT REFERENCES "analytics_models"("id"),
    "modelVersion"  TEXT,
    "snapshotHash"  TEXT NOT NULL,
    "recordedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "feature_snapshots_tenantId_subjectType_subjectId_recordedAt_idx"
    ON "feature_snapshots"("tenantId", "subjectType", "subjectId", "recordedAt");

CREATE INDEX "feature_snapshots_tenantId_modelId_idx"
    ON "feature_snapshots"("tenantId", "modelId");
