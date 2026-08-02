import { Injectable, Logger } from '@nestjs/common';
import {
  DeterministicIntentClassifier,
  IntentRuleRegistry,
} from './intent-router';
import type {
  IntentInput,
  IntentDecision,
  IIntentClassifier,
} from '../interfaces';
import { TypedParameterExtractor } from './parameter-extractor';
import type { ExtractionInput } from '../interfaces';

/**
 * ClassifierService — Phase 2 thin wrapper.
 *
 * Exists for two reasons:
 *   1. The chat layer (chat.service.ts) wants a stable DI surface that
 *      fronts the deterministic classifier + parameter extractor + the
 *      intent-rule registry. Injecting `ClassifierService` instead of
 *      three separate tokens keeps call sites short and lets us add
 *      pre/post hooks (cache, metrics, context enrichment) in one place
 *      without touching every consumer.
 *   2. The plan calls for the deterministic-routing pipeline to be
 *      reusable from non-chat surfaces (CLI, scheduled jobs, future
 *      voice channels). Today those call only `classify(input)`.
 *
 * The thin wrapper preserves the synchronous nature of the
 * DeterministicIntentClassifier — `classify()` returns the
 * `IntentDecision` directly while `classifyAsync()` retains its
 * Promise-shaped signature for callers that already speak async.
 */
@Injectable()
export class ClassifierService implements IIntentClassifier {
  private readonly logger = new Logger(ClassifierService.name);

  constructor(
    private readonly classifier: DeterministicIntentClassifier,
    private readonly extractor: TypedParameterExtractor,
    private readonly registry: IntentRuleRegistry,
  ) {}

  getRuleVersion(): string {
    return this.registry.getVersion();
  }

  classify(input: IntentInput): Promise<IntentDecision> {
    return Promise.resolve(this.classifier.classify(input));
  }

  classifyAsync(input: IntentInput): Promise<IntentDecision> {
    return Promise.resolve(this.classifier.classifyAsync(input));
  }

  /**
   * Convenience for chat wiring — returns the decision and a typed
   * extraction result so callers don't have to chain `extract()` themselves.
   * The schema parameter matches the params schema registered for the
   * decision's capability, or any custom schema when no capability was
   * selected.
   */
  classifyAndExtract<T = unknown>(
    input: ExtractionInput,
  ): Promise<{ decision: IntentDecision; params: T | null }> {
    const decision = this.classifier.classify({ message: input.message });
    return this.extractor
      .extract(input)
      .then((params) => ({ decision, params: params as T | null }));
  }
}
