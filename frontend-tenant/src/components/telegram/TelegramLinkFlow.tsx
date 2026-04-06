/**
 * Telegram Link Flow Component - Phase 5
 *
 * Multi-step component for linking Telegram account.
 * Separated from TelegramSettingsPage for reusability.
 *
 * Flow:
 * 1. Intro: Explain Telegram notifications
 * 2. Link: Input Telegram Chat ID (user sends /start command to bot)
 * 3. Verify: Input PIN from Telegram message
 * 4. Linked: Success state with notification settings
 *
 * Mounted by:
 * - TelegramSettingsPage (main settings view)
 * - Onboarding flow (initial setup)
 * - Dialog/modal (standalone linking)
 */

"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CheckCircle,
  MessageCircle,
  Send,
  X,
  AlertCircle,
} from "lucide-react";
import { useTelegramStore } from "@/stores/telegramStore";

interface TelegramLinkFlowProps {
  /**
   * Initial step (default: 'intro')
   */
  initialStep?: "intro" | "link" | "verify" | "linked";

  /**
   * Callback when linking completes successfully
   */
  onComplete?: () => void;

  /**
   * Callback to close/cancel flow
   */
  onCancel?: () => void;

  /**
   * Optional className for wrapper
   */
  className?: string;

  /**
   * Show compact version (for modals)
   */
  compact?: boolean;
}

type LinkFlowStep = "intro" | "link" | "verify" | "linked";

/**
 * Telegram Link Flow Component
 *
 * Reusable wizard for linking Telegram accounts.
 * Can be embedded in settings, modals, or onboarding flows.
 *
 * @example
 * ```tsx
 * <TelegramLinkFlow
 *   onComplete={() => navigate('/settings')}
 *   onCancel={() => setShowModal(false)}
 * />
 * ```
 */
