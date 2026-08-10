import { Injectable, Inject } from '@nestjs/common';
import type { RuntimeTool, RuntimeToolResult, ToolContext } from '../../work-runtime/contracts/work-runtime.interface';
import { ARTIFACT_STORAGE, type IArtifactStorage, type ArtifactRecord } from '../contracts/artifact-storage.interface';

/**
 * Persists a draft report artifact via the artifact storage port.
 *
 * Effect: INTERNAL_WRITE — creates a tenant-scoped report artifact.
 * Idempotency: deterministic artifact ID from step idempotency key.
 */
@Injectable()
export class ReportSaveDraftTool implements RuntimeTool {
  readonly name = 'reports.save_draft';
  readonly capability = 'artifacts';
  readonly description =
    'Save a draft report artifact. Requires title, content (markdown/html/plain), and mimeType. Returns the artifact reference with id and checksum.';
  readonly effect = 'INTERNAL_WRITE' as const;
  readonly requiredAuthority = 50;
  readonly approvalSensitive = false;
  readonly timeoutMs = 10_000;
  readonly maxRetries = 1;

  constructor(
    @Inject(ARTIFACT_STORAGE) private readonly storage: IArtifactStorage,
  ) {}

  validateInput(input: Record<string, unknown>): void {
    const title = input['title'];
    const content = input['content'];
    const mimeType = input['mimeType'];

    if (typeof title !== 'string' || title.trim() === '') {
      throw new Error('reports.save_draft requires non-empty string "title"');
    }
    if (typeof content !== 'string' || content.trim() === '') {
      throw new Error('reports.save_draft requires non-empty string "content"');
    }
    if (typeof mimeType !== 'string' || mimeType.trim() === '') {
      throw new Error('reports.save_draft requires "mimeType" string (e.g. text/markdown)');
    }
  }

  async execute(
    input: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<RuntimeToolResult> {
    try {
      const artifact = await this.storage.saveDraft({
        tenantId: ctx.tenantId,
        actorId: ctx.actorId,
        runId: ctx.runId,
        stepId: ctx.stepId,
        stepIdempotencyKey: `${ctx.runId}:${ctx.stepId}:reports.save_draft`,
        name: `${input['title']}`,
        title: input['title'] as string,
        content: input['content'] as string,
        mimeType: input['mimeType'] as string,
        projectId: input['projectId'] as string | undefined,
        customerId: input['customerId'] as string | undefined,
      });

      return {
        ok: true,
        data: {
          artifactId: artifact.id,
          artifactType: artifact.type,
          artifactName: artifact.name,
          mimeType: artifact.mimeType,
          checksum: artifact.checksum,
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        errorCode: 'ARTIFACT_PERSIST_FAILED',
        errorMessage: message,
        retryable: false,
      };
    }
  }
}
