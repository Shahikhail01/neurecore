-- FIX-DEP-D3 (Round-3 verification, 2026-07-24):
-- Add APPROVAL_CHAIN to the TemplateType enum so
-- `GET /tenant-templates?type=APPROVAL_CHAIN` no longer crashes
-- (Prisma would otherwise throw `Invalid value 'APPROVAL_CHAIN' for enum 'TemplateType'`).
--
-- Also tighten: the controller's @Query('type') already validates the value
-- via `@Query type?: TemplateType`, but Prisma still receives the raw string
-- from the query and explodes when the value is unknown. Adding the enum
-- value here makes the BE accept the new template type and lets us add an
-- ApprovalChainValidator in a follow-up without a second migration.

ALTER TYPE "template_type" ADD VALUE IF NOT EXISTS 'APPROVAL_CHAIN';