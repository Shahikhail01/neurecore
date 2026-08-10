/**
 * WorkPlanner — produces a structured, schema-validated WorkPlan (ADR-003 §6).
 *
 * Uses the AI Gateway (capability 'planning'). The planner NEVER executes tools
 * and may only reference tools in the actor's authorized view. Output is parsed
 * as strict JSON and validated; one bounded repair attempt is allowed.
 *
 * If the AI Gateway is unavailable, a deterministic minimal fallback plan is
 * produced from the authorized READ tools only (never a write) so the runtime
 * degrades safely rather than fabricating actions.
 */

import { Injectable, Logger } from '@nestjs/common';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import type {
  IWorkPlanner,
  PlanRequest,
  WorkPlan,
} from '../contracts/work-runtime.interface';
import { validatePlan, PlanValidationError } from './plan-schema.validator';

@Injectable()
export class WorkPlanner implements IWorkPlanner {
  private readonly logger = new Logger(WorkPlanner.name);

  constructor(private readonly aiGateway: AiGatewayService) {}

  async plan(req: PlanRequest): Promise<WorkPlan> {
    const toolNames = new Set(req.authorizedTools.map((t) => t.name));
    const systemPrompt = this.buildSystemPrompt(req);
    const userPrompt = this.buildUserPrompt(req);

    let rawJson: unknown;
    try {
      const resp = await this.aiGateway.invoke({
        tenantId: req.tenantId,
        capability: 'planning',
        systemPrompt,
        prompt: userPrompt,
        sourceModule: 'work-runtime.planner',
        temperature: 0,
      });
      rawJson = this.parseJson(resp.content);
    } catch (e) {
      this.logger.warn(
        `Planner LLM unavailable (${e instanceof Error ? e.message : e}); using safe fallback plan`,
      );
      return this.fallbackPlan(req);
    }

    try {
      return validatePlan(rawJson, toolNames);
    } catch (err) {
      if (!(err instanceof PlanValidationError)) throw err;
      // Bounded repair: one attempt, feeding the validation issues back.
      this.logger.debug(`Plan invalid, attempting one repair: ${err.issues.join('; ')}`);
      try {
        const resp = await this.aiGateway.invoke({
          tenantId: req.tenantId,
          capability: 'planning',
          systemPrompt,
          prompt:
            userPrompt +
            `\n\nYour previous plan was INVALID. Fix these issues and return ONLY valid JSON:\n- ${err.issues.join('\n- ')}`,
          sourceModule: 'work-runtime.planner.repair',
          temperature: 0,
        });
        return validatePlan(this.parseJson(resp.content), toolNames);
      } catch (e2) {
        this.logger.warn(
          `Plan repair failed (${e2 instanceof Error ? e2.message : e2}); using safe fallback`,
        );
        return this.fallbackPlan(req);
      }
    }
  }

  private buildSystemPrompt(req: PlanRequest): string {
    const tools = req.authorizedTools
      .map(
        (t) =>
          `- ${t.name} (${t.capability}, ${t.effect}${t.approvalSensitive ? ', requires approval' : ''}): ${t.description}`,
      )
      .join('\n');
    return [
      'You are the NeuroCore Work Planner. Produce a STRUCTURED EXECUTION PLAN as JSON only.',
      'You MUST NOT execute anything. You MUST only reference tools from the AUTHORIZED TOOLS list.',
      'You MUST NOT decide that governance or approval can be bypassed.',
      'Output strictly this JSON shape:',
      '{ "objective": string, "assumptions": string[], "requiredContextCapabilities": string[], "steps": [ { "id": string, "sequence": number, "description": string, "toolName": string, "capability": string, "input": object, "dependsOn": string[], "effect": "READ"|"INTERNAL_WRITE"|"EXTERNAL_WRITE", "expectedOutput": string } ], "completionCriteria": string[] }',
      '',
      'AUTHORIZED TOOLS:',
      tools || '(none — you may only produce a read-only or empty plan)',
    ].join('\n');
  }

  private buildUserPrompt(req: PlanRequest): string {
    // Organization summary carries authorization-aware context (access states).
    return [
      `Request: ${req.request}`,
      '',
      'Authorized organizational context (respect access states — DENIED/UNAVAILABLE are NOT zero):',
      JSON.stringify(req.organizationSummary).slice(0, 8000),
      '',
      'Return ONLY the JSON plan.',
    ].join('\n');
  }

  private parseJson(content: string): unknown {
    // Extract the first JSON object from the response.
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('planner response contained no JSON object');
    return JSON.parse(match[0]);
  }

  /** Safe fallback: a read-only plan (never a write) from authorized read tools. */
  private fallbackPlan(req: PlanRequest): WorkPlan {
    const readTools = req.authorizedTools.filter((t) => t.effect === 'READ');
    const os = req.organizationSummary as Record<string, unknown> | undefined;

    // Build the best available input from supplied context.
    const deducedInput = this.deduceFallbackInput(readTools, req, os);

    return {
      objective: `Answer: ${req.request}`,
      assumptions: ['LLM planner unavailable; degraded to read-only plan'],
      requiredContextCapabilities: [],
      steps: readTools.slice(0, 1).map((t, i) => ({
        id: `step-${i + 1}`,
        sequence: i + 1,
        description: `Read via ${t.name}`,
        toolName: t.name,
        capability: t.capability,
        input: deducedInput,
        dependsOn: [],
        effect: 'READ' as const,
        expectedOutput: 'context data',
      })),
      completionCriteria: ['read-only context returned'],
    };
  }

  /**
   * Deduce a minimally valid input for the first eligible READ tool.
   *
   * Priority:
   * 1. Non-skill namespace tools (e.g. approvals.list_pending) accept empty or
   *    simple inputs natively.
   * 2. Skill tools are supplied `{ text: req.request }` so the LLM still
   *    receives the user's request when inline text is acceptable.
   * 3. Context from the authorized organization summary (projectId, customerId,
   *    fileIds) is attached when present.
   */
  private deduceFallbackInput(
    readTools: Array<{ name: string; capability: string; description: string }>,
    req: PlanRequest,
    orgSummary?: Record<string, unknown>,
  ): Record<string, unknown> {
    const input: Record<string, unknown> = {};

    // Carried context from the authorized organization summary.
    if (orgSummary) {
      const keys = ['projectId', 'customerId', 'taskId', 'fileIds'];
      for (const k of keys) {
        const v = orgSummary[k];
        if (v !== undefined && v !== null) input[k] = v;
      }
    }

    // If the first eligible tool is a skill namespace tool, supply inline text.
    const firstTool = readTools[0];
    if (firstTool && firstTool.name.startsWith('skill.')) {
      if (!input['text']) {
        input['text'] = req.request.slice(0, 10_000);
      }
    }

    return input;
  }
}
