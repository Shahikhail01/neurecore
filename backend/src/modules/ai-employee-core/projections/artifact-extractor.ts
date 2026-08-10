import type { StepWithResult } from '../../work-runtime/contracts/work-runtime.interface';
import type { ArtifactReference } from '../contracts/employee-run.types';

/**
 * Extracts artifact references from completed step results.
 *
 * Steps whose `result.data` contains `artifactId` and `artifactType` are
 * treated as artifact-producing steps. Only SUCCEEDED steps are scanned.
 */
export function extractArtifactRefs(
  steps: readonly StepWithResult[],
): ArtifactReference[] {
  const refs: ArtifactReference[] = [];
  const seen = new Set<string>();

  for (const step of steps) {
    if (step.status !== 'SUCCEEDED') continue;
    const data = step.result as Record<string, unknown> | null;
    const artifactId = data?.['artifactId'];
    if (
      typeof artifactId !== 'string' ||
      !artifactId ||
      seen.has(artifactId)
    ) {
      continue;
    }
    seen.add(artifactId);
    refs.push(
      Object.freeze({
        id: artifactId,
        type: (data?.['artifactType'] as string) ?? 'REPORT',
        name: (data?.['artifactName'] as string) ?? 'Untitled',
      }),
    );
  }

  return refs;
}
