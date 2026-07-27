ALTER TABLE "execution_attempts"
ADD COLUMN "taskInstructionsSnapshot" TEXT,
ADD COLUMN "inputSnapshot" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "projectContextSnapshot" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "promptVersion" TEXT,
ADD COLUMN "graphVersion" TEXT,
ADD COLUMN "modelVersion" TEXT,
ADD COLUMN "toolVersion" TEXT,
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "endedAt" TIMESTAMP(3),
ADD COLUMN "heartbeatAt" TIMESTAMP(3),
ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
ADD COLUMN "ownerToken" TEXT,
ADD COLUMN "fencingToken" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "tokensUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "costCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "toolCallCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "parentAttemptId" TEXT;

ALTER TABLE "execution_attempts" ADD CONSTRAINT "execution_attempts_parentAttemptId_fkey" FOREIGN KEY ("parentAttemptId") REFERENCES "execution_attempts"("id") ON DELETE SET NULL;
CREATE INDEX "execution_attempts_status_leaseExpiresAt_idx" ON "execution_attempts"("status", "leaseExpiresAt");
CREATE UNIQUE INDEX "reviews_attemptId_key" ON "reviews"("attemptId");

CREATE TABLE "execution_tool_calls" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "toolName" TEXT NOT NULL,
  "argumentsChecksum" TEXT NOT NULL,
  "resultChecksum" TEXT,
  "sideEffect" BOOLEAN NOT NULL DEFAULT false,
  "approvedByActorId" TEXT,
  "status" TEXT NOT NULL,
  "errorClassification" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "execution_tool_calls_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "execution_attempts"("id") ON DELETE CASCADE
);
CREATE INDEX "execution_tool_calls_tenantId_attemptId_idx" ON "execution_tool_calls"("tenantId", "attemptId");

CREATE TABLE "execution_budget_ledger" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "unit" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "execution_budget_ledger_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "execution_attempts"("id") ON DELETE CASCADE
);
CREATE INDEX "execution_budget_ledger_tenantId_attemptId_idx" ON "execution_budget_ledger"("tenantId", "attemptId");

CREATE TABLE "execution_concurrency_reservations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "execution_concurrency_reservations_attemptId_key" ON "execution_concurrency_reservations"("attemptId");
CREATE INDEX "execution_concurrency_reservations_tenantId_agentId_expiresAt_idx" ON "execution_concurrency_reservations"("tenantId", "agentId", "expiresAt");
