/**
 * Home Screen Component
 * 
 * Main landing page for authenticated users.
 * Combines hero section, quick actions, agent status, and activity feed.
 * Serves as the dashboard and navigation hub for NeureCore platform.
 * 
 * Features:
 * - Personalized greeting based on time and user data
 * - Prominent command/chat input for quick interactions
 * - Quick action links for common workflows
 * - Agent status display with mode switcher
 * - Activity feed for recent events
 * - Responsive layout (mobile-first design)
 * - Integrated with Zustand stores for state management
 * - Light/dark/high-contrast theme support
 * - Follows SOLID principles with composable sub-components
 */

"use client";

import React from "react";
import { useAuthStore } from "@/stores/authStore";
import {
  Plus,
  CheckCircle2,
  MessageSquare,
  Play,
  Zap,
  Eye,
  Settings,
} from "lucide-react";
import { HeroSection } from "@/components/home/HeroSection";
import { QuickLinksGrid, type QuickLink } from "@/components/home/QuickLinksGrid";
import { ActivityFeed, type Activity } from "@/components/home/ActivityFeed";
import { AgentStatusPanel, type Agent } from "@/components/home/AgentStatusPanel";

/**
 * HomeScreen Component
 * 
 * @example
 * <HomeScreen />
 */
export function HomeScreen() {
  const user = useAuthStore((state) => state.user);
  const [commandInput, setCommandInput] = React.useState("");
  const [selectedAgent, setSelectedAgent] = React.useState<string>("marketing-agent");

  // Mock data for quick links
  const quickLinks: QuickLink[] = [
    {
      id: "new-task",
      label: "New Task",
      icon: Plus,
      description: "Create a new workflow task",
      onClick: () => handleQuickAction("new-task"),
      badge: undefined,
    },
    {
      id: "new-approval",
      label: "New Approval",
      icon: CheckCircle2,
      description: "Create approval request",
      onClick: () => handleQuickAction("new-approval"),
      badge: "3",
      badgeVariant: "warning",
    },
    {
      id: "agent-status",
      label: "Agent Status",
      icon: Zap,
      description: "View active agents",
      onClick: () => handleQuickAction("agent-status"),
      badge: undefined,
    },
    {
      id: "create-agent",
      label: "Create Agent",
      icon: Plus,
      description: "Set up new AI agent",
      onClick: () => handleQuickAction("create-agent"),
      badge: undefined,
    },
    {
      id: "view-templates",
      label: "View Templates",
      icon: Eye,
      description: "Browse workflow templates",
      onClick: () => handleQuickAction("view-templates"),
      badge: undefined,
    },
    {
      id: "chat",
      label: "Chat",
      icon: MessageSquare,
      description: "Start conversation",
      onClick: () => handleQuickAction("chat"),
      badge: undefined,
    },
  ];

  // Mock data for agents
  const agents: Agent[] = [
    {
      id: "marketing-agent",
      name: "Marketing Agent",
      status: "online",
      mode: "copilot",
      activeTasks: 5,
      description: "Campaign management and content creation",
    },
    {
      id: "sales-agent",
      name: "Sales Agent",
      status: "online",
      mode: "assist",
      activeTasks: 2,
      description: "Lead qualification and pipeline management",
    },
    {
      id: "support-agent",
      name: "Support Agent",
      status: "offline",
      mode: "assist",
      activeTasks: 0,
      description: "Customer support and ticketing",
    },
  ];

  // Mock data for activity feed
  const activities: Activity[] = [
    {
      id: "act-1",
      type: "task",
      title: "Complete Q4 campaign review",
      status: "pending",
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
      user: {
        name: "Marketing Agent",
      },
      description: "Campaign performance analysis for Q4 planning",
      actions: [
        {
          label: "View",
          onClick: () => console.log("View task"),
        },
      ],
    },
    {
      id: "act-2",
      type: "approval",
      title: "Campaign budget adjustment",
      status: "pending",
      timestamp: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
      user: {
        name: "Sales Manager",
      },
      description: "$50,000 budget reallocation for social media",
      actions: [
        {
          label: "Approve",
          onClick: () => console.log("Approve"),
        },
      ],
    },
    {
      id: "act-3",
      type: "message",
      title: "New message from Support Agent",
      status: "in-progress",
      timestamp: new Date(Date.now() - 1000 * 60 * 300), // 5 hours ago
      description: "Customer escalation: Premium account issue",
      actions: [
        {
          label: "Reply",
          onClick: () => console.log("Reply"),
        },
      ],
    },
    {
      id: "act-4",
      type: "workflow",
      title: "Lead scoring workflow completed",
      status: "completed",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8), // 8 hours ago
      description: "Processed 250 leads with updated scoring model",
    },
    {
      id: "act-5",
      type: "agent",
      title: "New agent capability: Email automation",
      status: "completed",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      description: "Marketing Agent now supports automated email campaigns",
    },
  ];

  const handleQuickAction = (actionId: string) => {
    console.log("Quick action:", actionId);
    // Route to specific pages or open modals
    switch (actionId) {
      case "new-task":
        // Navigate to task creation
        break;
      case "new-approval":
        // Navigate to approval creation
        break;
      case "agent-status":
        // Navigate to agents page
        break;
      case "create-agent":
        // Navigate to agent creation
        break;
      case "view-templates":
        // Navigate to templates
        break;
      case "chat":
        // Open chat panel
        break;
    }
  };

  const handleCommand = (command: string) => {
    console.log("Command submitted:", command);
    // Handle command input (could trigger search, agent execution, etc.)
    setCommandInput("");
  };

  const handleAgentModeChange = (agentId: string, newMode: string) => {
    console.log("Agent mode changed:", agentId, newMode);
    // Update agent mode via store or API
  };

  const handleAgentClick = (agentId: string) => {
    setSelectedAgent(agentId);
    console.log("Agent selected:", agentId);
  };

  return (
    <div className="w-full space-y-8 p-4 md:p-8">
      {/* Hero Section */}
      <HeroSection
        userName={user?.firstName || "there"}
        placeholder="Message NeureCore or ask a question..."
        onCommandSubmit={handleCommand}
      />

      {/* Quick Links Grid */}
      <section>
        <h2 className="text-lg font-semibold text-text-primary mb-4">
          Quick Actions
        </h2>
        <QuickLinksGrid links={quickLinks} />
      </section>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Agent Status */}
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            Your Agents
          </h2>
          <AgentStatusPanel
            agents={agents}
            primaryAgentId={selectedAgent}
            onModeChange={handleAgentModeChange}
            onAgentClick={handleAgentClick}
          />
        </div>

        {/* Right Column: Activity Feed */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            Recent Activity
          </h2>
          <ActivityFeed
            activities={activities}
            hasMore={true}
            maxVisible={5}
          />
        </div>
      </div>
    </div>
  );
}

export type { };