/**
 * PII Detection & Masking — Domain Interfaces
 *
 * SOLID: Interface Segregation — callers depend only on the minimal contract
 * they need (detect-only vs mask-only vs full pipeline).
 * SOLID: Dependency Inversion — concrete implementations are never imported
 * by consumers; only these interfaces are.
 */

/** Categories of personally identifiable information we can detect. */
export type PiiEntityType =
  | 'EMAIL'
  | 'PHONE_US'
  | 'SSN'
  | 'CREDIT_CARD'
  | 'IP_ADDRESS';

/**
 * A single PII occurrence found inside a text string.
 *
 * `start`/`end` are byte-indices into the original string so that callers can
 * splice-replace without requiring a second scan.
 */
export interface PiiEntity {
  readonly type: PiiEntityType;
  readonly value: string;
  /** Inclusive start index in the source string. */
  readonly start: number;
  /** Exclusive end index in the source string. */
  readonly end: number;
}

/**
 * Lightweight payload returned after masking.
 * `masked` is the sanitised version; `detections` logs what was replaced.
 */
export interface PiiMaskingResult {
  readonly masked: string;
  readonly detections: readonly PiiEntity[];
}

/** Detects PII entities in a plain-text string. */
export interface IPiiDetector {
  detect(text: string): PiiEntity[];
}

/**
 * Given a text and a list of detected entities, produces a masked copy.
 * The caller is responsible for providing accurate entity positions —
 * the masker does not re-run detection.
 */
export interface IPiiMasker {
  mask(text: string, entities: PiiEntity[]): string;
}

/**
 * High-level PII middleware: detect + mask in a single call.
 * Used by SecurityInterceptorService to sanitise agent inputs/outputs.
 */
export interface IPiiMiddleware {
  sanitise(text: string): PiiMaskingResult;
}
