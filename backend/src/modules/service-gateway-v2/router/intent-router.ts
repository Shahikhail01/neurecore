/**
 * Deterministic Intent Router — Phase 2
 *
 * Removes model-dependent capability selection while preserving natural-language
 * flexibility. All routing is deterministic given the same input and rule version.
 *
 * Routing precedence:
 *   explicit UI action/context
 *     > exact command grammar
 *     > registered entity-operation rule
 *     > constrained structured classifier
 *     > clarification
 *     > unsupported response
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  IntentInput,
  IntentDecision,
  IntentType,
  RoutingDecision,
} from '../interfaces';
import { CAPABILITY_MAP } from '../../chat/responses/maps/capability-map';

export interface IntentRule {
  id: string;
  version: string;
  intent: IntentType;
  entityPatterns: RegExp[];
  operationPatterns?: RegExp[];
  priority: number;
  capability?: string;
  requiresClarification?: boolean;
}

@Injectable()
export class IntentRuleRegistry {
  private readonly logger = new Logger(IntentRuleRegistry.name);
  private readonly rules: IntentRule[] = [];
  private currentVersion = '1.0.0';

  register(rule: IntentRule): void {
    if (this.rules.some((r) => r.id === rule.id)) {
      throw new Error(`Duplicate rule identifier: ${rule.id}`);
    }
    if (!Number.isInteger(rule.priority)) {
      throw new Error(`Rule priority must be an integer: ${rule.id}`);
    }
    for (const pattern of [
      ...rule.entityPatterns,
      ...(rule.operationPatterns ?? []),
    ]) {
      if (pattern.global || pattern.sticky) {
        throw new Error(
          `Global and sticky regex flags are not deterministic: ${rule.id}`,
        );
      }
    }
    if (
      rule.capability &&
      !Object.prototype.hasOwnProperty.call(CAPABILITY_MAP, rule.capability)
    ) {
      throw new Error(
        `Unknown capability for rule ${rule.id}: ${rule.capability}`,
      );
    }
    this.rules.push(rule);
    this.rules.sort(
      (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
    );
    this.logger.log(`Registered intent rule: ${rule.id} (${rule.intent})`);
  }

  get(id: string): IntentRule | undefined {
    return this.rules.find((r) => r.id === id);
  }

  list(): IntentRule[] {
    return [...this.rules];
  }

  getVersion(): string {
    return this.currentVersion;
  }

  setVersion(v: string): void {
    this.currentVersion = v;
  }

  /**
   * Bootstrap the registry with one READ rule per active capability in
   * CAPABILITY_MAP. Each rule fires when the user message contains the
   * canonical capability name OR one of the entity synonyms for that
   * capability. Priority is the rule's order in the canonical map,
   * giving later rules lower priority so alphabetical ordering stays
   * stable.
   *
   * Idempotent: re-running it after rules were already registered is a
   * no-op (the registry throws on duplicate ids).
   */
  registerBuiltInRules(): IntentRule[] {
    const alreadyRegistered = new Set(this.rules.map((r) => r.id));
    const priorities = buildBuiltInPriorities();

    const registered: IntentRule[] = [];
    for (const [capability, meta] of builtInReadCapabilities()) {
      const id = `builtIn:${capability}`;
      if (alreadyRegistered.has(id)) continue;
      const rule: IntentRule = {
        id,
        version: '1.0.0',
        intent: 'READ',
        entityPatterns: [entityPatternFor(meta.entity)],
        operationPatterns: [operationPatternFor(meta.operation)],
        priority: priorities.get(capability) ?? 50,
        capability,
      };
      this.register(rule);
      registered.push(rule);
    }
    return registered;
  }
}

/**
 * Mapping of every active CAPABILITY_MAP READ capability to the entity /
 * operation regex sources used by registerBuiltInRules().
 */
function builtInReadCapabilities(): Array<
  [string, { entity: string; operation: string }]
