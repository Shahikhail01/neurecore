// ─── chat.factory.ts ────────────────────────────────────────────────────────────
// SRP: Dependency injection wiring for the unified chat system.
// DIP: All services created here depend on abstractions (IChatService, etc.).
// Config-driven: Tenant vs Admin differences come from ChatConfig + SlashCommands.
//
// This factory exports fully-wired singletons consumed by useChat() and
// UnifiedChatPanel in TenantShell.

import { restClient } from '@/core/services/api/clients/RestClient';
import { ChatService } from '@/core/services/chat/ChatService';
import { createChatStore } from '@/core/services/chat/ChatStore';
import { BraceBalancedJsonExtractor } from '@/core/services/chat/fallback/BraceBalancedJsonExtractor';
import { KeywordFallbackReply } from '@/core/services/chat/fallback/KeywordFallbackReply';
import { TenantSystemPromptBuilder } from '@/core/services/chat/fallback/TenantSystemPromptBuilder';
import { TenantSlashCommands } from '@/core/services/chat/slash-commands/TenantSlashCommands';
import { BraceBalancedEnvelopeExtractor } from '@/core/services/chat/envelope/BraceBalancedEnvelopeExtractor';
import { MessageEnvelopeParser } from '@/core/services/chat/envelope/MessageEnvelopeParser';
import type { ChatConfig } from '@/shared/types/chat.types';

// ── Tenant Chat Config ──────────────────────────────────────────────────────
const tenantChatConfig: ChatConfig = {
  panelTitle: 'HeadQuarter AI',
  badgeLabel: 'AI',
  badgeColor: 'indigo',
  triggerIcon: '✦',
  placeholder: 'Ask anything\u2026 or type / for commands',
  maxMessages: 100,
  storageKey: 'hq_chat_store',
  apiEndpoint: '/chat/messages',
  starterPrompts: [
    'How is my team performing today?',
    'Which agents have the highest workload?',
    'What tasks are overdue?',
    'Show me top workflow bottlenecks.',
    "Summarise yesterday's activity.",
  ],
  homeHeroChips: [
    "How\u2019s our pipeline this week?",
    'Show pending approvals',
    "Summarize today\u2019s activity",
    'Run a performance forecast',
  ],
};

// ── Wired Singletons ────────────────────────────────────────────────────────
export const jsonExtractor = new BraceBalancedJsonExtractor();

// Phase 9: a NEW envelope-aware extractor + parser. The legacy chart-only
// `jsonExtractor` is preserved for backward compatibility (some legacy code
// paths still call it directly for chart-only payloads).
export const envelopeJsonExtractor = new BraceBalancedEnvelopeExtractor();
export const envelopeParser = new MessageEnvelopeParser(envelopeJsonExtractor);

export const chatService = new ChatService(
  restClient,
  tenantChatConfig,
  new KeywordFallbackReply(),
  jsonExtractor,
  new TenantSystemPromptBuilder(),
);

export const useChatStore = createChatStore(tenantChatConfig);
export const slashCommands = new TenantSlashCommands();
export { tenantChatConfig };
