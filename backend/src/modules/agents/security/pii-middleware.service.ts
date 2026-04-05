/**
 * PiiMiddlewareService
 *
 * SOLID: SRP — Orchestrates detect + mask in a single pass.
 * SOLID: DIP — Depends on the abstract IPiiDetector and IPiiMasker interfaces,
 *              not concrete implementations.
 * SOLID: OCP — New detectors/maskers can be swapped in via DI tokens without
 *              touching this class.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import type {
  IPiiDetector,
  IPiiMasker,
  IPiiMiddleware,
  PiiMaskingResult,
} from './interfaces/pii.interfaces';

@Injectable()
export class PiiMiddlewareService implements IPiiMiddleware {
  private readonly logger = new Logger(PiiMiddlewareService.name);

  constructor(
    @Inject('IPiiDetector') private readonly detector: IPiiDetector,
    @Inject('IPiiMasker') private readonly masker: IPiiMasker,
  ) {}

  /**
   * Detect and mask all PII in `text`.
   *
   * Always succeeds — if an unexpected error occurs during detection the
   * original text is returned unmodified (fail-open for availability) and
   * a warning is emitted to the logger.
   */
  sanitise(text: string): PiiMaskingResult {
    try {
      const detections = this.detector.detect(text);
      if (detections.length === 0) {
        return { masked: text, detections: [] };
      }

      const masked = this.masker.mask(text, detections);
      this.logger.debug(
        `PII sanitised: ${detections.length} entit${detections.length === 1 ? 'y' : 'ies'} redacted`,
      );

      return { masked, detections };
    } catch (err: unknown) {
      this.logger.warn(`PII sanitisation failed unexpectedly: ${String(err)}`);
      return { masked: text, detections: [] };
    }
  }
}
