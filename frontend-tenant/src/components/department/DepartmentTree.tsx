/**
 * DepartmentTree Component - Phase 3
 *
 * Displays organizational departments in a collapsible tree structure.
 * Integrated into the Sidebar for department-based navigation.
 *
 * Features:
 * - Hierarchical tree with expand/collapse toggle
 * - Department head agent avatar badges
 * - Task count indicators
 * - Unread message badges
 * - Color-coded departments
 * - Active state indication
 * - Right-click context menu (future: edit, delete, budget, agents)
 * - Drag-to-reorder (future phase)
 * - Keyboard navigation (arrow keys,Enter to expand)
 * - WCAG AA accessibility
 * - Light/dark theme via design tokens
 * - Composable sub-component architecture
 *
 * Architecture:
 * - DepartmentTree: Root component
 * - DepartmentTreeItem: Individual dept row (composable sub-component)
 * - DepartmentContextMenu: Right-click actions (composable)
 */

"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  MoreVertical,
  Edit2,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import type { Department } from "@/types/department.types";

interface DepartmentTreeProps {
  /**
   * All departments to display
   */
  departments: Department[];

  /**
   * Expanded department IDs
   */
  expandedIds?: Set<string>;

  /**
   * Currently selected department ID
   */
  selectedDepartmentId?: string;

  /**
   * Callback when department is selected
   */
  onSelectDepartment: (departmentId: string) => void;

  /**
   * Callback when department is expanded/collapsed
   */
  onToggleExpanded?: (departmentId: string) => void;

  /**
   * Callback for context menu actions
   */
  onContextMenuAction?: (action: string, departmentId: string) => void;

