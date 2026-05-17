// ─── AccessibilityService.ts ─────────────────────────────────────────────────
// SRP: Owns all accessibility utilities — shortcuts, ARIA, announcements.
// OCP: New shortcut groups registered without modifying existing ones.

export type ShortcutAction =
  | 'openCommandPalette'
  | 'openApprovals'
  | 'openNotifications'
  | 'openSettings'
  | 'newTask'
  | 'newWorkflow'
  | 'goToDashboard'
  | 'goToAgents'
  | 'goToTasks'
  | 'goToWorkflows'
  | 'goToAnalytics'
  | 'goToDepartments'
  | 'goToConnectors'
  | 'toggleSidebar'
  | 'toggleInspector'
  | 'toggleActivityStream'
  | 'toggleTheme'
  | 'closeModal'
  | 'refresh'
  | 'search';

export interface KeyboardShortcut {
  /** Human-readable key combo, e.g. "Ctrl+K"  */
  key: string;
  action: ShortcutAction;
  label: string;
  /** Key(s) used for matching against KeyboardEvent */
  code: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}

export interface IAccessibilityService {
  getShortcuts(): KeyboardShortcut[];
  matchShortcut(e: KeyboardEvent): KeyboardShortcut | undefined;
  announce(message: string, priority?: 'polite' | 'assertive'): void;
  generateAriaLabel(component: string, context: Record<string, unknown>): string;
}

export class AccessibilityService implements IAccessibilityService {
  private readonly shortcuts: KeyboardShortcut[] = [
    // ── Navigation ────────────────────────────────────────────────────────────
    { key: 'Ctrl+K',       action: 'openCommandPalette',  label: 'Open Command Palette',    code: 'KeyK',       ctrlKey: true  },
    { key: 'Ctrl+/',       action: 'search',              label: 'Focus Search',             code: 'Slash',      ctrlKey: true  },
    { key: 'Ctrl+G D',     action: 'goToDashboard',       label: 'Go to Dashboard',          code: 'KeyD',       ctrlKey: true, shiftKey: true },
    { key: 'Ctrl+G A',     action: 'goToAgents',          label: 'Go to Agents',             code: 'KeyA',       ctrlKey: true, shiftKey: true },
    { key: 'Ctrl+G T',     action: 'goToTasks',           label: 'Go to Tasks',              code: 'KeyT',       ctrlKey: true, shiftKey: true },
    { key: 'Ctrl+G W',     action: 'goToWorkflows',       label: 'Go to Workflows',          code: 'KeyW',       ctrlKey: true, shiftKey: true },
    { key: 'Ctrl+G R',     action: 'goToAnalytics',       label: 'Go to Analytics',          code: 'KeyR',       ctrlKey: true, shiftKey: true },
    { key: 'Ctrl+G P',     action: 'openApprovals',       label: 'Go to Approvals',          code: 'KeyP',       ctrlKey: true, shiftKey: true },

    // ── Create actions ────────────────────────────────────────────────────────
    { key: 'Ctrl+N',       action: 'newTask',             label: 'Create New Task',          code: 'KeyN',       ctrlKey: true  },
    { key: 'Ctrl+Shift+N', action: 'newWorkflow',         label: 'Create New Workflow',      code: 'KeyN',       ctrlKey: true, shiftKey: true },

    // ── UI Toggles ────────────────────────────────────────────────────────────
    { key: 'Ctrl+B',       action: 'toggleSidebar',       label: 'Toggle Sidebar',           code: 'KeyB',       ctrlKey: true  },
    { key: 'Ctrl+I',       action: 'toggleInspector',     label: 'Toggle Inspector Panel',   code: 'KeyI',       ctrlKey: true  },
    { key: 'Ctrl+L',       action: 'toggleActivityStream',label: 'Toggle Activity Stream',   code: 'KeyL',       ctrlKey: true  },
    { key: 'Ctrl+Shift+T', action: 'toggleTheme',         label: 'Toggle Theme',             code: 'KeyT',       ctrlKey: true, shiftKey: true },

    // ── Notifications & Settings ──────────────────────────────────────────────
    { key: 'Ctrl+Shift+N', action: 'openNotifications',   label: 'Open Notifications',       code: 'KeyN',       ctrlKey: true, altKey: true },
    { key: 'Ctrl+,',       action: 'openSettings',        label: 'Open Settings',            code: 'Comma',      ctrlKey: true  },

    // ── Misc ─────────────────────────────────────────────────────────────────
    { key: 'Escape',       action: 'closeModal',          label: 'Close / Dismiss',          code: 'Escape'      },
    { key: 'F5',           action: 'refresh',             label: 'Refresh Current Data',     code: 'F5'          },
  ];

  getShortcuts(): KeyboardShortcut[] {
    return [...this.shortcuts];
  }

  matchShortcut(e: KeyboardEvent): KeyboardShortcut | undefined {
    return this.shortcuts.find((s) => {
      if (s.code !== e.code) return false;
      if ((s.ctrlKey ?? false) !== (e.ctrlKey || e.metaKey)) return false;
      if ((s.shiftKey ?? false) !== e.shiftKey) return false;
      if ((s.altKey ?? false) !== e.altKey) return false;
      return true;
    });
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (typeof document === 'undefined') return;

    const id = `hq-aria-live-${priority}`;
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.setAttribute('aria-live', priority);
      el.setAttribute('aria-atomic', 'true');
      Object.assign(el.style, {
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: '0',
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
        border: '0',
      });
      document.body.appendChild(el);
    }

    // Clear then set to trigger re-announcement
    el.textContent = '';
    setTimeout(() => { el!.textContent = message; }, 50);
  }

  generateAriaLabel(component: string, context: Record<string, unknown>): string {
    const templates: Record<string, (ctx: Record<string, unknown>) => string> = {
      AgentCard:     (c) => `Agent ${c.name}: ${c.status}, ${c.successRate}% success rate`,
      TaskCard:      (c) => `Task ${c.title}: ${c.status}, priority ${c.priority}`,
      WorkflowCard:  (c) => `Workflow ${c.name}: ${c.status}`,
      KpiTile:       (c) => `${c.label}: ${c.value}${c.deltaLabel ? `, ${c.delta} ${c.deltaLabel}` : ''}`,
      NotifBell:     (c) => `Notifications, ${c.unread} unread`,
      ApprovalBtn:   (c) => `Approve ${c.title}`,
      DelegateBtn:   (c) => `Delegate task ${c.taskTitle} to agent ${c.agentName}`,
    };
    const tpl = templates[component];
    return tpl ? tpl(context) : `${component} element`;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const accessibilityService = new AccessibilityService();
