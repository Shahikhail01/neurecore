/**
 * Home Screen Component - Phase 1
 *
 * Unified home page compositing all home-related components.
 * Provides a scenic welcome experience with quick links, agent status, and activity feed.
 *
 * Layout:
 * - Full-height container
 * - Hero section at top (greeting, timestamp, command input)
 * - Quick links grid (new task, approvals, agent status, etc.)
 * - Agent status panel and recent activity side-by-side (desktop)
 * - Stacked on mobile/tablet
 *
 * Responsive:
 * - Desktop (>1024px): Hero + quick links (2 rows) + activity sidebar
 * - Tablet (768-1023px): Hero + quick links (1 row) + scrollable activity
 * - Mobile (<768px): Hero (shortened) + vertical stack
 *
 * Features:
 * - Real-time agent status updates
 * - Recent activity feed with timestamps
 * - Quick access to major features
 * - Skeleton loading states for data
 * - Full keyboard navigation
 * - WCAG 2.1 AA accessibility
 */

"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, CheckCircle2, Users } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useActivityStore } from "@/stores/activityStore";
import { useAgentStore } from "@/stores/agentStore";
import { useTaskStore } from "@/stores/taskStore";

// Home screen sub-components
import { HeroSection } from "./HeroSection";
import { QuickLinksGrid } from "./QuickLinksGrid";
import { ActivityFeed } from "./ActivityFeed";
import { AgentStatusPanel } from "./AgentStatusPanel";

interface HomeScreenProps {
  /**
   * Optional custom className
   */
  className?: string;

  /**
   * Optional callback when user submits command from hero
   */
  onCommandSubmit?: (command: string) => void;

  /**
   * Optional hero background image URL
   */
  heroBgImage?: string;
}

/**
 * HomeScreen Component
 *
 * Main home page that displays:
 * 1. Hero section with greeting and command input
 * 2. Quick access links (New Task, Approvals, Agents, Departments, etc.)
 * 3. Agent status overview
 * 4. Recent activity feed (tasks, approvals, agent messages)
 *
 * @example
 * ```tsx
 * <HomeScreen
 *   onCommandSubmit={(cmd) => router.push(`/search?q=${cmd}`)}
 *   heroBgImage="/images/home-hero.jpg"
 * />
 * ```
 */
export function HomeScreen({
  className,
  onCommandSubmit,
  heroBgImage,
}: HomeScreenProps) {
  const user = useAuthStore((s) => s.user);
  const events = useActivityStore((s) => s.events);
  const agents = useAgentStore((s) => s.agents);
  const tasks = useTaskStore((s) => s.tasks);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize data on mount
  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load agent status, recent tasks, activity
        // This would typically be done via stores or API calls
        // For now, data loads via store selectors above
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load home screen";
        setError(errorMessage);
        console.error("HomeScreen initialization error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, []);

  // Handle command submission
  const handleCommand = (command: string) => {
    if (onCommandSubmit) {
      onCommandSubmit(command);
    } else {
      // Default: Navigate to search or command palette
      console.log("Command submitted:", command);
    }
  };

  return (
    <div
      className={cn(
        "min-h-screen w-full bg-surface-base overflow-y-auto",
        className,
      )}
      role="main"
      aria-label="Home screen"
    >
      {/* Error State */}
      {error && (
        <div
          className="m-4 p-4 rounded-lg border-2 border-danger bg-danger/10 text-danger"
          role="alert"
          aria-live="polite"
        >
          <h2 className="font-semibold">Error loading home screen</h2>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Hero Section */}
      <section
        className="w-full"
        aria-label="Hero section with greeting and command input"
      >
        <HeroSection
          userName={user?.firstName}
          onCommandSubmit={handleCommand}
          placeholder="Message NeureCore or ask a question..."
          backgroundImage={heroBgImage}
        />
      </section>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Quick Links Section */}
        <section aria-label="Quick access links">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-text-primary">
              Quick Access
            </h2>
            <p className="text-sm text-text-secondary">
              Jump to frequently used features
            </p>
          </div>
          <QuickLinksGrid
            links={[
              {
                id: "new-task",
                label: "New Task",
                icon: Plus,
                onClick: () => console.log("New task"),
              },
              {
                id: "approvals",
                label: "Approvals",
                icon: CheckCircle2,
                onClick: () => console.log("View approvals"),
              },
              {
                id: "agents",
                label: "Team",
                icon: Users,
                onClick: () => console.log("View agents"),
              },
            ]}
          />
        </section>

        {/* Desktop: Two-column layout (Agent Status + Activity Feed) */}
        {/* Tablet/Mobile: Stacked layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Agent Status Panel (Left/Full) */}
          <section className="lg:col-span-2" aria-label="Agent status overview">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-text-primary">
                Team Status
              </h2>
              <p className="text-sm text-text-secondary">
                {agents.length} agents available
              </p>
            </div>
            <AgentStatusPanel
              agents={agents.map((agent) => ({
                ...agent,
                mode:
                  (agent as any).mode ||
                  ("assist" as "assist" | "copilot" | "autopilot"),
                status: (agent as any).status || "online",
              }))}
            />
          </section>

          {/* Recent Activity Feed (Right/Full) */}
          <section className="lg:col-span-1" aria-label="Recent activity feed">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-text-primary">
                Recent Activity
              </h2>
              <p className="text-sm text-text-secondary">
                {events.length} recent updates
              </p>
            </div>
            <ActivityFeed
              activities={events.map((event) => ({
                id: event.id,
                type: event.type as any,
                title: (event as any).title || "Activity",
                description: (event as any).description,
                timestamp: new Date(event.timestamp),
                status: (event as any).status,
              }))}
              maxVisible={8}
            />
          </section>
        </div>

        {/* Additional Info Section (Optional: Upcoming Tasks, Pending Approvals) */}
        <section
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          aria-label="Additional information"
        >
          {/* Upcoming Tasks Card */}
          <div
            className="p-4 rounded-lg border border-surface-border bg-surface-raised"
            role="region"
            aria-label="Upcoming tasks"
          >
            <h3 className="font-semibold text-text-primary mb-3">
              Upcoming Tasks
            </h3>
            <div className="space-y-2">
              {isLoading ? (
                <>
                  <div className="h-12 rounded bg-neutral-700 animate-pulse" />
                  <div className="h-12 rounded bg-neutral-700 animate-pulse" />
                </>
              ) : tasks.length > 0 ? (
                tasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    className="p-2 rounded border border-surface-border text-sm hover:bg-surface-overlay cursor-pointer transition-colors"
                  >
                    <p className="font-medium text-text-primary">
                      {task.title}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {task.agentName || "Unassigned"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-secondary italic">
                  No upcoming tasks
                </p>
              )}
            </div>
          </div>

          {/* Pending Approvals Card */}
          <div
            className="p-4 rounded-lg border border-surface-border bg-surface-raised"
            role="region"
            aria-label="Pending approvals"
          >
            <h3 className="font-semibold text-text-primary mb-3">
              Pending Approvals
            </h3>
            <div className="space-y-2">
              {isLoading ? (
                <>
                  <div className="h-12 rounded bg-neutral-700 animate-pulse" />
                  <div className="h-12 rounded bg-neutral-700 animate-pulse" />
                </>
              ) : (
                <p className="text-sm text-text-secondary italic">
                  No pending approvals
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Footer Spacer */}
      <div className="h-12" />
    </div>
  );
}

export default HomeScreen;
