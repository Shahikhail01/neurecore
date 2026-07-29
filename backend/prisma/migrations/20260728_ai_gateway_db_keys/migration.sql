-- AI Gateway: persist API keys encrypted in DB (Phase 2.8)
--
-- Adds: model_providers.encryptedKey (nullable)
-- When set, SecretProviderService prefers this over the env var
-- (apiKeyEnv). The env var remains the fallback so legacy deployments
-- keep working until operators migrate.
--
-- Format: AES-256-GCM, <ivHex>:<tagHex>:<dataHex>, identical to
-- integration_credential.encryptedCredentials. Same key (ENCRYPTION_KEY).

ALTER TABLE "model_providers"
  ADD COLUMN IF NOT EXISTS "encryptedKey" TEXT;