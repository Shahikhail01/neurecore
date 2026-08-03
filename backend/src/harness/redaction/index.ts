/**
 * NeureCore Harness - Redaction Module
 *
 * This module implements field-level redaction per §7.3:
 * - Apply redaction before persistence (§7.3)
 * - Apply redaction before UI display/export (§7.3)
 * - Detect and prohibit model hidden reasoning (§7.3)
 * - Tenant ID preservation for isolation verification (ADR-003 §2.4)
 *
 * Document ID: NC-HARNESS-REDACTION-001
 * Version: 2.0
 * Status: PHASE_2_IMPLEMENTED
 */

import type { RedactionRule } from './types';

export * from './types';

// ============================================================
// DEFAULT REDACTION RULES (per ADR-003 §2.4 + §7.3)
// ============================================================

export const DEFAULT_REDACTION_RULES: RedactionRule[] = [
  // PRESERVE: tenantId and harness IDs required for isolation verification
  { pattern: /tenantId/iu, replacement: undefined, preserve: true },
  { pattern: /runId/iu, replacement: undefined, preserve: true },
  { pattern: /scenarioId/iu, replacement: undefined, preserve: true },
  { pattern: /capabilityId/iu, replacement: undefined, preserve: true },
  { pattern: /correlationId/iu, replacement: undefined, preserve: true },
  { pattern: /actorId/iu, replacement: undefined, preserve: true },

  // REDACT: PII
  { pattern: /email/giu, replacement: 'redacted@example.com' },
  { pattern: /phone/giu, replacement: '***-***-XXXX' },
  { pattern: /ssn|social.?security/giu, replacement: '***-**-XXXX' },
  { pattern: /credit.?card|card.?number/giu, replacement: '****-****-****-XXXX' },

  // REDACT: secrets
  { pattern: /password|secret|credential|api.?key|private.?key/giu, replacement: '[REDACTED]' },

  // REDACT: names
  { pattern: /name/giu, replacement: '[REDACTED-NAME]' },

  // REDACT: addresses and IPs
  { pattern: /ip.?address/giu, replacement: 'xxx.xxx.xxx.xxx' },
  { pattern: /file.?path|filepath/giu, replacement: '[PATH]' },
];

// ============================================================
// MODEL HIDDEN REASONING DETECTION (§7.3)
// ============================================================

const MODEL_HIDDEN_REASONING_PATTERNS: RegExp[] = [
  /\bchain[-_ ]?of[-_ ]?thought\b/iu,
  /\binternal[-_ ]?reasoning\b/iu,
  /\bhidden[-_ ]?thinking\b/iu,
  /\bdeliberation\b/iu,
  /\bprivate[-_ ]?scratchpad\b/iu,
  /\bthought[-_ ]?process\b/iu,
  /\bstep[-_ ]?by[-_ ]?step[-_ ]?reasoning\b/iu,
  /\[REDACTED-CHAIN\]/u,
  /\[INTERNAL-MONOLOGUE\]/u,
];

const MODEL_HIDDEN_REASONING_KEYS: RegExp[] = [
  /^hiddenReasoning$/iu,
  /^internalReasoning$/iu,
  /^chainOfThought$/iu,
  /^reasoningSteps$/iu,
  /^scratchpad$/iu,
  /^internalMonologue$/iu,
  /^thinking$/iu,
];

export function containsModelHiddenReasoning(
  content: unknown,
): { found: boolean; reason?: string } {
  const findings = scanForHiddenReasoning(content, new WeakSet());
  if (findings.length > 0) {
    return { found: true, reason: findings.join('; ') };
  }
  return { found: false };
}

function scanForHiddenReasoning(
  obj: unknown,
  seen: WeakSet<object>,
): string[] {
  if (obj === null || obj === undefined) return [];
  const findings: string[] = [];

  if (typeof obj === 'string') {
    for (const pattern of MODEL_HIDDEN_REASONING_PATTERNS) {
      if (pattern.test(obj)) {
        findings.push(`string matches pattern: ${pattern.source}`);
        break;
      }
    }
    return findings;
  }

  // Handle Buffer (binary content from storage)
  if (typeof Buffer !== 'undefined' && obj instanceof Buffer) {
    const text = obj.toString('utf-8');
    for (const pattern of MODEL_HIDDEN_REASONING_PATTERNS) {
      if (pattern.test(text)) {
        findings.push(`buffer matches pattern: ${pattern.source}`);
        break;
      }
    }
    // Try to parse as JSON and recursively scan
    try {
      const parsed = JSON.parse(text);
      const subFindings = scanForHiddenReasoning(parsed, seen);
      for (const f of subFindings) findings.push(`buffer parsed: ${f}`);
    } catch {
      // not JSON, that's fine
    }
    return findings;
  }

  if (typeof obj !== 'object') return findings;

  if (seen.has(obj as object)) return findings;
  seen.add(obj as object);

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const child = obj[i];
      const childFindings = scanForHiddenReasoning(child, seen);
      for (const f of childFindings) findings.push(`[${i}]: ${f}`);
    }
    return findings;
  }

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    for (const pattern of MODEL_HIDDEN_REASONING_KEYS) {
      if (pattern.test(key)) {
        findings.push(`key matches: ${key}`);
      }
    }
    const valueFindings = scanForHiddenReasoning(value, seen);
    for (const f of valueFindings) findings.push(`${key}: ${f}`);
  }
  return findings;
}

