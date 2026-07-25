// ─── KeywordFallbackReply.ts ────────────────────────────────────────────────────
// SRP: Provides rule-based offline fallback responses + client-side suggestion
// inference when the backend chat API is unreachable or returns empty.
// Extracted from ConversationalAIService._fallbackReply() + _inferSuggestions().

import type { IFallbackReply } from '@/core/services/interfaces/IChatService';

export class KeywordFallbackReply implements IFallbackReply {
  generate(message: string): { reply: string; suggestions?: string[] } {
    const lower = message.toLowerCase();

    if (lower.includes('revenue') || lower.includes('sales')) {
      return {
        reply: "I'm unable to access live data right now. Check the Analytics page for revenue insights.",
        suggestions: this.generateSuggestions('revenue'),
      };
    }
    if (lower.includes('agent')) {
      return {
        reply: 'Head to the Agents page to review employee status and performance metrics.',
        suggestions: this.generateSuggestions('agent'),
      };
    }
    if (lower.includes('task')) {
      return {
        reply: 'Open the Tasks page to review pending and in-progress tasks across all employees.',
        suggestions: this.generateSuggestions('task'),
      };
    }
    if (lower.includes('workflow')) {
      return {
        reply: 'The Workflows page shows all active process flows and their current status.',
        suggestions: this.generateSuggestions('workflow'),
      };
    }

    return {
      reply: "I'm currently offline. Please check your connection and try again.",
    };
  }

  generateSuggestions(replyText: string): string[] {
    const suggestions: string[] = [];
    const lower = replyText.toLowerCase();

    if (lower.includes('agent')) suggestions.push('Show me all agents');
    if (lower.includes('task')) suggestions.push('Show pending tasks');
    if (lower.includes('revenue')) suggestions.push('Open analytics');

    return suggestions.slice(0, 3);
  }
}
