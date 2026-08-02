CREATE TABLE "work_run_context_snapshots" (
    "id" TEXT NOT NULL,
    "workRunId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "authority" INTEGER NOT NULL,
    "governanceBlocked" BOOLEAN NOT NULL DEFAULT false,
    "organizationSummary" JSONB NOT NULL,
    "policySource" TEXT NOT NULL,
    "planVersion" TEXT NOT NULL,
    "toolRegistrationsVersion" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_run_context_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "work_run_context_snapshots_workRunId_key" ON "work_run_context_snapshots"("workRunId");
CREATE INDEX "work_run_context_snapshots_tenantId_capturedAt_idx" ON "work_run_context_snapshots"("tenantId", "capturedAt");

ALTER TABLE "work_run_context_snapshots" ADD CONSTRAINT "work_run_context_snapshots_workRunId_fkey" FOREIGN KEY ("workRunId") REFERENCES "work_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_run_context_snapshots" ADD CONSTRAINT "work_run_context_snapshots_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
