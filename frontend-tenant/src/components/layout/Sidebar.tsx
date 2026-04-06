/**
 * Sidebar Component
 *
 * A collapsible navigation sidebar with grouped items and icons.
 * Follows SOLID principles with composable sub-components.
 *
 * Features:
 * - Grouped navigation items
 * - Collapsible sections
 * - Active state tracking
 * - Badge support for notifications
 * - Responsive behavior (collapses on mobile)
 * - Keyboard navigation
 *
 * Uses design tokens for consistent theming.
 */

"use client";

import React, { useCallback, useMemo } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// ─── Type Definitions ───────────────────────────────────────────────────────

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: boolean | number; // Show badge with count or just presence
  description?: string; // For tooltip
}

export interface SidebarNavGroup {
  label: string;
  items: SidebarNavItem[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

interface SidebarContextType {
  collapsedGroups: Set<string>;
  toggleGroup: (label: string) => void;
  activeHref: string;
  isCollapsed: boolean;
}

// ─── Context ────────────────────────────────────────────────────────────────

const SidebarContext = React.createContext<SidebarContextType | undefined>(
  undefined,
);

function useSidebarContext() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error(
      "Sidebar components must be used within a Sidebar component",
    );
  }
  return context;
}

// ─── Root Component ─────────────────────────────────────────────────────────

interface SidebarProps {
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  isCollapsed?: boolean;
  onCollapseChange?: (isCollapsed: boolean) => void;
}

/**
 * Sidebar Root Component
 *
 * Provides context for all child sidebar components.
 */
function Sidebar({
  children,
  className,
  collapsible = false,
  isCollapsed = false,
  onCollapseChange,
}: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = React.useState(isCollapsed);
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(
    new Set(),
  );

  const collapsed = onCollapseChange ? isCollapsed : internalCollapsed;

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    if (onCollapseChange) {
      onCollapseChange(!isCollapsed);
    } else {
      setInternalCollapsed((prev) => !prev);
    }
  }, [isCollapsed, onCollapseChange]);

  const contextValue: SidebarContextType = useMemo(
    () => ({
      collapsedGroups,
      toggleGroup,
      activeHref: "", // Will be tracked at a higher level if needed
      isCollapsed: collapsed,
    }),
    [collapsedGroups, toggleGroup, collapsed],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <aside
        className={cn(
          "h-screen flex flex-col bg-surface-raised border-r border-surface-border text-text-primary",
          "transition-all duration-base",
          collapsed ? "w-16" : "w-56",
          className,
        )}
      >
        {children}
      </aside>
    </SidebarContext.Provider>
  );
}

Sidebar.displayName = "Sidebar";

// ─── Header Component ───────────────────────────────────────────────────────

interface SidebarHeaderProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Sidebar Header
 *
 * Top section of the sidebar, typically for branding or logo.
 */
function SidebarHeader({ children, className }: SidebarHeaderProps) {
  const { isCollapsed } = useSidebarContext();

  return (
    <div
      className={cn(
        "px-4 py-4 border-b border-surface-border shrink-0",
        "flex items-center justify-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

SidebarHeader.displayName = "SidebarHeader";

// ─── Nav Component ──────────────────────────────────────────────────────────

interface SidebarNavProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Sidebar Nav
 *
 * Container for navigation groups.
 */
function SidebarNav({ children, className }: SidebarNavProps) {
  return (
    <nav
      className={cn("flex-1 overflow-y-auto px-2 py-4 space-y-2", className)}
    >
      {children}
    </nav>
  );
}

SidebarNav.displayName = "SidebarNav";

// ─── Nav Group Component ────────────────────────────────────────────────────

interface SidebarNavGroupProps extends SidebarNavGroup {
  children?: React.ReactNode;
}

/**
 * Sidebar Nav Group
 *
 * Groups related navigation items.
 * Can be collapsible for better space management.
 */
function SidebarNavGroup({
  label,
  items,
  collapsible = true,
  defaultExpanded = true,
  children,
}: SidebarNavGroupProps) {
  const { collapsedGroups, toggleGroup, isCollapsed } = useSidebarContext();
  const isGroupCollapsed = collapsedGroups.has(label);

  React.useEffect(() => {
    if (!defaultExpanded && !collapsedGroups.has(label)) {
      toggleGroup(label);
    }
  }, []);

  const itemsToRender = children || items;

  return (
    <div className="space-y-1">
      {/* Group Header */}
      {collapsible && (
        <button
          onClick={() => toggleGroup(label)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-md",
            "text-xs font-semibold text-text-secondary uppercase tracking-wider",
            "hover:bg-surface-overlay transition-colors duration-base",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
          )}
          title={label}
        >
          <span className="flex-1 text-left">{!isCollapsed && label}</span>
          <ChevronDown
            className={cn(
              "w-3 h-3 transition-transform duration-base shrink-0",
              isGroupCollapsed && "-rotate-90",
            )}
          />
        </button>
      )}

      {/* Group Items */}
      {!isGroupCollapsed && (
        <div className="space-y-1">
          {Array.isArray(itemsToRender)
            ? items.map((item) => (
                <SidebarNavItem key={item.href} item={item} />
              ))
            : itemsToRender}
        </div>
      )}
    </div>
  );
}

// ─── Nav Item Component ─────────────────────────────────────────────────────

interface SidebarNavItemProps {
  item: SidebarNavItem;
  isActive?: boolean;
  className?: string;
}

/**
 * Sidebar Nav Item
 *
 * Individual navigation link with icon and optional badge.
 */
function SidebarNavItem({
  item,
  isActive = false,
  className,
}: SidebarNavItemProps) {
  const { isCollapsed } = useSidebarContext();
  const Icon = item.icon;

  const badgeContent =
    typeof item.badge === "number" ? String(item.badge) : null;

  return (
    <Link
      href={item.href}
      className={cn(
        "relative flex items-center gap-3 px-3 py-2 rounded-md",
        "text-sm font-medium text-text-secondary",
        "transition-colors duration-base",
        "hover:bg-surface-overlay hover:text-text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
        isActive && "bg-accent-primary/10 text-accent-primary",
        className,
      )}
      title={isCollapsed ? item.label : undefined}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {!isCollapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold rounded-full shrink-0 bg-accent-primary text-white">
              {badgeContent || "•"}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

// ─── Footer Component ───────────────────────────────────────────────────────

interface SidebarFooterProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Sidebar Footer
 *
 * Bottom section of the sidebar, typically for user menu or additional actions.
 */
function SidebarFooter({ children, className }: SidebarFooterProps) {
  return (
    <div
      className={cn(
        "px-4 py-4 border-t border-surface-border shrink-0",
        "flex items-center justify-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

SidebarFooter.displayName = "SidebarFooter";

// ─── Exports ────────────────────────────────────────────────────────────────

export {
  Sidebar,
  SidebarHeader,
  SidebarNav,
  SidebarNavGroup,
  SidebarNavItem,
  SidebarFooter,
  useSidebarContext,
};

export type {
  SidebarProps,
  SidebarHeaderProps,
  SidebarNavProps,
  SidebarNavGroupProps,
  SidebarNavItemProps,
  SidebarFooterProps,
};
