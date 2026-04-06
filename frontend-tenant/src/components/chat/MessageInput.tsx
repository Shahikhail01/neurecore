/**
 * MessageInput Component
 *
 * Text input for composing and sending messages to chat channels.
 *
 * Features:
 * - Auto-expanding textarea (grows with content)
 * - Multiline support (Shift+Enter for newline, Enter to send)
 * - Character counter (optional, for long messages)
 * - Attachment icon (future: file uploads)
 * - Emoji picker icon (future: emoji picker)
 * - Send button with loading state
 * - Keyboard accessibility (Ctrl/Cmd+Enter to send)
 * - Placeholder text customizable per channel
 * - Disabled state when channel doesn't allow sending
 * - Design token colors for theming
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Send, Paperclip, Smile, Loader2, AlertCircle } from "lucide-react";
import type { ChatChannel } from "@/types/channels.types";

interface MessageInputProps {
  /**
   * Current input value
   */
  value: string;

  /**
   * Callback when input changes
   */
  onChange: (text: string) => void;

  /**
   * Callback when message is submitted
   */
  onSubmit: () => void;

  /**
   * Is loading/sending?
   */
  isLoading?: boolean;

  /**
   * Is message currently sending?
   */
  isSending?: boolean;

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Channel type (for context)
   */
  channelType?: ChatChannel["type"];

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Max characters (optional)
   */
  maxLength?: number;

  /**
   * Show character counter?
   */
  showCharCount?: boolean;

  /**
   * Is input disabled?
   */
  disabled?: boolean;
}

/**
 * MessageInput Component
 *
 * @example
 * <MessageInput
 *   value={inputText}
 *   onChange={setInputText}
 *   onSubmit={handleSendMessage}
 *   placeholder="Message channel..."
 *   isSending={isLoading}
 * />
 */
export function MessageInput({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  isSending = false,
  placeholder = "Message...",
  channelType = "direct",
  className,
  maxLength = 5000,
  showCharCount = false,
  disabled = false,
}: MessageInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        160,
      )}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (if not Shift+Enter)
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !isLoading &&
      !isSending &&
      value.trim()
    ) {
      e.preventDefault();
      onSubmit();
    }

    // Also support Ctrl/Cmd+Enter to send
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && value.trim()) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= maxLength) {
      onChange(text);
    }
  };

  const isSubmitDisabled = !value.trim() || isSending || isLoading || disabled;

  return (
    <div className={cn("flex flex-col gap-2 p-4", className)}>
      {/* Character Counter */}
      {showCharCount && (
        <div className="flex justify-between text-xs text-text-muted">
          <span>
            {value.length} / {maxLength}
          </span>
          {value.length > maxLength * 0.9 && (
            <span className="flex items-center gap-1 text-status-warning">
              <AlertCircle className="w-3 h-3" />
              Approaching limit
            </span>
          )}
        </div>
      )}

      {/* Input Container */}
      <div className="flex gap-2 items-end">
        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            maxLength={maxLength}
            className={cn(
              "w-full px-4 py-2.5 rounded-lg resize-none",
              "bg-surface-base text-text-primary placeholder:text-text-muted",
              "border border-surface-border focus:border-accent-primary",
              "transition-colors duration-base",
              "focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "min-h-[40px] max-h-[160px]",
              "overflow-y-auto",
            )}
            aria-label="Message input"
            role="textbox"
            aria-multiline="true"
          />

          {/* Icon Buttons Inside Textarea */}
          <div className="absolute right-2 bottom-2 flex gap-1">
            {/* Attachment Button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                console.log("Attachment clicked (future)");
              }}
              className={cn(
                "p-1.5 rounded-md transition-colors duration-base",
                "text-text-muted hover:text-accent-primary hover:bg-surface-overlay",
                "focus:outline-none focus:ring-2 focus:ring-accent-primary",
                disabled &&
                  "opacity-50 cursor-not-allowed hover:text-text-muted hover:bg-transparent",
              )}
              disabled={disabled}
              title="Attach file"
              aria-label="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Emoji Button */}
            <button
              onClick={(e) => {
                e.preventDefault();
                console.log("Emoji picker clicked (future)");
              }}
              className={cn(
                "p-1.5 rounded-md transition-colors duration-base",
                "text-text-muted hover:text-accent-primary hover:bg-surface-overlay",
                "focus:outline-none focus:ring-2 focus:ring-accent-primary",
                disabled &&
                  "opacity-50 cursor-not-allowed hover:text-text-muted hover:bg-transparent",
              )}
              disabled={disabled}
              title="Add emoji"
              aria-label="Add emoji"
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Send Button */}
        <button
          onClick={() => {
            if (!isSubmitDisabled) {
              onSubmit();
            }
          }}
          disabled={isSubmitDisabled}
          className={cn(
            "flex-shrink-0 p-2.5 rounded-lg font-medium",
            "transition-all duration-base",
            "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-primary",
            !isSubmitDisabled
              ? "bg-accent-primary text-white hover:bg-accent-600 active:scale-95"
              : "bg-surface-overlay text-text-muted cursor-not-allowed opacity-50",
          )}
          title="Send message (Enter or Ctrl+Enter)"
          aria-label="Send message"
          type="button"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Keyboard Hints */}
      <div className="text-xs text-text-muted">
        <span>Press Enter to send</span>
        <span className="mx-1">•</span>
        <span>Shift+Enter for new line</span>
      </div>
    </div>
  );
}

export type { MessageInputProps };