export function TelegramLinkFlow({
  initialStep = "intro",
  onComplete,
  onCancel,
  className,
  compact = false,
}: TelegramLinkFlowProps) {
  const { isLoading, error, linkAccount, verifyLink, clearError } =
    useTelegramStore();

  const [step, setStep] = useState<LinkFlowStep>(initialStep);
  const [chatId, setChatId] = useState("");
  const [pin, setPin] = useState("");

  const handleNext = () => {
    if (step === "intro") {
      setStep("link");
      clearError();
    }
  };

  const handleContinueToVerify = async () => {
    if (!chatId.trim()) {
      return;
    }

    try {
      await linkAccount(chatId);
      setStep("verify");
    } catch (err) {
      console.error("Link account error:", err);
    }
  };

  const handleVerifyPin = async () => {
    if (!pin.trim()) {
      return;
    }

    try {
      await verifyLink(pin);
      setStep("linked");
      onComplete?.();
    } catch (err) {
      console.error("Verify link error:", err);
    }
  };

  const handleReset = () => {
    setStep("intro");
    setChatId("");
    setPin("");
    clearError();
  };

  const handleCancel = () => {
    handleReset();
    onCancel?.();
  };

  const wrapperClass = compact ? "w-full" : "max-w-2xl mx-auto";

  return (
    <div className={cn(wrapperClass, className)}>
      {/* Step 1: Introduction */}
      {step === "intro" && (
        <div
          className="bg-surface-raised rounded-lg border border-surface-border p-8 space-y-6"
          role="region"
          aria-label="Telegram linking introduction"
        >
          <div className="flex items-start gap-4">
            <MessageCircle className="w-12 h-12 text-accent-primary flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-bold text-text-primary mb-2">
                Connect Telegram
              </h2>
              <p className="text-text-secondary">
                Get agent notifications on Telegram when you're away from
                NeureCore.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-text-primary">Benefits:</h3>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-start gap-2">
                <span className="text-status-success mt-1">✓</span>
                <span>Receive task completions and approvals on Telegram</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-status-success mt-1">✓</span>
                <span>Stay updated without checking the web app</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-status-success mt-1">✓</span>
                <span>Control notifications per agent</span>
              </li>
            </ul>
          </div>

          <div className="bg-surface-overlay rounded-lg p-4 border border-surface-border">
            <p className="text-xs text-text-muted">
              <strong>Privacy:</strong> Your Telegram account is securely
              linked. We never store your Telegram password. You can disconnect
              anytime from settings.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            {onCancel && (
              <button
                onClick={handleCancel}
                className={cn(
                  "flex-1 px-4 py-3 rounded-lg text-sm font-semibold",
                  "border border-surface-border text-text-primary",
                  "hover:bg-surface-overlay transition-colors",
                )}
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleNext}
              className={cn(
                "flex-1 px-4 py-3 rounded-lg text-sm font-semibold",
                "text-white bg-accent-primary hover:bg-accent-600",
                "flex items-center justify-center gap-2",
                "transition-colors",
              )}
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Link Account (Input Chat ID) */}
      {step === "link" && (
        <div
          className="bg-surface-raised rounded-lg border border-surface-border p-8 space-y-6"
          role="region"
          aria-label="Input Telegram chat ID"
        >
          <div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              Link Your Telegram
            </h2>
            <p className="text-text-secondary">
              First, open Telegram and message our bot to get your Chat ID.
            </p>
          </div>

          {/* Instructions */}
          <div className="bg-surface-overlay rounded-lg p-4 border border-surface-border space-y-3">
            <p className="text-sm font-semibold text-text-primary">
              Instructions:
            </p>
            <ol className="text-sm text-text-secondary space-y-2">
              <li className="flex gap-3">
                <span className="font-semibold text-accent-primary flex-shrink-0">
                  1.
                </span>
                <span>Open Telegram and search for @NeureCore_Bot</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-accent-primary flex-shrink-0">
                  2.
                </span>
                <span>Send the message: /start</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-accent-primary flex-shrink-0">
                  3.
                </span>
                <span>Copy your Chat ID from the bot's reply</span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-accent-primary flex-shrink-0">
                  4.
                </span>
                <span>Paste it in the field below</span>
              </li>
            </ol>
          </div>

          {/* Chat ID Input */}
          <div>
            <label
              htmlFor="telegram-chat-id"
              className="block text-sm font-semibold text-text-primary mb-2"
            >
              Telegram Chat ID
            </label>
            <input
              id="telegram-chat-id"
              type="text"
              value={chatId}
              onChange={(e) => {
                setChatId(e.target.value);
                clearError();
              }}
              placeholder="e.g., 1234567890"
              disabled={isLoading}
              className={cn(
                "w-full px-4 py-3 rounded-lg border-2 transition-colors",
                "bg-surface-base text-text-primary placeholder-text-muted",
                "border-surface-border hover:border-accent-primary/50",
                "focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
              aria-label="Telegram chat ID input"
            />
            <p className="text-xs text-text-muted mt-2">
              Your Chat ID is a number sent by @NeureCore_Bot
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="flex gap-3 p-3 rounded-lg bg-status-danger/10 border border-status-danger/30"
              role="alert"
              aria-live="polite"
            >
              <AlertCircle className="w-5 h-5 text-status-danger flex-shrink-0 mt-0.5" />
              <p className="text-sm text-status-danger">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className={cn(
                "flex-1 px-4 py-3 rounded-lg text-sm font-semibold",
                "border border-surface-border text-text-primary",
                "hover:bg-surface-overlay transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleContinueToVerify}
              disabled={!chatId.trim() || isLoading}
              className={cn(
                "flex-1 px-4 py-3 rounded-lg text-sm font-semibold",
                "text-white bg-accent-primary hover:bg-accent-600",
                "flex items-center justify-center gap-2",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors",
              )}
            >
              {isLoading ? "Verifying..." : "Send PIN"}
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Verify PIN */}
      {step === "verify" && (
        <div
          className="bg-surface-raised rounded-lg border border-surface-border p-8 space-y-6"
          role="region"
          aria-label="Verify Telegram PIN"
        >
          <div>
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              Verify Your Account
            </h2>
            <p className="text-text-secondary">
              We sent a PIN to your Telegram. Enter it below to complete
              linking.
            </p>
          </div>

          {/* PIN Input */}
          <div>
            <label
              htmlFor="telegram-pin"
              className="block text-sm font-semibold text-text-primary mb-2"
            >
              Verification PIN
            </label>
            <input
              id="telegram-pin"
              type="text"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                clearError();
              }}
              placeholder="e.g., 123456"
              disabled={isLoading}
              maxLength={6}
              className={cn(
                "w-full px-4 py-3 rounded-lg border-2 transition-colors",
                "bg-surface-base text-text-primary placeholder-text-muted",
                "text-center text-xl font-semibold tracking-widest",
                "border-surface-border hover:border-accent-primary/50",
                "focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
              aria-label="PIN verification input"
            />
            <p className="text-xs text-text-muted mt-2">
              Check your Telegram for the 6-digit PIN
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="flex gap-3 p-3 rounded-lg bg-status-danger/10 border border-status-danger/30"
              role="alert"
              aria-live="polite"
            >
              <AlertCircle className="w-5 h-5 text-status-danger flex-shrink-0 mt-0.5" />
              <p className="text-sm text-status-danger">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setPin("");
                setStep("link");
              }}
              disabled={isLoading}
              className={cn(
                "flex-1 px-4 py-3 rounded-lg text-sm font-semibold",
                "border border-surface-border text-text-primary",
                "hover:bg-surface-overlay transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              Back
            </button>
            <button
              onClick={handleVerifyPin}
              disabled={!pin.trim() || isLoading}
              className={cn(
                "flex-1 px-4 py-3 rounded-lg text-sm font-semibold",
                "text-white bg-accent-primary hover:bg-accent-600",
                "flex items-center justify-center gap-2",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors",
              )}
            >
              {isLoading ? "Verifying..." : "Verify"}
              {!isLoading && <CheckCircle className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Success */}
      {step === "linked" && (
        <div
          className="bg-surface-raised rounded-lg border border-surface-border p-8 space-y-6"
          role="region"
          aria-label="Telegram successfully linked"
        >
          <div className="flex items-start gap-4">
            <CheckCircle className="w-12 h-12 text-status-success flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-bold text-status-success mb-2">
                Telegram Connected!
              </h2>
              <p className="text-text-secondary">
                Your account is now linked. You'll start receiving agent
                notifications on Telegram.
              </p>
            </div>
          </div>

          <div className="bg-surface-overlay rounded-lg p-4 border border-surface-border">
            <p className="text-sm text-text-primary">
              <strong>What's next?</strong> Go to settings to choose which
              agents and notification types you want to receive on Telegram.
            </p>
          </div>

          {/* Action */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onComplete}
              className={cn(
                "flex-1 px-4 py-3 rounded-lg text-sm font-semibold",
                "text-white bg-accent-primary hover:bg-accent-600",
                "transition-colors",
              )}
            >
              Continue to Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TelegramLinkFlow;