> {
  const ops: Record<string, { entity: string; operation: string }> = {
    listProjects: { entity: 'project', operation: 'list' },
    getProject: { entity: 'project', operation: 'detail' },
    listCustomers: { entity: 'customer', operation: 'list' },
    getCustomer: { entity: 'customer', operation: 'detail' },
    listGoals: { entity: 'goal', operation: 'list' },
    getGoal: { entity: 'goal', operation: 'detail' },
    listTasks: { entity: 'task', operation: 'list' },
    getTask: { entity: 'task', operation: 'detail' },
    listDepartments: { entity: 'department', operation: 'list' },
    getDepartment: { entity: 'department', operation: 'detail' },
    listAgents: { entity: 'agent', operation: 'list' },
    getAgent: { entity: 'agent', operation: 'detail' },
    listApprovals: { entity: 'approval', operation: 'list' },
    getApproval: { entity: 'approval', operation: 'detail' },
    getDashboardSummary: { entity: 'dashboard', operation: 'summary' },
    listWorkflows: { entity: 'workflow', operation: 'list' },
    getWorkflow: { entity: 'workflow', operation: 'detail' },
    listDeliverables: { entity: 'deliverable', operation: 'list' },
    getDeliverable: { entity: 'deliverable', operation: 'detail' },
    listAssignments: { entity: 'assignment', operation: 'list' },
    listInboxItems: { entity: 'inbox', operation: 'list' },
    getInboxItem: { entity: 'inbox', operation: 'detail' },
    getCostReport: { entity: 'cost', operation: 'list' },
    getCostByDepartment: { entity: 'cost', operation: 'detail' },
    getCostByAgent: { entity: 'cost', operation: 'detail' },
    getComplianceStatus: { entity: 'compliance', operation: 'summary' },
    knowledgeSearch: { entity: 'knowledge', operation: 'search' },
    listConnectors: { entity: 'connector', operation: 'list' },
    getConnectorStatus: { entity: 'connector', operation: 'detail' },
    listIntegrationCredentials: { entity: 'integration', operation: 'list' },
    getIntegrationStatus: { entity: 'integration', operation: 'summary' },
    listWorkRuns: { entity: 'workrun', operation: 'list' },
    getWorkRun: { entity: 'workrun', operation: 'detail' },
    commandCenterSummary: { entity: 'commandcenter', operation: 'summary' },
  };
  // Filter to whatever is currently in CAPABILITY_MAP so an addition in
  // the capability map automatically registers a rule.
  return Object.keys(CAPABILITY_MAP)
    .filter((cap): cap is keyof typeof ops => cap in ops)
    .map(
      (cap) =>
        [cap, ops[cap]] as [string, { entity: string; operation: string }],
    );
}

function buildBuiltInPriorities(): Map<string, number> {
  // Default priority for built-in rules. Existing manual rules with
  // explicitAction pre-empt everything; built-in rules fire as a tier of
  // their own. Priority is integer 100 minus the rule index so they can
  // be overridden by manual rules with priority > 100 if needed.
  const map = new Map<string, number>();
  let i = 0;
  for (const [capability] of builtInReadCapabilities()) {
    map.set(capability, 100 - i);
    i += 1;
  }
  return map;
}

function entityPatternFor(entity: string): RegExp {
  const synonyms = ENTITY_SYNONYMS[entity] ?? [entity];
  return new RegExp(`\\b(?:${synonyms.map(escape).join('|')})\\b`, 'i');
}