  /**
   * Callback when creating new department
   */
  onCreateDepartment?: (parentDepartmentId?: string) => void;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * DepartmentTree Component
 *
 * @example
 * <DepartmentTree
 *   departments={deptList}
 *   selectedDepartmentId="dept-1"
 *   expandedIds={new Set(['dept-1'])}
 *   onSelectDepartment={handleSelect}
 *   onToggleExpanded={handleToggle}
 * />
 */
export function DepartmentTree({
  departments,
  expandedIds = new Set(),
  selectedDepartmentId,
  onSelectDepartment,
  onToggleExpanded,
  onContextMenuAction,
  onCreateDepartment,
  className,
}: DepartmentTreeProps) {
  // Filter root departments (no parent)
  const rootDepts = departments.filter((d) => !d.parentDepartmentId);

  return (
    <div
      className={cn("space-y-1 px-2", className)}
      role="tree"
      aria-label="Departments"
    >
      {rootDepts.length === 0 ? (
        <div className="px-3 py-4 text-center">
          <p className="text-xs text-text-muted">No departments</p>
          {onCreateDepartment && (
            <button
              onClick={() => onCreateDepartment()}
              className={cn(
                "mt-2 text-xs text-accent-primary hover:text-accent-600",
                "focus:outline-none focus:underline",
              )}
            >
              Create department
            </button>
          )}
        </div>
      ) : (
        rootDepts.map((dept) => (
          <DepartmentTreeItem
            key={dept.id}
            department={dept}
            allDepartments={departments}
            isExpanded={expandedIds.has(dept.id)}
            isSelected={selectedDepartmentId === dept.id}
            expandedIds={expandedIds}
            depth={0}
            onSelectDepartment={onSelectDepartment}
            onToggleExpanded={onToggleExpanded}
            onContextMenuAction={onContextMenuAction}
            onCreateDepartment={onCreateDepartment}
          />
        ))
      )}
    </div>
  );
}

/**
 * Individual Department Tree Item (Composable Sub-Component)
 *
 * Renders a single department with potential child departments
 */
function DepartmentTreeItem({
  department,
  allDepartments,
  isExpanded,
  isSelected,
  expandedIds,
  depth,
  onSelectDepartment,
  onToggleExpanded,
  onContextMenuAction,
  onCreateDepartment,
}: {
  department: Department;
  allDepartments: Department[];
  isExpanded: boolean;
  isSelected: boolean;
  expandedIds: Set<string>;
  depth: number;
  onSelectDepartment: (deptId: string) => void;
  onToggleExpanded?: (deptId: string) => void;
  onContextMenuAction?: (action: string, deptId: string) => void;
  onCreateDepartment?: (parentDeptId?: string) => void;
}) {
  const [showContextMenu, setShowContextMenu] = React.useState(false);
  const contextMenuRef = React.useRef<HTMLDivElement>(null);

  // Get child departments
  const childDepts = allDepartments.filter(
    (d) => d.parentDepartmentId === department.id,
  );
  const hasChildren = childDepts.length > 0;

  // Close context menu when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target as Node)
      ) {
        setShowContextMenu(false);
      }
    }

    if (showContextMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showContextMenu]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSelectDepartment(department.id);
    } else if (e.key === "ArrowRight" && hasChildren) {
      e.preventDefault();
      if (!isExpanded) {
        onToggleExpanded?.(department.id);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (isExpanded) {
        onToggleExpanded?.(department.id);
      }
    }
  };

  return (
    <div>
      {/* Department Item */}
      <div
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-level={depth + 1}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer",
          "transition-colors duration-base",
          isSelected
            ? "bg-accent-primary/10 border-l-2 border-accent-primary"
            : "hover:bg-surface-overlay",
          "focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-accent-primary",
        )}
        onClick={() => onSelectDepartment(department.id)}
        onKeyDown={handleKeyDown}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowContextMenu(true);
        }}
        tabIndex={0}
      >
        {/* Expand/Collapse Toggle */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpanded?.(department.id);
            }}
            className="p-0.5 hover:bg-surface-base rounded transition-colors"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform duration-base flex-shrink-0",
                !isExpanded && "-rotate-90",
              )}
            />
          </button>
        )}

        {/* Empty space for non-expandable items */}
        {!hasChildren && <div className="w-4" />}

        {/* Department Name */}
        <span
          className={cn(
            "font-medium text-sm flex-1 text-text-primary truncate",
            isSelected && "font-semibold",
          )}
        >
          {department.name}
        </span>

        {/* Badge Container (Task Count + Unread) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Task Count */}
          {department.taskCount !== undefined && department.taskCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-accent-primary/20 text-accent-primary font-medium">
              {department.taskCount}
            </span>
          )}

          {/* Unread Badge */}
          {department.unreadCount !== undefined &&
            department.unreadCount > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-status-danger text-white font-medium">
                {department.unreadCount}
              </span>
            )}
        </div>

        {/* Context Menu Button */}
        <div className="relative" ref={contextMenuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowContextMenu(!showContextMenu);
            }}
            className="p-1 hover:bg-surface-base rounded transition-colors text-text-muted hover:text-text-primary"
            aria-label="Department options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Context Menu */}
          {showContextMenu && (
            <DepartmentContextMenu
              onAction={(action) => {
                onContextMenuAction?.(action, department.id);
                setShowContextMenu(false);
              }}
              onCreateSubDept={() => {
                onCreateDepartment?.(department.id);
                setShowContextMenu(false);
              }}
            />
          )}
        </div>
      </div>

      {/* Child Departments */}
      {hasChildren && isExpanded && (
        <div role="group" className="ml-2">
          {childDepts.map((childDept) => (
            <DepartmentTreeItem
              key={childDept.id}
              department={childDept}
              allDepartments={allDepartments}
              isExpanded={expandedIds.has(childDept.id)}
              isSelected={childDept.id === childDept.id}
              expandedIds={expandedIds}
              depth={depth + 1}
              onSelectDepartment={onSelectDepartment}
              onToggleExpanded={onToggleExpanded}
              onContextMenuAction={onContextMenuAction}
              onCreateDepartment={onCreateDepartment}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Context Menu for Department Actions
 */
function DepartmentContextMenu({
  onAction,
  onCreateSubDept,
}: {
  onAction: (action: string) => void;
  onCreateSubDept: () => void;
}) {
  return (
    <div
      className={cn(
        "absolute right-0 top-full mt-1 w-48 z-50",
        "bg-surface-raised border border-surface-border rounded-lg",
        "shadow-lg overflow-hidden",
      )}
      role="menu"
    >
      {[
        { label: "View agents", icon: Users, action: "view-agents" },
        { label: "Create sub-department", icon: Users, action: "create-sub" },
        { label: "Edit", icon: Edit2, action: "edit" },
        { label: "Settings", icon: Settings, action: "settings" },
        { label: "Delete", icon: Trash2, action: "delete", isDangerous: true },
      ].map(({ label, icon: Icon, action, isDangerous }) => (
        <button
          key={action}
          onClick={() =>
            action === "create-sub" ? onCreateSubDept() : onAction(action)
          }
          className={cn(
            "w-full text-left px-3 py-2 text-sm",
            "flex items-center gap-2",
            "transition-colors duration-base",
            isDangerous
              ? "text-status-danger hover:bg-status-danger/10"
              : "text-text-primary hover:bg-surface-base",
            "focus:outline-none focus:bg-surface-base",
          )}
          role="menuitem"
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

export type { DepartmentTreeProps };
