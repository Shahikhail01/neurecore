/**
 * Phase 19 — G19 Marketing / Service / Predictive / Outlook-Teams certification runner.
 *
 * Verdict criteria — every gate must pass; failures block release.
 *
 *   G19-M-001 — Phase 18 G18 still APPROVED
 *   G19-M-002 — SegmentSkill rejects missing topic; parse produces typed segments
 *   G19-M-003 — CampaignBriefSkill rejects unknown brand voice; parse produces typed brief
 *   G19-M-004 — BounceAnalyzerService classifies HARD/SOFT/COMPLAINT/BLOCK/OTHER
 *   G19-S-001 — CaseResolveSkill rejects missing inputs; parse produces typed recs
 *   G19-S-002 — CaseResponseSkill rejects unknown tone; parse produces typed escalation
 *   G19-P-001 — ModelLifecycleService compareChallenger refuses wildcard tenantId
 *   G19-P-002 — ModelLifecycleService runRollbackDrill returns typed sandboxed report
 *   G19-P-003 — PredictionService abstains when no model / insufficient evidence / stale snapshot
 *   G19-P-004 — ModelCardService.forModel returns typed card
 *   G19-P-005 — PredictionService abstention reasons live on `explanation[0]` (typed contract)
 *   G19-P-006 — PredictionService healthy-path emits a typed scored prediction
 */

import { Injectable, Logger } from '@nestjs/common';
import { Phase18CertificationRunner } from './phase18-certification.runner';
import { SegmentSkill } from '../../modules/marketing/skills/segment.skill';
import { CampaignBriefSkill } from '../../modules/marketing/skills/campaign-brief.skill';
import { BounceAnalyzerService } from '../../modules/marketing/services/bounce-analyzer.service';
import { CaseResolveSkill } from '../../modules/service/skills/case-resolve.skill';
import { CaseResponseSkill } from '../../modules/service/skills/case-response.skill';
import { ModelLifecycleService } from '../../modules/analytics/services/model-lifecycle.service';
import {
  PredictionService,
  PREDICTION_QUALITY,
} from '../../modules/analytics/services/prediction.service';
import { ModelCardService } from '../../modules/analytics/services/model-card.service';

interface GateResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

@Injectable()
export class Phase19CertificationRunner {
  private readonly logger = new Logger(Phase19CertificationRunner.name);

