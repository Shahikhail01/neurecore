"use client";
// ─── ChatInput.tsx ─────────────────────────────────────────────────────────────
// SRP: Single-line chat input with send button.
// OCP: Placeholder, disabled state, and submit handler are props — no logic change.
// Used by: RightAIPanel (footer), AIChatPanel (footer), DashboardHero.

import { FormEvent, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Aria label for the input field */
  label?: string;
  className?: string;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask anything…",
  disabled = false,
  label = "Chat message input",
  className,
}: ChatInputProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Allow Shift+Enter for line break in the future (no-op here since single-line)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = value.trim();
      if (text && !disabled) onSubmit(text);
    }
  };

  const canSubmit = value.trim().length > 0 && !disabled;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex gap-2", className)}
      role="search"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        disabled={disabled}
        className={cn(
          "flex-1 min-w-0 rounded-input border border-surface-border bg-surface-overlay",
          "px-3 py-2 text-body text-text-primary placeholder:text-text-muted",
          "focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "transition-colors duration-fast",
        )}
      />
      <button
        type="submit"
        disabled={!canSubmit}
        aria-label="Send message"
        className={cn(
          "flex-shrink-0 flex items-center justify-center",
          "rounded-input px-3 bg-brand text-brand-foreground",
          "hover:bg-brand-dim disabled:opacity-50 disabled:cursor-not-allowed",
          "transition-colors duration-fast",
        )}
      >
        <Send className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </form>
  );
}
