import { PiiRedactor } from './pii-redactor';

describe('PiiRedactor (Phase 8 — §10.1 secret/PII redaction)', () => {
  let redactor: PiiRedactor;

  beforeEach(() => {
    redactor = new PiiRedactor();
  });

  it('redacts email addresses', () => {
    const result = redactor.redact(
      'Contact alice@example.com for details',
      false,
    );
    expect(result.redacted).toBe(true);
    expect(result.fields).toContain('email');
    expect(result.value).toBe('Contact [REDACTED_EMAIL] for details');
  });

  it('redacts phone numbers in common formats', () => {
    const result = redactor.redact('Call +1 (415) 555-1212 today', false);
    expect(result.redacted).toBe(true);
    expect(result.fields).toContain('phone');
    expect(result.value).not.toContain('415');
  });

  it('redacts inline api keys and passwords', () => {
    const result = redactor.redact(
      'creds: api_key=abcd1234efgh5678 password=hunter2',
      false,
    );
    expect(result.redacted).toBe(true);
    expect(result.fields).toContain('secret');
    expect(result.value).toContain('api_key=[REDACTED_SECRET]');
    expect(result.value).toContain('password=[REDACTED_SECRET]');
  });

  it('redacts bearer tokens when strict=true', () => {
    const result = redactor.redact('Authorization: Bearer abc.def.ghi', true);
    expect(result.redacted).toBe(true);
    expect(result.value).toBe('Authorization: Bearer [REDACTED_TOKEN]');
  });

  it('does not redact bearer tokens when strict=false', () => {
    const result = redactor.redact('Authorization: Bearer abc.def.ghi', false);
    expect(result.value).toBe('Authorization: Bearer abc.def.ghi');
  });

  it('returns redacted=false and unchanged value for clean input', () => {
    const result = redactor.redact(
      'plain operator note: ledger reconciled',
      false,
    );
    expect(result.redacted).toBe(false);
    expect(result.fields).toEqual([]);
    expect(result.value).toBe('plain operator note: ledger reconciled');
  });

  it('produces a stable sha-256 checksum for the same value', () => {
    const a = redactor.checksum('invoice-1234');
    const b = redactor.checksum('invoice-1234');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different checksums for different values', () => {
    expect(redactor.checksum('a')).not.toBe(redactor.checksum('b'));
  });
});
