import { z } from 'zod';

export const HarnessEnvironmentSchema = z.enum([
  'LOCAL',
  'CI',
  'STAGING',
  'PRODUCTION_PROBE',
  'PRODUCTION',
]);

export const CreateHarnessRunSchema = z
  .object({
    capabilityId: z.string().min(1),
    scenarioId: z.string().min(1),
    tenantId: z.string().uuid().nullable().optional(),
    environment: HarnessEnvironmentSchema,
    runPolicyId: z.string().uuid(),
    destructive: z.boolean().default(false),
    budgetUsd: z.number().positive(),
    idempotencyKey: z.string().min(8).max(200),
    replayOfRunId: z.string().uuid().optional(),
  })
  .strict();

export const CreateHarnessChangeSchema = z
  .object({
    kind: z.enum(['SCENARIO', 'PROMPT', 'RUBRIC', 'DATASET', 'POLICY']),
    key: z.string().min(1),
    ownerId: z.string().min(1),
    reviewDate: z.string().datetime(),
    content: z.record(z.unknown()),
    rollbackData: z.record(z.unknown()).optional(),
    evaluationRunId: z.string().uuid().optional(),
  })
  .strict();

export const CreateHarnessWaiverSchema = z
  .object({
    capabilityId: z.string().min(1),
    scope: z.string().min(1),
    reason: z.string().min(1),
    compensatingControl: z.string().min(1),
    ownerId: z.string().min(1),
    issueLink: z.string().url(),
    expiresAt: z.string().datetime(),
  })
  .strict()
  .refine((value) => Date.parse(value.expiresAt) > Date.now(), {
    message: 'expiresAt must be in the future',
  });

export const CreateHarnessReplaySchema = z
  .object({
    sourceRunId: z.string().uuid(),
    environment: HarnessEnvironmentSchema,
    externalSideEffects: z.boolean().default(false),
    schemaVersion: z.string().min(1),
    manifest: z.record(z.unknown()),
  })
  .strict()
  .refine((value) => value.environment !== 'PRODUCTION' || !value.externalSideEffects, {
    message: 'PRODUCTION replays with external side effects are forbidden',
  });

export const RevokeSchema = z.object({ reason: z.string().min(1) }).strict();

export type CreateHarnessRun = z.infer<typeof CreateHarnessRunSchema>;
export type CreateHarnessChange = z.infer<typeof CreateHarnessChangeSchema>;
export type CreateHarnessWaiver = z.infer<typeof CreateHarnessWaiverSchema>;
export type CreateHarnessReplay = z.infer<typeof CreateHarnessReplaySchema>;
