/**
 * Skill registry — barrel export.
 *
 * Re-exports every concrete skill so the module can `new` them all
 * in one place. Keeps the module wiring thin.
 */

export { SummarizeSkill } from './summarize.skill';
export type { SummarizeInput, SummarizeOutput } from './summarize.skill';
export { RewriteSkill } from './rewrite.skill';
export type { RewriteInput, RewriteOutput } from './rewrite.skill';
export { TranslateSkill } from './translate.skill';
export type { TranslateInput, TranslateOutput } from './translate.skill';
export { ExtractSkill } from './extract.skill';
export type { ExtractInput, ExtractOutput } from './extract.skill';
export { CompareSkill } from './compare.skill';
export type { CompareInput, CompareOutput } from './compare.skill';
export { DraftReportSkill } from './draft-report.skill';
export type { DraftReportInput, DraftReportOutput } from './draft-report.skill';
export { DraftEmailSkill } from './draft-email.skill';
export type {
  DraftEmailInput,
  DraftEmailOutput,
  DraftEmailRecipient,
} from './draft-email.skill';
export { ArticleDraftSkill } from './article-draft.skill';
export type { ArticleDraftInput, ArticleDraftOutput } from './article-draft.skill';
export { KnowledgeHealthSkill } from './knowledge-health.skill';
export type {
  KnowledgeHealthInput,
  KnowledgeHealthOutput,
  KnowledgeHealthFinding,
  KnowledgeHealthAction,
} from './knowledge-health.skill';
export { NlDraftSkill } from './nl-draft.skill';
export type { NlDraftInput, NlDraftOutput, NlDraftGraph } from './nl-draft.skill';
// Phase 19 — Marketing + Service skills live in their own modules
// to keep SRP / module boundaries intact. Re-export them here for
// the registry.
export { SegmentSkill } from '../../marketing/skills/segment.skill';
export type { SegmentInput, SegmentOutput, Segment } from '../../marketing/skills/segment.skill';
export { CampaignBriefSkill } from '../../marketing/skills/campaign-brief.skill';
export type { CampaignBriefInput, CampaignBriefOutput } from '../../marketing/skills/campaign-brief.skill';
export { CaseResolveSkill } from '../../service/skills/case-resolve.skill';
export type { CaseResolveInput, CaseResolveOutput, ResolutionCandidate } from '../../service/skills/case-resolve.skill';
export { CaseResponseSkill } from '../../service/skills/case-response.skill';
export type { CaseResponseInput, CaseResponseOutput } from '../../service/skills/case-response.skill';
// Phase 20 — CRM event skills.
export { CrmEventSkill } from './crm-event.skill';
export type { CrmEventSkillInput, CrmEventSkillOutput } from './crm-event.skill';
export { CrmWebhookSkill } from './crm-webhook.skill';
export type { CrmWebhookSkillInput, CrmWebhookSkillOutput } from './crm-webhook.skill';
