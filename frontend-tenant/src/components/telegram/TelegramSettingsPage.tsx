/**
 * Telegram Settings Page - Phase 5
 *
 * Multi-step Telegram account linking and notification management.
 * Shows 4-step flow: Intro → Chat ID Input → PIN Verification → Linked + Settings
 *
 * Features:
 * - PIN-based account verification
 * - Per-agent notification type toggles
 * - Unlink with confirmation
 * - Real-time status updates
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  MessageCircle,
  Send,
  X,
  AlertCircle,
  LogOut,
} from "lucide-react";
import { useTelegramStore } from "@/stores/telegramStore";
import { TelegramAgentNotificationToggle } from "./TelegramAgentNotificationToggle";

interface TelegramSettingsPageProps {
  /**
   * Optional callback when flow completes
   */
  onComplete?: () => void;

  /**
   * Optional callback when unlinking
   */
  onUnlink?: () => void;
}

/**
 * Telegram Settings Page Component
 *
 * Manages Telegram account linking and notification configuration.
 * Multi-step flow: intro → link → verify → linked.
 *
 * @example
 * <TelegramSettingsPage onComplete={handleComplete} />
 */
export function TelegramSettingsPage({
  onComplete,
  onUnlink,
}: TelegramSettingsPageProps) {
  const {
    integration,
    isLinked,
    linkFlow,
    isLoading,
    error,
    setLinkFlowStep,
    setLinkFlowChatId,
    setLinkFlowPin,
    linkAccount,
    verifyLink,
    unlinkAccount,
    clearError,
  } = useTelegramStore();

  const [chatId, setChatId] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [showUnlinkConfirm, setShowUnlinkConfirm] = React.useState(false);

  const handleStartLink = () => {
    setChatId("");
    setPin("");
    setLinkFlowStep("link");
    clearError();
  };

  const handleContinueToVerify = async () => {
    if (!chatId.trim()) return;
    setLinkFlowChatId(chatId);
    // Send PIN to Telegram (mock sends PIN "123456")
    await linkAccount(chatId);
    setLinkFlowStep("verify");
  };

  const handleVerifyPin = async () => {
    if (!pin.trim()) return;
    setLinkFlowPin(pin);
    await verifyLink(pin);
    if (!error) {
      setLinkFlowStep("linked");
      onComplete?.();
    }
  };

  const handleUnlink = async () => {
    await unlinkAccount();
    setShowUnlinkConfirm(false);
    onUnlink?.();
  };

  const handleReset = () => {
    setLinkFlowStep("initial");
    setChatId("");
    setPin("");
    clearError();
  };

  // Linked state - show settings and unlink option
  if (isLinked && integration) {
    return (
      <div className="max-w-2xl mx-auto">
        {/* Linked Status */}
        <div className="bg-status-success/10 border border-status-success/30 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-status-success flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-status-success mb-1">
                Telegram Connected
              </h3>
              <p className="text-sm text-text-muted">
                {integration.telegramUsername && (
                  <>
                    Account:{" "}
                    <span className="text-text-primary font-medium">
                      @{integration.telegramUsername}
                    </span>
                  </>
                )}
              </p>
              <p className="text-xs text-text-muted mt-1">
                Verified{" "}
                {integration.lastVerifiedAt
                  ? new Date(integration.lastVerifiedAt).toLocaleDateString()
                  : "recently"}
              </p>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-surface-base rounded-lg border border-surface-border p-6">
          <h3 className="text-base font-semibold text-text-primary mb-4">
            Notification Settings
          </h3>

          {/* Global Enable Toggle */}
          <div className="mb-6">
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-overlay border border-surface-border">
              <div>
                <p className="font-medium text-text-primary">
                  Receive Notifications
                </p>
                <p className="text-xs text-text-muted">
                  {integration.enabled
                    ? "Notifications enabled"
                    : "Notifications disabled"}
                </p>
              </div>
              <button
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full",
                  "transition-colors duration-base",
                  integration.enabled
                    ? "bg-status-success"
                    : "bg-surface-border",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 rounded-full bg-white",
                    "transition-transform duration-base",
                    integration.enabled ? "translate-x-6" : "translate-x-1",
                  )}
                />
              </button>
            </div>
          </div>

          {/* Per-Agent Toggles */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-text-primary mb-3">
              Per-Agent Notifications
            </p>
            <div className="space-y-2">
              <TelegramAgentNotificationToggle
                agentId="agent-1"
                agentName="Marketing Agent"
              />
              <TelegramAgentNotificationToggle
                agentId="agent-2"
                agentName="Sales Agent"
              />
              <TelegramAgentNotificationToggle
                agentId="agent-3"
                agentName="Support Agent"
              />
            </div>
          </div>
        </div>

        {/* Unlink Section */}
        <div className="mt-6">
          <button
            onClick={() => setShowUnlinkConfirm(true)}
            className={cn(
              "w-full px-4 py-3 rounded-lg text-sm font-semibold",
              "flex items-center justify-center gap-2",
              "border border-status-danger/50 text-status-danger",
              "hover:bg-status-danger/10 transition-colors",
            )}
          >
            <LogOut className="w-4 h-4" />
            Disconnect Telegram
          </button>
        </div>

        {/* Unlink Confirmation */}
        {showUnlinkConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-surface-base rounded-lg shadow-xl p-6 max-w-sm mx-4">
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Disconnect Telegram?
              </h3>
              <p className="text-sm text-text-muted mb-6">
                You won't receive Telegram notifications until you reconnect.
                Your notification settings will be preserved.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUnlinkConfirm(false)}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg text-sm font-medium",
                    "border border-surface-border text-text-primary",
                    "hover:bg-surface-overlay transition-colors",
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnlink}
                  disabled={isLoading}
                  className={cn(
                    "flex-1 px-4 py-2 rounded-lg text-sm font-semibold",
                    "text-white bg-status-danger hover:bg-status-danger/90",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "transition-colors",
                  )}
                >
                  {isLoading ? "Disconnecting..." : "Disconnect"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Link flow steps
  return (
    <div className="max-w-2xl mx-auto">
      {/* Step Indicator */}
      <div className="flex items-center justify-between mb-8">
        {["initial", "link", "verify", "linked"].map((step, idx, steps) => (
          <React.Fragment key={step}>
            <div
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full font-semibold",
                "transition-colors duration-base",
                linkFlow.step === step || steps.indexOf(linkFlow.step) > idx
                  ? "bg-accent-primary text-white"
                  : "bg-surface-border text-text-muted",
              )}
            >
              {steps.indexOf(linkFlow.step) > idx ? (
                <CheckCircle className="w-6 h-6" />
              ) : (
                idx + 1
              )}
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-1 mx-2 rounded-full transition-colors duration-base",
                  steps.indexOf(linkFlow.step) > idx
                    ? "bg-accent-primary"
                    : "bg-surface-border",
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-status-danger/10 border border-status-danger/30 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-status-danger flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-status-danger">{error}</p>
          </div>
          <button
            onClick={clearError}
            className="text-status-danger hover:bg-status-danger/10 p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-surface-base rounded-lg border border-surface-border p-8">
        {linkFlow.step === "initial" && (
          <IntroStep onContinue={handleStartLink} />
        )}

        {linkFlow.step === "link" && (
          <LinkStep
            chatId={chatId}
            onChatIdChange={setChatId}
            onContinue={handleContinueToVerify}
            isLoading={isLoading}
            onBack={() => setLinkFlowStep("initial")}
          />
        )}

        {linkFlow.step === "verify" && (
          <VerifyStep
            pin={pin}
            onPinChange={setPin}
            onContinue={handleVerifyPin}
            isLoading={isLoading}
            onBack={() => setLinkFlowStep("link")}
          />
        )}

        {linkFlow.step === "linked" && <SuccessStep onDone={handleReset} />}
      </div>
    </div>
  );
}

/**
 * Intro Step - Welcome and information
 */
function IntroStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="text-center">
      <div className="bg-accent-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
        <MessageCircle className="w-8 h-8 text-accent-primary" />
      </div>
      <h2 className="text-2xl font-bold text-text-primary mb-2">
        Connect Telegram
      </h2>
      <p className="text-text-muted mb-6">
        Get instant notifications about approvals, tasks, and agent activity
        directly on Telegram.
      </p>

      <div className="space-y-3 mb-8 text-left bg-surface-overlay rounded-lg p-4">
        <FeatureItem
          icon={<CheckCircle className="w-5 h-5 text-status-success" />}
          title="Instant Notifications"
          description="Receive real-time updates about approvals and tasks"
        />
        <FeatureItem
          icon={<Clock className="w-5 h-5 text-accent-primary" />}
          title="Per-Agent Control"
          description="Choose which agents send notifications"
        />
        <FeatureItem
          icon={<Send className="w-5 h-5 text-accent-primary" />}
          title="Secure Linking"
          description="PIN-based verification protects your account"
        />
      </div>

      <button
        onClick={onContinue}
        className={cn(
          "w-full px-6 py-3 rounded-lg text-sm font-semibold",
          "text-white bg-accent-primary hover:bg-accent-primary/90",
          "flex items-center justify-center gap-2",
          "transition-colors duration-base",
        )}
      >
        Get Started
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Link Step - Enter Telegram Chat ID
 */
function LinkStep({
  chatId,
  onChatIdChange,
  onContinue,
  isLoading,
  onBack,
}: {
  chatId: string;
  onChatIdChange: (id: string) => void;
  onContinue: () => void;
  isLoading: boolean;
  onBack: () => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-text-primary mb-2">
        Enter Telegram Chat ID
      </h2>
      <p className="text-text-muted mb-6">
        Message our bot and it will send you your Chat ID for verification.
      </p>

      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Chat ID (numeric identifier)
          </label>
          <input
            type="text"
            value={chatId}
            onChange={(e) => onChatIdChange(e.target.value)}
            placeholder="Enter your Telegram Chat ID"
            className={cn(
              "w-full px-4 py-3 rounded-lg border",
              "bg-surface-base text-text-primary placeholder-text-muted",
              "border-surface-border focus:border-accent-primary",
              "focus:ring-2 focus:ring-accent-primary focus:ring-opacity-10",
              "transition-colors duration-base",
            )}
            disabled={isLoading}
          />
          <p className="text-xs text-text-muted mt-2">
            Message @NeureCore_Bot on Telegram to get your Chat ID
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onBack}
          disabled={isLoading}
          className={cn(
            "flex-1 px-4 py-2 rounded-lg text-sm font-medium",
            "border border-surface-border text-text-primary",
            "hover:bg-surface-overlay transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          Back
        </button>
        <button
          onClick={onContinue}
          disabled={!chatId.trim() || isLoading}
          className={cn(
            "flex-1 px-4 py-2 rounded-lg text-sm font-semibold",
            "text-white bg-accent-primary hover:bg-accent-primary/90",
            "flex items-center justify-center gap-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors duration-base",
          )}
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Verify Step - Enter PIN
 */
function VerifyStep({
  pin,
  onPinChange,
  onContinue,
  isLoading,
  onBack,
}: {
  pin: string;
  onPinChange: (p: string) => void;
  onContinue: () => void;
  isLoading: boolean;
  onBack: () => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-text-primary mb-2">
        Verify Your Account
      </h2>
      <p className="text-text-muted mb-6">
        Enter the 6-digit PIN we sent to your Telegram chat.
      </p>

      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Verification PIN
          </label>
          <input
            type="text"
            value={pin}
            onChange={(e) => onPinChange(e.target.value.slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className={cn(
              "w-full px-4 py-3 rounded-lg border text-center text-2xl",
              "tracking-widest font-mono",
              "bg-surface-base text-text-primary placeholder-text-muted",
              "border-surface-border focus:border-accent-primary",
              "focus:ring-2 focus:ring-accent-primary focus:ring-opacity-10",
              "transition-colors duration-base",
            )}
            disabled={isLoading}
          />
          <p className="text-xs text-text-muted text-center mt-2">
            Check your Telegram messages for the PIN
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onBack}
          disabled={isLoading}
          className={cn(
            "flex-1 px-4 py-2 rounded-lg text-sm font-medium",
            "border border-surface-border text-text-primary",
            "hover:bg-surface-overlay transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          Back
        </button>
        <button
          onClick={onContinue}
          disabled={pin.length !== 6 || isLoading}
          className={cn(
            "flex-1 px-4 py-2 rounded-lg text-sm font-semibold",
            "text-white bg-accent-primary hover:bg-accent-primary/90",
            "flex items-center justify-center gap-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors duration-base",
          )}
        >
          {isLoading ? "Verifying..." : "Verify"}
        </button>
      </div>
    </div>
  );
}

/**
 * Success Step - Account linked
 */
function SuccessStep({ onDone }: { onDone: () => void }) {
  return (
    <div className="text-center">
      <div className="bg-status-success/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-8 h-8 text-status-success" />
      </div>
      <h2 className="text-2xl font-bold text-text-primary mb-2">Connected!</h2>
      <p className="text-text-muted mb-8">
        Your Telegram account is now linked. Start receiving instant
        notifications about your agents.
      </p>

      <button
        onClick={onDone}
        className={cn(
          "w-full px-6 py-3 rounded-lg text-sm font-semibold",
          "text-white bg-status-success hover:bg-status-success/90",
          "transition-colors duration-base",
        )}
      >
        Done
      </button>
    </div>
  );
}

/**
 * Feature Item Helper
 */
function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      {icon}
      <div className="text-left">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
    </div>
  );
}

export type { TelegramSettingsPageProps };
