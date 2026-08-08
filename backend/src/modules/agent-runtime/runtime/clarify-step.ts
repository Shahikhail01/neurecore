/**
 * Phase 23 — ClarifyStep implementation.
 *
 * Generates a typed, permission-safe clarification prompt. Never
 * silently succeeds; the AgentRuntime interprets a clarification as
 * a final status of `CLARIFICATION_REQUIRED`.
 *
 * SOLID — SRP: produces the prompt only, doesn't route or execute.
 * SOLID — ISP: implements the single narrow IClarifyStep interface.
 */

import { Injectable } from '@nestjs/common';
import {
  IClarifyStep,
  ClarifyRequest,
  ClarifyResult,
} from '../interfaces/agent-step.interface';

@Injectable()
export class ClarifyStep implements IClarifyStep {
  clarify(req: ClarifyRequest): ClarifyResult {
    switch (req.reason) {
      case 'unsupported_intent':
        return {
          prompt: `I'm not able to handle the intent "${req.intent}". Could you rephrase or pick one of the supported options below?`,
          suggestions: [
            'Summarize a document or thread',
            'Draft an email or report',
            'Extract structured fields from text',
            'Translate between languages',
            'Compare two pieces of text',
          ],
        };
      case 'missing_field':
        return {
          prompt: `To complete the "${req.intent}" request I need ${(
            req.missingFields ?? []
          ).join(', ')}. Could you provide that?`,
          suggestions: [],
        };
      case 'ambiguous_target':
        return {
          prompt: `I found more than one possible target for "${req.intent}". Which one did you mean?`,
          suggestions: [],
        };
      default:
        return {
          prompt: `I need more information to proceed with "${req.intent}".`,
          suggestions: [],
        };
    }
  }
}
