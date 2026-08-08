/**
 * Phase 25 — Transcript provider errors.
 *
 * Typed errors only. New code MUST throw one of these — never
 * `new Error(...)` — per the parity-completion SOLID standard.
 */

import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';

export class TranscriptProviderUnavailableError extends ServiceUnavailableException {
  constructor(
    message: string,
    readonly provider: string,
    readonly op: string,
  ) {
    super(message);
    this.name = 'TranscriptProviderUnavailableError';
  }
}

export class TranscriptProviderPayloadInvalidError extends ForbiddenException {
  constructor(
    message: string,
    readonly provider: string,
    readonly op: string,
  ) {
    super(message);
    this.name = 'TranscriptProviderPayloadInvalidError';
  }
}

export class TranscriptProviderAuthError extends ForbiddenException {
  constructor(
    message: string,
    readonly provider: string,
    readonly op: string,
  ) {
    super(message);
    this.name = 'TranscriptProviderAuthError';
  }
}
