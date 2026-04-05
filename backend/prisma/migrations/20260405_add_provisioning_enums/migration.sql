-- Create enum types for workspace provisioning feature
CREATE TYPE "ProvisioningProvider" AS ENUM ('GOOGLE_WORKSPACE', 'MICROSOFT_365');
CREATE TYPE "ProvisioningConfigStatus" AS ENUM ('PENDING_CONNECT', 'CONNECTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED');
CREATE TYPE "ProvisioningJobStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED');
CREATE TYPE "EmailPattern" AS ENUM ('FIRST_DOT_LAST', 'FIRSTLAST', 'F_DOT_LAST');
CREATE TYPE "FolderStructure" AS ENUM ('BY_DEPARTMENT', 'FLAT');

-- Alter provisioning_configs columns from TEXT to proper enum types
ALTER TABLE provisioning_configs
  ALTER COLUMN provider TYPE "ProvisioningProvider" USING provider::"ProvisioningProvider",
  ALTER COLUMN status TYPE "ProvisioningConfigStatus" USING status::"ProvisioningConfigStatus",
  ALTER COLUMN "emailPattern" TYPE "EmailPattern" USING "emailPattern"::"EmailPattern",
  ALTER COLUMN "folderStructure" TYPE "FolderStructure" USING "folderStructure"::"FolderStructure";

-- Set defaults on provisioning_configs
ALTER TABLE provisioning_configs
  ALTER COLUMN status SET DEFAULT 'PENDING_CONNECT'::"ProvisioningConfigStatus",
  ALTER COLUMN "emailPattern" SET DEFAULT 'FIRST_DOT_LAST'::"EmailPattern",
  ALTER COLUMN "folderStructure" SET DEFAULT 'BY_DEPARTMENT'::"FolderStructure";

-- Alter provisioning_jobs columns from TEXT to proper enum types
ALTER TABLE provisioning_jobs
  ALTER COLUMN status TYPE "ProvisioningJobStatus" USING status::"ProvisioningJobStatus";

-- Set defaults on provisioning_jobs
ALTER TABLE provisioning_jobs
  ALTER COLUMN status SET DEFAULT 'PENDING'::"ProvisioningJobStatus";

-- Add index on configId for provisioning_jobs
CREATE INDEX IF NOT EXISTS provisioning_jobs_configId_idx ON provisioning_jobs ("configId");