function operationPatternFor(operation: string): RegExp {
  const patterns: Record<string, RegExp> = {
    list: /\b(?:list|show|get all|find all|search|browse)\b/i,
    detail: /\b(?:get|fetch|show me|tell me about|details?|info|open)\b/i,
    summary: /\b(?:summary|overview|dashboard|metrics?|stats?|status)\b/i,
  };
  return patterns[operation] ?? patterns['list'];
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ENTITY_SYNONYMS: Record<string, string[]> = {
  project: ['project', 'projects', 'initiative', 'deal'],
  task: ['task', 'tasks', 'todo', 'item', 'action'],
  goal: ['goal', 'goals', 'objective', 'target'],
  customer: [
    'customer',
    'customers',
    'client',
    'clients',
    'account',
    'accounts',
  ],
  department: ['department', 'departments', 'team', 'teams', 'division'],
  agent: ['agent', 'agents', 'ai', 'employee', 'staff'],
  approval: ['approval', 'approvals', 'review', 'reviews'],
  workflow: ['workflow', 'workflows', 'process', 'automation'],
  deliverable: ['deliverable', 'deliverables', 'artifact', 'output'],
  assignment: ['assignment', 'assignments', 'eligible', 'match'],
  inbox: ['inbox', 'notification', 'notifications', 'message', 'messages'],
  cost: ['cost', 'costs', 'cost report', 'spend', 'expense'],
  compliance: ['compliance', 'checklist', 'audit', 'control'],
  knowledge: ['knowledge', 'docs', 'documentation', 'wiki', 'article'],
  connector: ['connector', 'connectors', 'crm', 'integration connector'],
  integration: [
    'integration',
    'integrations',
    'google',
    'brevo',
    'oauth',
    'credential',
  ],
  workrun: ['work run', 'work runs', 'run', 'runs', 'execution run'],
  commandcenter: [
    'command center',
    'command-center',
    'commandcenter',
    'control center',
    'control center summary',
  ],
  dashboard: ['dashboard', 'summary', 'overview', 'metrics', 'stats'],
};

const INTENT_PATTERNS: Record<string, RegExp[]> = {
  READ: [
    /\b(show|list|get|find|search|view|display|see|tell me|what is|what are|how many)\b/i,
    /\b(dashboard|summary|overview|report|status)\b/i,
  ],
  MUTATION: [
    /\b(create|add|new|update|edit|delete|remove|archive|assign|unassign|mark|rename|change|reopen|clone|duplicate|submit|approve|reject|cancel|configure|enable|disable|send|schedule)\b/i,
  ],
  ADVICE: [/\b(should|recommend|suggest|advise|hint|tip|next best)\b/i],
  NAVIGATION: [/\b(go to|navigate|open|close|back|home|dashboard)\b/i],
  HELP: [/\b(help|what can|commands|options|available)\b/i],
};

@Injectable()
export class DeterministicIntentClassifier {
  private readonly logger = new Logger(DeterministicIntentClassifier.name);
  private readonly routingLog: RoutingDecision[] = [];

  constructor(private readonly ruleRegistry: IntentRuleRegistry) {}

  /**
   * Deterministic classification. Synchronous on purpose: the routing
   * decision is computed entirely from registered regex patterns and never
   * needs to await external IO. The async wrapper `classifyAsync` exists
   * to satisfy callers that already speak Promise (e.g. legacy code).
   */
  classify(input: IntentInput): IntentDecision {
    return this.classifyInternal(input);
  }

  async classifyAsync(input: IntentInput): Promise<IntentDecision> {
    return this.classifyInternal(input);
  }

  private classifyInternal(input: IntentInput): IntentDecision {
    const message = input.message.toLowerCase().trim();
    const context = input.context ?? {};

    // 1. Check explicit UI action/context first (highest precedence)
    if (context['explicitAction']) {
      const explicitAction = context['explicitAction'];
      if (
        typeof explicitAction !== 'string' ||
        !Object.prototype.hasOwnProperty.call(CAPABILITY_MAP, explicitAction)
      ) {
        return this.makeDecision(
          'UNSUPPORTED',
          undefined,
          undefined,
          0,
          'invalid_explicit_action',
        );
      }
      return this.makeDecision(
        'READ',
        explicitAction,
        undefined,
        1.0,
        'explicit_context',
      );
    }

    // 2. Check exact command grammar
    const exactMatch = this.matchExactGrammar(message);
    if (exactMatch) {
      return exactMatch;
    }

    // 3. Match against registered entity-operation rules
    const entityMatch = this.matchEntityOperation(message);
    if (entityMatch) {
      return entityMatch;
    }

    // 4. Constrained intent classification
    const intentMatch = this.classifyIntent(message);
    if (intentMatch.confidence >= 0.9) {
      return intentMatch;
    }

    // 5. Check for clarification candidates
    const candidates = this.findAmbiguityCandidates(message);
    if (candidates.length > 0) {
      return {
        intent: 'UNSUPPORTED',
        confidence: 0.5,
        ruleId: 'ambiguity',
        candidates,
      };
    }

    // 6. Unsupported
    return this.makeDecision(
      'UNSUPPORTED',
      undefined,
      undefined,
      0.0,
      'no_match',
    );
  }

  private matchExactGrammar(message: string): IntentDecision | null {
    const commands: Record<
      string,
      { intent: IntentType; entity?: string; operation?: string }
    > = {
      '/dashboard': { intent: 'READ', entity: 'dashboard' },
      '/projects': { intent: 'READ', entity: 'project' },
      '/tasks': { intent: 'READ', entity: 'task' },
      '/help': { intent: 'HELP' },
    };

    for (const [cmd, meta] of Object.entries(commands)) {
      if (message.startsWith(cmd)) {
        return this.makeDecision(
          meta.intent,
          meta.entity,
          meta.operation,
          1.0,
          `exact:${cmd}`,
        );
      }
    }

    return null;
  }

  private matchEntityOperation(message: string): IntentDecision | null {
    const rules = this.ruleRegistry.list();

    for (const rule of rules) {
      for (const entityPattern of rule.entityPatterns) {
        if (entityPattern.test(message)) {
          const operation = rule.operationPatterns
            ? this.extractOperation(message, rule.operationPatterns)
            : undefined;

          return {
            intent: rule.intent,
            entity: this.normalizeEntity(entityPattern.source),
            operation,
            confidence: 0.95,
            ruleId: rule.id,
          };
        }
      }
    }

    // Fallback: detect entity and operation from patterns
    for (const [entity, synonyms] of Object.entries(ENTITY_SYNONYMS)) {
      const entityRegex = new RegExp(`\\b(${synonyms.join('|')})\\b`, 'i');
      if (entityRegex.test(message)) {
        const intent = this.classifyIntentType(message);
        return {
          intent,
          entity,
          operation: this.extractOperationFromIntent(message, intent),
          confidence: 0.85,
          ruleId: 'entity_fallback',
        };
      }
    }

    return null;
  }

  private classifyIntentType(message: string): IntentType {
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          return intent as IntentType;
        }
      }
    }
    return 'READ';
  }

  private classifyIntent(message: string): IntentDecision {
    const intent = this.classifyIntentType(message);

    // Detect entity mentions
    let entity: string | undefined;
    for (const [ent, synonyms] of Object.entries(ENTITY_SYNONYMS)) {
      const regex = new RegExp(`\\b(${synonyms.join('|')})\\b`, 'i');
      if (regex.test(message)) {
        entity = ent;
        break;
      }
    }

    return {
      intent,
      entity,
      confidence: 0.9,
      ruleId: 'intent_classifier',
    };
  }

  private extractOperation(
    message: string,
    patterns: RegExp[],
  ): string | undefined {
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1] ?? match[0];
      }
    }
    return undefined;
  }

  private extractOperationFromIntent(
    message: string,
    intent: IntentType,
  ): string | undefined {
    const opPatterns: Record<IntentType, RegExp[]> = {
      READ: [/\b(list|show|get|find)\b/i],
      MUTATION: [/\b(create|update|delete|assign)\b/i],
      ADVICE: [/\b(should|recommend)\b/i],
      NAVIGATION: [/\b(go to|open)\b/i],
      HELP: [/\b(help|show)\b/i],
      UNSUPPORTED: [],
    };

    const patterns = opPatterns[intent] ?? [];
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1]?.toLowerCase() ?? match[0].toLowerCase();
      }
    }

    return intent === 'READ' ? 'list' : undefined;
  }

  private normalizeEntity(pattern: string): string {
    for (const [entity, synonyms] of Object.entries(ENTITY_SYNONYMS)) {
      const regex = new RegExp(`(${synonyms.join('|')})`, 'i');
      if (regex.test(pattern)) {
        return entity;
      }
    }
    return pattern.replace(/[^\w]/g, '');
  }

  private findAmbiguityCandidates(message: string): IntentDecision[] {
    const candidates: IntentDecision[] = [];
    const messageLower = message.toLowerCase();

    // Check if multiple entities are mentioned
    const mentionedEntities: string[] = [];
    for (const [entity, synonyms] of Object.entries(ENTITY_SYNONYMS)) {
      const regex = new RegExp(`\\b(${synonyms.join('|')})\\b`, 'i');
      if (regex.test(messageLower)) {
        mentionedEntities.push(entity);
      }
    }

    if (mentionedEntities.length > 1) {
      for (const entity of mentionedEntities) {
        candidates.push({
          intent: 'READ',
          entity,
          confidence: 0.6,
          ruleId: 'multi_entity_ambiguity',
        });
      }
    }

    return candidates;
  }

  private makeDecision(
    intent: IntentType,
    entity: string | undefined,
    operation: string | undefined,
    confidence: number,
    ruleId: string,
  ): IntentDecision {
    const decision: IntentDecision = {
      intent,
      confidence,
      ruleId,
    };
    if (entity) decision.entity = entity;
    if (operation) decision.operation = operation;

    this.routingLog.push({
      ruleVersion: this.ruleRegistry.getVersion(),
      ruleId,
      intent,
      capability: `${entity ?? ''}:${operation ?? ''}`.replace(/^:/, ''),
      confidence,
      timestamp: new Date().toISOString(),
      evidence: [],
    });

    return decision;
  }

  getRoutingLog(): RoutingDecision[] {
    return [...this.routingLog];
  }

  clearRoutingLog(): void {
    this.routingLog.length = 0;
  }
}
