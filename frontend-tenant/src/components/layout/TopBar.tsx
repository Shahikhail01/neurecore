/**
 * Top Bar Component
 * 
 * Header bar for the application with title, user info, autonomy selector, and theme toggle.
 * Provides quick access to global settings and user profile.
 * 
 * Features:
 * - Configurable title/breadcrumbs
 * - Autonomy level selector (Assist, Copilot, Autopilot)
 * - User profile dropdown (optional)
 * - Theme toggle with three modes (light, dark, high-contrast)
 * - Responsive layout
 * - Design token integration for consistent styling
 * - Full accessibility with ARIA labels
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/types/auth.types";
import { ThemeToggle } from "./ThemeToggle";
import { Zap, User, LogOut, Settings } from "lucide-react";

export type AutonomyLevel = "assist" | "copilot" | "autopilot";

interface TopBarProps {
  title: string;
  user: AuthUser | null;
  autonomy: AutonomyLevel;
  onAutonomyChange: (level: AutonomyLevel) => void;
}

const LEVELS: { value: AutonomyLevel; label: string; description: string }[] = [
  { value: "assist", label: "Assist", description: "AI suggests actions" },
  { value: "copilot", label: "Copilot", description: "AI works alongside you" },
  { value: "autopilot", label: "Autopilot", description: "AI handles tasks" },
];

/**
 * TopBar Component
 * 
 * @example
 * <TopBar
 *   title="Dashboard"
 *   user={authUser}
 *   autonomy="copilot"
 *   onAutonomyChange={(level) => setAutonomy(level)}
 * />
 */
export function TopBar({
  title,
  user,
  autonomy,
  onAutonomyChange,
}: TopBarProps) {
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    }

    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [userMenuOpen]);

  return (
    <header
      className={cn(
        "h-14 flex items-center justify-between px-6",
        "border-b border-surface-border",
        "bg-surface-base flex-shrink-0",
        "transition-colors duration-base",
      )}
    >
      {/* Title/Breadcrumb */}
      <h1 className="text-base font-semibold text-text-primary truncate">
        {title}
      </h1>

      {/* Controls */}
      <div className="flex items-center gap-6">
        {/* Autonomy Selector */}
        <div
          className="flex items-center gap-2 text-xs"
          role="group"
          aria-label="Autonomy level selector"
        >
          {LEVELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onAutonomyChange(value)}
              className={cn(
                "px-3 py-1.5 rounded-md font-medium",
                "transition-all duration-base",
                "focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2",
                autonomy === value
                  ? "bg-accent-primary text-white shadow-md"
                  : "text-text-muted hover:text-text-primary hover:bg-surface-raised",
              )}
              title={`Switch to ${label}: ${label.toLowerCase()}`}
              aria-pressed={autonomy === value}
              aria-label={label}
            >
              <Zap className="w-3 h-3 inline mr-1" />
              {label}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="hidden md:block h-6 w-px bg-surface-border" />

        {/* Theme Toggle */}
        <div className="hidden md:block">
          <ThemeToggle />
        </div>

        {/* User Menu */}
        {user && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md",
                "bg-surface-raised border border-surface-border",
                "hover:border-accent-primary transition-all duration-base",
                "focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2",
                userMenuOpen && "border-accent-primary",
              )}
              aria-expanded={userMenuOpen}
              aria-haspopup="menu"
              aria-label="User menu"
            >
              <div className="w-5 h-5 rounded-full bg-accent-primary flex items-center justify-center text-white text-xs font-semibold">
                {(user.firstName?.[0] || user.email[0]).toUpperCase()}
              </div>
              <span className="text-sm text-text-primary hidden sm:inline truncate">
                {user.firstName || user.email.split("@")[0]}
              </span>
            </button>

            {/* User Menu Dropdown */}
            {userMenuOpen && (
              <div
                className={cn(
                  "absolute right-0 mt-2 w-48 z-50",
                  "bg-surface-raised border border-surface-border rounded-lg",
                  "shadow-lg overflow-hidden",
                )}
                role="menu"
              >
                <div className="px-4 py-3 border-b border-surface-border">
                  <p className="text-sm font-semibold text-text-primary">
                    {user.firstName || "User"}
                  </p>
                  <p className="text-xs text-text-muted">{user.email}</p>
                </div>

                <button
                  onClick={() => {
                    console.log("Navigate to profile");
                    setUserMenuOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2 text-sm",
                    "text-text-primary hover:bg-surface-base",
                    "transition-colors duration-base",
                    "focus:outline-none focus:bg-surface-base",
                  )}
                  role="menuitem"
                >
                  <User className="w-4 h-4 inline mr-2" />
                  Profile
                </button>

                <button
                  onClick={() => {
                    console.log("Navigate to settings");
                    setUserMenuOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2 text-sm",
                    "text-text-primary hover:bg-surface-base",
                    "transition-colors duration-base",
                    "focus:outline-none focus:bg-surface-base",
                  )}
                  role="menuitem"
                >
                  <Settings className="w-4 h-4 inline mr-2" />
                  Settings
                </button>

                <div className="border-t border-surface-border" />

                <button
                  onClick={() => {
                    console.log("Logout");
                    setUserMenuOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2 text-sm",
                    "text-status-danger hover:bg-surface-base",
                    "transition-colors duration-base",
                    "focus:outline-none focus:bg-surface-base",
                  )}
                  role="menuitem"
                >
                  <LogOut className="w-4 h-4 inline mr-2" />
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