  async run(): Promise<{
    readonly verdict: 'APPROVED' | 'BLOCKED';
    readonly gates: ReadonlyArray<GateResult>;
  }> {
    const gates: GateResult[] = [];
    let allPassed = true;
    const record = (
      id: string,
      name: string,
      passed: boolean,
      detail?: string,
    ) => {
      const r: GateResult = { id, name, passed, detail };
      gates.push(r);
      if (!passed) allPassed = false;
    };

    try {
      const p18 = await new Phase18CertificationRunner().run();
      record(
        'G19-M-001',
        'Phase 18 G18 still APPROVED',
        p18.verdict === 'APPROVED',
      );
    } catch (err) {
      record(
        'G19-M-001',
        'Phase 18 G18 still APPROVED',
        false,
        (err as Error).message,
      );
    }

    const ctx = () => ({
      tenantId: 'tenant-A',
      isCrossTenant: false,
      actorRole: 'OWNER' as const,
      actorUserId: 'u-1',
    });

    // G19-M-002
    {
      const skill = new SegmentSkill({} as never);
      const ok =
        !skill.validateInput({}) && !skill.validateInput({ tenantId: 't' });
      const accepts = skill.validateInput({ tenantId: 't', topic: 'x' });
      const parsed = skill.buildPrompt(
        { tenantId: 't', topic: 'topic' },
        ctx(),
      );
      const sample = JSON.stringify({
        content: {
          segments: [
            {
              id: 's-1',
              topic: 'topic',
              memberCount: 1,
              members: [
                { recordType: 'lead', recordId: 'l-1', matchScore: 0.9 },
              ],
              confidence: 0.9,
              permissions: [],
              explanation: '',
            },
          ],
        },
        limits: [],
      });
      const out = (
        parsed.prompt as unknown as {
          parse: (s: string) => {
            content: { segments: Array<{ memberCount: number }> };
          };
        }
      ).parse(sample);
      const ok2 =
        Array.isArray(out.content.segments) &&
        out.content.segments[0].memberCount === 1;
      record(
        'G19-M-002',
        'SegmentSkill rejects missing topic; parse produces typed segments',
        ok && accepts && ok2,
      );
    }

    // G19-M-003
    {
      const skill = new CampaignBriefSkill();
      const rejects = !skill.validateInput({
        tenantId: 't',
        topic: 'x',
        brandVoice: 'mystery',
      });
      const accepts = skill.validateInput({
        tenantId: 't',
        topic: 'x',
        brandVoice: 'formal',
      });
      const parsed = skill.buildPrompt(
        { tenantId: 't', topic: 'topic' },
        ctx(),
      );
      const sample = JSON.stringify({
        content: {
          title: 'Q3',
          themes: ['t'],
          subjectLines: ['s'],
          body: 'b',
          forbiddenPhrases: [],
          brandVoice: 'formal',
        },
        limits: [],
      });
      const out = (
        parsed.prompt as unknown as {
          parse: (s: string) => { content: { title: string } };
        }
      ).parse(sample);
      record(
        'G19-M-003',
        'CampaignBriefSkill rejects unknown brand voice; parse produces typed brief',
        rejects && accepts && out.content.title === 'Q3',
      );
    }

    // G19-M-004 — BounceAnalyzer
    {
      const svc = new BounceAnalyzerService({} as never);
      const cases = [
        {
          input: { tenantId: 't', recipientEmail: 'a@b.com', smtpStatus: 550 },
          expected: 'HARD_BOUNCE',
        },
        {
          input: {
            tenantId: 't',
            recipientEmail: 'a@b.com',
            smtpStatus: 452,
            smtpDiagnostic: 'mailbox full',
          },
          expected: 'SOFT_BOUNCE',
        },
        {
          input: {
            tenantId: 't',
            recipientEmail: 'a@b.com',
            reason: 'spam complaint',
          },
          expected: 'COMPLAINT',
        },
        {
          input: {
            tenantId: 't',
            recipientEmail: 'a@b.com',
            smtpStatus: 421,
            smtpDiagnostic: 'TLS',
          },
          expected: 'BLOCK',
        },
        {
          input: { tenantId: 't', recipientEmail: 'a@b.com' },
          expected: 'OTHER',
        },
      ];
      const results: string[] = [];
      for (const c of cases) {
        const out = await svc.classify(c.input as never);
        results.push(out.category);
      }
      const expected = cases.map((c) => c.expected);
      const ok = JSON.stringify(results) === JSON.stringify(expected);
      record(
        'G19-M-004',
        'BounceAnalyzerService classifies HARD/SOFT/COMPLAINT/BLOCK/OTHER',
        ok,
        `got=${JSON.stringify(results)} expected=${JSON.stringify(expected)}`,
      );
    }

    // G19-S-001
    {
      const skill = new CaseResolveSkill({} as never);
      const ok =
        !skill.validateInput({}) && !skill.validateInput({ tenantId: 't' });
      const accepts = skill.validateInput({
        tenantId: 't',
        caseId: 'c-1',
        subjectText: 'x',
      });
      const parsed = skill.buildPrompt(
        { tenantId: 't', caseId: 'c-1', subjectText: 'broken' },
        ctx(),
      );
      const sample = JSON.stringify({
        content: {
          recommendations: [
            {
              knowledgeEntryId: 'k-1',
              title: 'How',
              excerpt: '...',
              matchScore: 0.9,
            },
          ],
        },
        limits: [],
      });
      const out = (
        parsed.prompt as unknown as {
          parse: (s: string) => {
            content: { recommendations: Array<{ knowledgeEntryId: string }> };
          };
        }
      ).parse(sample);
      record(
        'G19-S-001',
        'CaseResolveSkill rejects missing inputs; parse produces typed recs',
        ok &&
          accepts &&
          out.content.recommendations[0].knowledgeEntryId === 'k-1',
      );
    }

    // G19-S-002
    {
      const skill = new CaseResponseSkill();
      const rejects = !skill.validateInput({
        tenantId: 't',
        caseId: 'c-1',
        subjectText: 'x',
        tone: 'shouty',
      });
      const accepts = skill.validateInput({
        tenantId: 't',
        caseId: 'c-1',
        subjectText: 'x',
        tone: 'formal',
      });
      const parsed = skill.buildPrompt(
        { tenantId: 't', caseId: 'c-1', subjectText: 'broken' },
        ctx(),
      );
      const sample = JSON.stringify({
        content: {
          draftBody: 'd',
          recommendedEscalation: 'TIER_2',
          escalationReason: 'r',
        },
        limits: [],
      });
      const out = (
        parsed.prompt as unknown as {
          parse: (s: string) => { content: { recommendedEscalation: string } };
        }
      ).parse(sample);
      record(
        'G19-S-002',
        'CaseResponseSkill rejects unknown tone; parse produces typed escalation',
        rejects && accepts && out.content.recommendedEscalation === 'TIER_2',
      );
    }

    // G19-P-001 + 002 — ModelLifecycleService
    {
      const makePrisma = (mode: 'active' | 'challenger' | 'drill') => ({
        prisma: {
          analyticsModel: {
            findFirst: async (args: { where: { id: string } }) => {
              if (mode === 'drill' && args.where.id === 'm-drill') {
                return {
                  id: 'm-drill',
                  name: 'Model',
                  version: '1.0.0',
                  metadata: {
                    lifecycle: {
                      stages: [
                        { stage: 'gated-production', status: 'COMPLETE' },
                      ],
                    },
                  },
                };
              }
              if (args.where.id === 'm-1') {
                return {
                  id: 'm-1',
                  name: 'Active',
                  version: '1.0.0',
                  metadata: {
                    lifecycle: { shadow: { challengerScore: 0.82 } },
                  },
                };
              }
              if (args.where.id === 'm-2') {
                return {
                  id: 'm-2',
                  name: 'Challenger',
                  version: '1.1.0',
                  metadata: {
                    lifecycle: { shadow: { challengerScore: 0.86 } },
                  },
                };
              }
              return null;
            },
          },
        } as never,
      });
      const svc1 = new ModelLifecycleService(makePrisma('active').prisma);
      let rejected = false;
      try {
        await svc1.compareChallenger({
          tenantId: '*',
          activeModelId: 'm-1',
          challengerModelId: 'm-2',
        });
      } catch {
        rejected = true;
      }
      record(
        'G19-P-001',
        'ModelLifecycleService compareChallenger refuses wildcard tenantId',
        rejected,
      );

      const svc2 = new ModelLifecycleService(makePrisma('drill').prisma);
      const drillOut = await svc2.runRollbackDrill({
        tenantId: 't',
        modelId: 'm-drill',
        actor: 'u-1',
      });
      record(
        'G19-P-002',
        'ModelLifecycleService runRollbackDrill returns typed sandboxed report',
        drillOut.sandbox === true,
      );
    }

    // G19-P-003 — PredictionService abstains
    {
      interface Stub {
        prisma: unknown;
        snapshots: unknown;
        calibrated: unknown;
      }
      const makePrismaForPrediction = (opts: {
        found?: boolean;
        snapshotCount?: number;
        ageHours?: number;
        scoreConfidence?: number;
        snapshotModelId?: string;
        lifecycleReady?: boolean;
      }): Stub => {
        const recent = Array.from(
          {
            length:
              opts.snapshotCount ?? PREDICTION_QUALITY.MIN_EVIDENCE_COUNT + 1,
          },
          (_, i) => ({
            id: `s-${i}`,
            tenantId: 'tenant-A',
            subjectType: 'lead',
            subjectId: 'l-1',
            modelId: opts.snapshotModelId ?? 'm-1',
            modelVersion: '1.0.0',
            features: { requested_demo: 1 },
            featuresJson: { requested_demo: 1 },
            recordedAt: new Date(
              Date.now() - (opts.ageHours ?? 1) * 3600 * 1000,
            ),
            createdAt: new Date(
              Date.now() - (opts.ageHours ?? 1) * 3600 * 1000,
            ),
          }),
        );
        const readyStages = [
          { stage: 'gated-production', status: 'COMPLETE' },
          { stage: 'monitoring', status: 'IN_PROGRESS' },
        ];
        const notReadyStages = [
          { stage: 'gated-production', status: 'IN_PROGRESS' },
        ];
        return {
          prisma: {
            featureSnapshot: {
              count: async () =>
                opts.snapshotCount ?? PREDICTION_QUALITY.MIN_EVIDENCE_COUNT + 1,
              findFirst: async () => ({
                createdAt: new Date(
                  Date.now() - (opts.ageHours ?? 1) * 3600 * 1000,
                ),
              }),
            },
            analyticsModel: {
              findFirst: async () =>
                opts.found === false
                  ? null
                  : {
                      id: 'm-1',
                      kind: 'lead',
                      version: '1.0.0',
                      weights: { requested_demo: 0.4 },
                      metadata: {
                        lifecycle: {
                          stages:
                            opts.lifecycleReady === false
                              ? notReadyStages
                              : readyStages,
                        },
                      },
                      tenantId: 'tenant-A',
                    },
            },
            analyticsModelVersion: { create: async () => undefined },
          },
          snapshots: {
            listRecent: async () => recent,
            getLatest: async () => recent[0] ?? null,
          },
          calibrated: {
            score: async () => ({
              score: 0.5,
              value: 0.5,
              confidence: opts.scoreConfidence ?? 0.6,
              factors: [],
              limitations: [],
              basis: ['heuristic'],
              source: 'heuristic',
            }),
          },
        };
      };
      const abstentionCases: Array<{
        name: string;
        deps: ReturnType<typeof makePrismaForPrediction>;
        expectedConfidence: number;
        expectedReasonIncludes: string;
      }> = [
        {
          name: 'no model (fallback lookup returns null)',
          deps: makePrismaForPrediction({ found: false, snapshotModelId: '' }),
          expectedConfidence: 0,
          expectedReasonIncludes: 'no analytics model',
        },
        {
          name: 'no snapshot',
          deps: makePrismaForPrediction({ snapshotCount: 0 }),
          expectedConfidence: 0,
          expectedReasonIncludes: 'no feature snapshot',
        },
        {
          name: 'stale snapshot',
          deps: makePrismaForPrediction({ ageHours: 100 }),
          expectedConfidence: 0,
          expectedReasonIncludes: 'stale',
        },
        {
          name: 'lifecycle not production-ready',
          deps: makePrismaForPrediction({ lifecycleReady: false }),
          expectedConfidence: 0,
          expectedReasonIncludes: 'lifecycle',
        },
      ];
      const failures: string[] = [];
      for (const c of abstentionCases) {
        const svc = new PredictionService(
          c.deps.prisma as never,
          c.deps.snapshots as never,
          c.deps.calibrated as never,
        );
        const out = await svc.predict({
          tenantId: 't',
          modelId: 'm-1',
          modelVersion: '1.0.0',
          subject: { type: 'lead', id: 'l-1' },
          features: { requested_demo: 1 },
          predictionType: 'lead_score',
        } as never);
        if (out.confidence !== c.expectedConfidence) {
          failures.push(
            `${c.name}: expected confidence ${c.expectedConfidence} got ${out.confidence}`,
          );
        }
        if (out.model.id !== 'abstain') {
          failures.push(
            `${c.name}: expected model.id=abstain got ${out.model.id}`,
          );
        }
        const reason = out.explanation[0] ?? '';
        if (!reason.includes(c.expectedReasonIncludes)) {
          failures.push(
            `${c.name}: expected explanation[0] to include "${c.expectedReasonIncludes}" got "${reason}"`,
          );
        }
      }
      record(
        'G19-P-003',
        'PredictionService abstains when no model / insufficient evidence / stale snapshot',
        failures.length === 0,
        failures.length === 0 ? undefined : failures.join('; '),
      );
    }

    // G19-P-005 — abstention reason lives on explanation[0] (typed contract).
    // This guards against a regression where someone moves the reason
    // to `limitations` (the original standalone-spec scaffold mistake).
    {
      interface PredictionReasonStub {
        prisma: unknown;
        snapshots: unknown;
        calibrated: unknown;
      }
      const reasonStub = (): PredictionReasonStub => {
        const recent = Array.from(
          { length: PREDICTION_QUALITY.MIN_EVIDENCE_COUNT + 1 },
          (_, i) => ({
            id: `r-${i}`,
            tenantId: 'tenant-A',
            subjectType: 'lead',
            subjectId: 'l-1',
            modelId: 'm-1',
            modelVersion: '1.0.0',
            features: { requested_demo: 1 },
            featuresJson: { requested_demo: 1 },
            recordedAt: new Date(Date.now() - 1 * 3600 * 1000),
            createdAt: new Date(Date.now() - 1 * 3600 * 1000),
          }),
        );
        return {
          prisma: {
            featureSnapshot: {
              count: async () => PREDICTION_QUALITY.MIN_EVIDENCE_COUNT + 1,
              findFirst: async () => ({ createdAt: new Date() }),
            },
            analyticsModel: {
              findFirst: async () => null,
            },
            analyticsModelVersion: { create: async () => undefined },
          },
          snapshots: {
            listRecent: async () => recent,
            getLatest: async () => recent[0] ?? null,
          },
          calibrated: {
            score: async () => ({
              score: 0.5,
              value: 0.5,
              confidence: 0.6,
              factors: [],
              limitations: [],
              basis: [],
              source: 'heuristic',
            }),
          },
        };
      };
      const reasonDeps = reasonStub();
      const reasonSvc = new PredictionService(
        reasonDeps.prisma as never,
        reasonDeps.snapshots as never,
        reasonDeps.calibrated as never,
      );
      const reasonOut = await reasonSvc.predict({
        tenantId: 't',
        modelId: 'm-1',
        modelVersion: '1.0.0',
        subject: { type: 'lead', id: 'l-1' },
        features: { requested_demo: 1 },
        predictionType: 'lead_score',
      } as never);
      const reasonOnExplanation = (reasonOut.explanation[0] ?? '').includes(
        'abstain',
      );
      const noReasonOnLimitations = !reasonOut.limitations.some((l) =>
        /abstain.*no analytics model|no analytics model.*abstain/i.test(l),
      );
      record(
        'G19-P-005',
        'PredictionService abstention reason lives on explanation[0] (typed contract)',
        reasonOnExplanation && noReasonOnLimitations,
        `explanation=${JSON.stringify(reasonOut.explanation)} limitations=${JSON.stringify(reasonOut.limitations)}`,
      );
    }

    // G19-P-006 — healthy path emits a typed scored prediction.
    {
      interface HealthyStub {
        prisma: unknown;
        snapshots: unknown;
        calibrated: unknown;
      }
      const healthyStub = (): HealthyStub => {
        const recent = Array.from(
          { length: PREDICTION_QUALITY.MIN_EVIDENCE_COUNT + 1 },
          (_, i) => ({
            id: `h-${i}`,
            tenantId: 'tenant-A',
            subjectType: 'lead',
            subjectId: 'l-1',
            modelId: 'm-1',
            modelVersion: '1.0.0',
            features: { requested_demo: 1 },
            featuresJson: { requested_demo: 1 },
            recordedAt: new Date(Date.now() - 1 * 3600 * 1000),
            createdAt: new Date(Date.now() - 1 * 3600 * 1000),
          }),
        );
        return {
          prisma: {
            featureSnapshot: {
              count: async () => PREDICTION_QUALITY.MIN_EVIDENCE_COUNT + 1,
              findFirst: async () => ({ createdAt: new Date() }),
            },
            analyticsModel: {
              findFirst: async () => ({
                id: 'm-1',
                kind: 'lead',
                version: '1.0.0',
                weights: { requested_demo: 0.4 },
                metadata: {
                  lifecycle: {
                    stages: [
                      { stage: 'gated-production', status: 'COMPLETE' },
                      { stage: 'monitoring', status: 'IN_PROGRESS' },
                    ],
                  },
                },
                tenantId: 'tenant-A',
              }),
            },
            analyticsModelVersion: { create: async () => undefined },
          },
          snapshots: {
            listRecent: async () => recent,
            getLatest: async () => recent[0] ?? null,
          },
          calibrated: {
            score: async () => ({
              score: 0.5,
              value: 0.5,
              confidence: PREDICTION_QUALITY.MIN_CONFIDENCE + 0.1,
              factors: [],
              limitations: [],
              basis: ['heuristic'],
              source: 'heuristic',
            }),
          },
        };
      };
      const healthyDeps = healthyStub();
      const healthySvc = new PredictionService(
        healthyDeps.prisma as never,
        healthyDeps.snapshots as never,
        healthyDeps.calibrated as never,
      );
      const healthyOut = await healthySvc.predict({
        tenantId: 't',
        modelId: 'm-1',
        modelVersion: '1.0.0',
        subject: { type: 'lead', id: 'l-1' },
        features: { requested_demo: 1 },
        predictionType: 'lead_score',
      } as never);
      const ok =
        healthyOut.model.id === 'm-1' &&
        healthyOut.model.version === '1.0.0' &&
        typeof healthyOut.value === 'number' &&
        healthyOut.value === 0.5 &&
        healthyOut.confidence >= PREDICTION_QUALITY.MIN_CONFIDENCE &&
        healthyOut.featureSnapshotId.length > 0 &&
        healthyOut.generatedAt.length > 0 &&
        healthyOut.expiresAt.length > 0 &&
        healthyOut.explanation.length > 0 &&
        healthyOut.limitations.length > 0;
      record(
        'G19-P-006',
        'PredictionService healthy-path emits typed scored prediction',
        ok,
        `model=${JSON.stringify(healthyOut.model)} value=${healthyOut.value} confidence=${healthyOut.confidence}`,
      );
    }

    // G19-P-004 — ModelCardService
    {
      const makePrismaForCard = (found: boolean) => ({
        prisma: {
          analyticsModel: {
            findFirst: async () =>
              found === false
                ? null
                : {
                    id: 'm-1',
                    name: 'Lead',
                    version: '1.0.0',
                    description: 'Lead scoring',
                    metadata: {
                      scope: ['enterprise'],
                      limitations: ['no cross-tenant transfer'],
                      monitoring: { url: 'https://example.com' },
                    },
                    tenantId: 'tenant-A',
                    updatedAt: new Date(),
                  },
          },
        } as never,
      });
      const notFound = new ModelCardService(makePrismaForCard(false).prisma);
      let threw = false;
      try {
        await notFound.forModel('no-such', 't');
      } catch {
        threw = true;
      }
      if (threw) {
        const found = new ModelCardService(makePrismaForCard(true).prisma);
        const card = await found.forModel('m-1', 't');
        const ok =
          card.modelId === 'm-1' &&
          card.scope.length > 0 &&
          card.limitations.length > 0 &&
          typeof card.monitoring === 'object';
        record('G19-P-004', 'ModelCardService.forModel returns typed card', ok);
      } else {
        record(
          'G19-P-004',
          'ModelCardService.forModel returns typed card',
          false,
          'expected not-found throw',
        );
      }
    }

    this.logger.log(
      `Phase 19 certification: ${gates.filter((g) => g.passed).length}/${gates.length} passed`,
    );
    return {
      verdict: allPassed ? 'APPROVED' : 'BLOCKED',
      gates,
    };
  }
}