// ============================================================
// SANITIZATION ENGINE
// ============================================================

export interface SanitizationResult {
  sanitized: unknown;
  fieldsRedacted: string[];
  fieldsPreserved: string[];
  redactedAt: string;
  redactedBy: string;
  attestation: string;
}

export function sanitizeObject(
  obj: unknown,
  rules: RedactionRule[] = DEFAULT_REDACTION_RULES,
): unknown {
  return applyRules(obj, rules);
}

export function sanitizeWithAttestation(
  obj: unknown,
  rules: RedactionRule[] = DEFAULT_REDACTION_RULES,
  redactedBy = 'sanitization-engine',
): SanitizationResult {
  const fieldsRedacted: string[] = [];
  const fieldsPreserved: string[] = [];
  const sanitized = applyRulesWithTracking(obj, rules, fieldsRedacted, fieldsPreserved, new WeakSet());

  return {
    sanitized,
    fieldsRedacted,
    fieldsPreserved,
    redactedAt: new Date().toISOString(),
    redactedBy,
    attestation: `Sanitized ${fieldsRedacted.length} fields, preserved ${fieldsPreserved.length} fields per ADR-003 §2.4 + §7.3`,
  };
}

function applyRules(
  obj: unknown,
  rules: RedactionRule[],
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    if (typeof obj === 'string') {
      let result = obj;
      for (const rule of rules) {
        if (!rule.preserve && rule.replacement !== undefined) {
          result = result.replace(rule.pattern, rule.replacement);
        }
      }
      return result;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => applyRules(item, rules, seen));
  }
  if (typeof obj === 'object') {
    if (seen.has(obj as object)) return obj;
    seen.add(obj as object);
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = applyRules(value, rules, seen);
    }
    return result;
  }
  return obj;
}

function applyRulesWithTracking(
  obj: unknown,
  rules: RedactionRule[],
  fieldsRedacted: string[],
  fieldsPreserved: string[],
  seen: WeakSet<object>,
): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    let result = obj;
    let wasRedacted = false;
    for (const rule of rules) {
      if (rule.preserve) continue;
      if (rule.replacement === undefined) continue;
      if (rule.pattern.test(result)) {
        result = result.replace(rule.pattern, rule.replacement);
        wasRedacted = true;
      }
    }
    if (wasRedacted) {
      // result-level redactions don't add to fieldsRedacted (no field name)
    }
    return result;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => applyRulesWithTracking(item, rules, fieldsRedacted, fieldsPreserved, seen));
  }

  if (typeof obj === 'object') {
    if (seen.has(obj as object)) return obj;
    seen.add(obj as object);

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      let preserved = false;
      for (const rule of rules) {
        if (rule.preserve && rule.pattern.test(key)) {
          preserved = true;
          fieldsPreserved.push(key);
          break;
        }
      }

      if (preserved) {
        result[key] = value;
        continue;
      }

      let redacted = false;
      if (typeof value === 'string') {
        let newValue = value;
        for (const rule of rules) {
          if (rule.preserve) continue;
          if (rule.replacement === undefined) continue;
          if (rule.pattern.test(key) || rule.pattern.test(value)) {
            newValue = newValue.replace(rule.pattern, rule.replacement);
            redacted = true;
          }
        }
        if (redacted) {
          fieldsRedacted.push(key);
          result[key] = newValue;
        } else {
          result[key] = applyRulesWithTracking(value, rules, fieldsRedacted, fieldsPreserved, seen);
        }
      } else {
        const sub = applyRulesWithTracking(value, rules, fieldsRedacted, fieldsPreserved, seen);
        if (sub !== value) {
          fieldsRedacted.push(key);
        }
        result[key] = sub;
      }
    }
    return result;
  }

  return obj;
}

export const REDACTION_VERSION = '2.0.0';