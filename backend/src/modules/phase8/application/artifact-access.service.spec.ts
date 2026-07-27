import {
  ArtifactAccessService,
  ArtifactAccessRequest,
} from './artifact-access.service';

function buildRequest(
  overrides: Partial<ArtifactAccessRequest> = {},
): ArtifactAccessRequest {
  return {
    tenantId: 'tnt-1',
    actorId: 'actor-1',
    actorType: 'HUMAN',
    artifactId: 'art-1',
    artifactOwnerTenantId: 'tnt-1',
    storageRef: 's3://neurecore/evidence/art-1.pdf?signature=abc',
    checksum: 'a'.repeat(64),
    operation: 'READ',
    correlationId: 'corr-1',
    ...overrides,
  };
}

describe('ArtifactAccessService (Phase 8 — §10.1 + §10.5 artifact access controls)', () => {
  let svc: ArtifactAccessService;

  beforeEach(() => {
    svc = new ArtifactAccessService();
  });

  it('allows same-tenant read', () => {
    const result = svc.check(buildRequest());
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('OK');
    expect(result.redactedRef).toBe('s3://neurecore/evidence/art-1.pdf');
  });

  it('rejects missing tenant context', () => {
    const result = svc.check(buildRequest({ tenantId: '' }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('MISSING_TENANT_CONTEXT');
  });

  it('rejects cross-tenant read with X_TENANT_NOT_FOUND (never 403)', () => {
    const result = svc.check(
      buildRequest({ tenantId: 'tnt-1', artifactOwnerTenantId: 'tnt-2' }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('X_TENANT_NOT_FOUND');
  });

  it('rejects when the checksum is missing or malformed', () => {
    expect(svc.check(buildRequest({ checksum: '' })).reason).toBe(
      'MISSING_CHECKSUM',
    );
    expect(svc.check(buildRequest({ checksum: 'short' })).reason).toBe(
      'INVALID_CHECKSUM',
    );
  });

  it('rejects DELETE attempted by a non-human actor', () => {
    const result = svc.check(
      buildRequest({ operation: 'DELETE', actorType: 'AI_AGENT' }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('DELETE_REQUIRES_HUMAN');
  });

  it('rejects AI write without explicit approval token', () => {
    const result = svc.check(
      buildRequest({ operation: 'WRITE', actorType: 'AI_AGENT' }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('AI_WRITE_REQUIRES_APPROVAL');
  });

  it('produces a stable sha-256 expected checksum', () => {
    const a = svc.expectedChecksum('hello');
    const b = svc.expectedChecksum(Buffer.from('hello'));
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('redacts signature/key query params in the storage ref', () => {
    const result = svc.check(
      buildRequest({
        storageRef: 's3://bkt/obj?signature=secret&token=t&key=k',
      }),
    );
    expect(result.redactedRef).toBe('s3://bkt/obj');
  });
});
