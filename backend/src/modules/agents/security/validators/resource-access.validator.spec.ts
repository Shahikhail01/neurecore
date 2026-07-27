// src/modules/agents/security/validators/resource-access.validator.spec.ts
// Phase 8 — §10.5 resource access control tests.
import { ResourceAccessValidator } from './resource-access.validator';

describe('ResourceAccessValidator (Phase 8 — §10.5 artifact + resource access controls)', () => {
  let svc: ResourceAccessValidator;

  beforeEach(() => {
    svc = new ResourceAccessValidator();
  });

  it('blocks access to /etc/passwd', () => {
    const result = svc.validate('/etc/passwd', 'read');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('passwd');
  });

  it('blocks access to /etc/shadow', () => {
    expect(svc.validate('/etc/shadow', 'read').allowed).toBe(false);
  });

  it('blocks access to /etc/sudoers', () => {
    expect(svc.validate('/etc/sudoers', 'read').allowed).toBe(false);
  });

  it('blocks access to /root/', () => {
    expect(svc.validate('/root/anything', 'read').allowed).toBe(false);
  });

  it('blocks access to /home directory listings (private home dirs)', () => {
    const result = svc.validate('/home/alice/.ssh/id_rsa', 'read');
    expect(result.allowed).toBe(false);
  });

  it('blocks directory traversal attempts', () => {
    expect(svc.validate('/workspace/../etc/passwd', 'read').allowed).toBe(
      false,
    );
    expect(
      svc.validate('/uploads/../../../root/.aws/credentials', 'read').allowed,
    ).toBe(false);
  });

  it('permits reads inside /workspace/', () => {
    expect(svc.validate('/workspace/reports/q1.pdf', 'read').allowed).toBe(
      true,
    );
  });

  it('permits reads inside /uploads/', () => {
    expect(svc.validate('/uploads/avatar-1.png', 'read').allowed).toBe(true);
  });

  it('rejects empty resource strings', () => {
    expect(svc.validate('', 'read').allowed).toBe(false);
  });

  it('blocks writes to /boot/', () => {
    expect(svc.validate('/boot/grub/grub.cfg', 'write').allowed).toBe(false);
  });

  it('permits writes inside /workspace/', () => {
    expect(svc.validate('/workspace/reports/new.txt', 'write').allowed).toBe(
      true,
    );
  });
});
