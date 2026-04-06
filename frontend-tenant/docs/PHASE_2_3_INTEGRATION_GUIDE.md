/**
 * PHASE 2-3 INTEGRATION GUIDE
 * 
 * This document outlines how to integrate Phase 2 (Chat Consolidation) and 
 * Phase 3 (Department Management) components into the existing TenantShell layout.
 * 
 * ARCHITECTURE OVERVIEW:
 * 
 * ┌─────────────────────────────────────────────────────────┐
 * │                      TenantShell                         │
 * │  (Main app layout container)                            │
 * ├──────────────┬─────────────────────┬───────────────────┤
 * │   Sidebar    │    Main Content     │   ChatPanel       │
 * │  (Updated    │     (Dynamic)       │  (New - Right)    │
 * │   Phase 3)   │                     │   Phase 2         │
 * │              │                     │                   │
 * │ DepartmentT  │  Home/Workspace/    │  ChannelSelector  │
 * │    Tree      │     Details/etc     │  MessageList      │
 * │              │                     │  MessageInput     │
 * └──────────────┴─────────────────────┴───────────────────┘
 * 
 * 
 * INTEGRATION STEPS:
 * 
 * ═══════════════════════════════════════════════════════════════════
 * STEP 1: Update TenantShell.tsx Layout
 * ═══════════════════════════════════════════════════════════════════
 * 
 * // File: src/(authenticated)/layout.tsx or src/components/TenantShell.tsx
 * 
 * Add imports:
 * ```typescript
 * import { ChatPanel } from '@/components/chat';
 * import { useChatStore } from '@/stores/chatStore';
 * import { useTaskStore } from '@/stores/taskStore';
 * ```
 * 
 * Update layout structure:
 * ```typescript
 * export function TenantShell({ children }: { children: React.ReactNode }) {
 *   const { departments, selectedDepartmentId, expandedIds, toggleExpanded } = useDepartmentStore();
 *   const { channels, activeChannel, messages } = useChatStore();
 *   
 *   // Filter channels by selectedDepartmentId if one is selected
 *   const visibleChannels = selectedDepartmentId
 *     ? channels.filter(ch => 
 *         ch.type === 'department' && ch.departmentId === selectedDepartmentId ||
 *         ch.type === 'all-agents' || // Always show broadcast
 *         ch.type === 'direct' // Always show direct messages
 *       )
 *     : channels;
 * 
 *   return (
 *     <div className="flex h-screen bg-surface-base">
 *       {/* Sidebar */}
 *       <aside className="w-64 border-r border-surface-border overflow-y-auto">
 *         <Sidebar>
 *           {/* Replace hardcoded NAV_GROUPS with DepartmentTree - see STEP 2 */}
 *         </Sidebar>
 *       </aside>
 * 
 *       {/* Main Content */}
 *       <main className="flex-1 overflow-y-auto">
 *         {children}
 *       </main>
 * 
 *       {/* Chat Panel - NEW Phase 2 */}
 *       <aside className="w-80 border-l border-surface-border bg-surface-base overflow-hidden">
 *         <ChatPanel
 *           channels={visibleChannels}
 *           activeChannel={activeChannel}
 *           messages={messages}
 *           onChannelChange={(channelId) => {
 *             useChatStore.setState({ activeChannelId: channelId });
 *           }}
 *           onSendMessage={async (text) => {
 *             // Send message via API/WebSocket
 *           }}
 *         />
 *       </aside>
 *     </div>
 *   );
 * }
 * ```
 * 
 * 
 * ═══════════════════════════════════════════════════════════════════
 * STEP 2: Update Sidebar.tsx to Show DepartmentTree
 * ═══════════════════════════════════════════════════════════════════
 * 
 * // File: src/components/Sidebar.tsx
 * 
 * Add imports:
 * ```typescript
 * import { DepartmentTree } from '@/components/department';
 * import { useDepartmentStore } from '@/stores/departmentStore';
 * ```
 * 
 * Replace hardcoded NAV_GROUPS:
 * ```typescript
 * export function Sidebar({ children }: { children: React.ReactNode }) {
 *   const { 
 *     departments, 
 *     selectedDepartmentId, 
 *     expandedDepartmentIds,
 *     setSelected,
 *     toggleDepartmentExpanded,
 *     fetchDepartments
 *   } = useDepartmentStore();
 * 
 *   React.useEffect(() => {
 *     fetchDepartments();
 *   }, []);
 * 
 *   return (
 *     <div className="h-full flex flex-col">
 *       {/* Header */}
 *       <SidebarHeader />
 * 
 *       {/* Navigation Tabs */}
 *       <SidebarTabs />
 * 
 *       {/* Department Tree - Replaces old nav */}
 *       <div className="flex-1 overflow-y-auto">
 *         <DepartmentTree
 *           departments={departments}
 *           selectedDepartmentId={selectedDepartmentId}
 *           expandedIds={expandedDepartmentIds}
 *           onSelectDepartment={(deptId) => setSelected(
 *             departments.find(d => d.id === deptId) || null
 *           )}
 *           onToggleExpanded={toggleDepartmentExpanded}
 *         />
 *       </div>
 * 
 *       {/* Footer */}
 *       <SidebarFooter />
 *     </div>
 *   );
 * }
 * ```
 * 
 * 
 * ═══════════════════════════════════════════════════════════════════
 * STEP 3: Wire Chat Store (If Using Zustand)
 * ═══════════════════════════════════════════════════════════════════
 * 
 * // File: src/stores/chatStore.ts (New or existing)
 * 
 * ```typescript
 * import { create } from 'zustand';
 * import type { ChatChannel, ChannelMessage } from '@/types/channels.types';
 * 
 * interface ChatStore {
 *   channels: ChatChannel[];
 *   activeChannelId: string | null;
 *   messages: ChannelMessage[];
 *   isLoading: boolean;
 *   error: string | null;
 * 
 *   fetchChannels: () => Promise<void>;
 *   selectChannel: (channelId: string) => Promise<void>;
 *   sendMessage: (channelId: string, text: string) => Promise<void>;
 *   updatePresence: (agentId: string, status: string) => void;
 * }
 * 
 * export const useChatStore = create<ChatStore>((set, get) => ({
 *   // ... implementation
 * }));
 * ```
 * 
 * 
 * ═══════════════════════════════════════════════════════════════════
 * STEP 4: Responsive Layout (Mobile/Tablet)
 * ═══════════════════════════════════════════════════════════════════
 * 
 * For mobile/tablet, consider:
 * 
 * - Hide ChatPanel on screens < 1024px
 * - Show ChatPanel as bottom sheet modal instead
 * - Reduce Sidebar width on tablet (48px icons only)
 * 
 * ```typescript
 * // In TenantShell or appropriate layout component
 * 
 * const isMobile = useMediaQuery('(max-width: 768px)');
 * const isTablet = useMediaQuery('(max-width: 1024px)');
 * 
 * return (
 *   <div className="flex h-screen">
 *     <aside className={cn(
 *       "border-r border-surface-border overflow-y-auto",
 *       isTablet ? "w-20" : "w-64"
 *     )}>
 *       <Sidebar compact={isTablet} />
 *     </aside>
 * 
 *     <main className="flex-1">
 *       {children}
 *     </main>
 * 
 *     {!isMobile && (
 *       <aside className="w-80 border-l border-surface-border">
 *         <ChatPanel {...props} />
 *       </aside>
 *     )}
 * 
 *     {isMobile && (
 *       <ChatPanelModal isOpen={showChat} onClose={() => setShowChat(false)}>
 *         <ChatPanel {...props} />
 *       </ChatPanelModal>
 *     )}
 *   </div>
 * );
 * ```
 * 
 * 
 * ═══════════════════════════════════════════════════════════════════
 * STEP 5: Department Detail View Modal (When Department Selected)
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Add to Sidebar or main layout:
 * 
 * ```typescript
 * import { DepartmentDetailView } from '@/components/department';
 * 
 * const [showDetailView, setShowDetailView] = React.useState(false);
 * const selected = departmentSelectors.getSelected();
 * 
 * return (
 *   <>
 *     {/* ... other components ... */}
 * 
 *     {showDetailView && selected && (
 *       <DepartmentDetailView
 *         department={selected}
 *         onClose={() => setShowDetailView(false)}
 *         onSave={async (updates) => {
 *           await updateDeptAPI(selected.id, updates);
 *         }}
 *         onDelete={async (deptId) => {
 *           await deleteDeptAPI(deptId);
 *         }}
 *         layout="modal"
 *       />
 *     )}
 *   </>
 * );
 * ```
 * 
 * 
 * ═══════════════════════════════════════════════════════════════════
 * STEP 6: Handle Department Change → Filter Chat Channels
 * ═══════════════════════════════════════════════════════════════════
 * 
 * When selectedDepartmentId changes, filter ChatPanel channels:
 * 
 * ```typescript
 * React.useEffect(() => {
 *   const selectedDeptId = departmentStore.selectedDepartmentId;
 *   
 *   if (selectedDeptId) {
 *     // Show department-scoped channel only
 *     const departmentChannel = channels.find(
 *       ch => ch.type === 'department' && ch.departmentId === selectedDeptId
 *     );
 *     if (departmentChannel) {
 *       chatStore.setState({ activeChannelId: departmentChannel.id });
 *     }
 *   } else {
 *     // Show "All Agents" channel when no dept selected
 *     const broadcastChannel = channels.find(ch => ch.type === 'all-agents');
 *     if (broadcastChannel) {
 *       chatStore.setState({ activeChannelId: broadcastChannel.id });
 *     }
 *   }
 * }, [departmentStore.selectedDepartmentId]);
 * ```
 * 
 * 
 * ═══════════════════════════════════════════════════════════════════
 * STEP 7: CSS/Tailwind Responsive Classes
 * ═══════════════════════════════════════════════════════════════════
 * 
 * TenantShell layout classes:
 * - Sidebar: `w-64 lg:w-20` (collapse on large screens if needed)
 * - Main: `flex-1` (grows to fill)
 * - ChatPanel: `w-80 hidden lg:block` (hide on < 1024px)
 * 
 * 
 * ═══════════════════════════════════════════════════════════════════
 * DATA FLOW DIAGRAM
 * ═══════════════════════════════════════════════════════════════════
 * 
 * User selects department in DepartmentTree
 *   ↓
 * setSelected(department) → useDepartmentStore
 *   ↓
 * selectedDepartmentId updated
 *   ↓
 * TenantShell useEffect detects change
 *   ↓
 * Filter ChatPanel.channels by departmentId
 *   ↓
 * Auto-select department channel in ChatPanel
 *   ↓
 * User can now chat in department-scoped channel
 * 
 * 
 * ═══════════════════════════════════════════════════════════════════
 * TYPE SAFETY CHECKLIST
 * ═══════════════════════════════════════════════════════════════════
 * 
 * - [ ] Import Department, DepartmentWithDetails from types
 * - [ ] Import ChatChannel, ChannelMessage from types
 * - [ ] Props properly typed on DepartmentTree, ChatPanel, etc
 * - [ ] useDepartmentStore and useChatStore properly typed
 * - [ ] Callbacks have correct function signatures
 * - [ ] All union types (channel types, statuses) properly handled
 * - [ ] Optional fields properly checked before use
 * - [ ] No 'any' types in new code
 * 
 * 
 * ═══════════════════════════════════════════════════════════════════
 * ACCESSIBILITY CHECKLIST
 * ═══════════════════════════════════════════════════════════════════
 * 
 * - [ ] Keyboard navigation works in DepartmentTree (Arrow keys, Enter)
 * - [ ] Keyboard navigation works in ChatPanel (Tab, Enter, Shift+Enter)
 * - [ ] ARIA labels present on all interactive elements
 * - [ ] Focus visible on all focusable elements
 * - [ ] Color not sole indicator (badges have icons/text)
 * - [ ] Modal focus trap in DepartmentDetailView
 * - [ ] Semantic HTML (buttons, not divs for clicks)
 * - [ ] Form labels properly associated with inputs
 * 
 * 
 * ═══════════════════════════════════════════════════════════════════
 * PERFORMANCE CONSIDERATIONS
 * ═══════════════════════════════════════════════════════════════════
 * 
 * - Lazy load DepartmentDetailView modal only when opened
 * - Virtualize DepartmentTree if >100 departments (use react-window)
 * - Memoize sub-components: DepartmentTreeItem, MessageBubble
 * - Debounce API calls during rapid tree expansion
 * - Persist expanded state in localStorage (done via departmentStore)
 * - Implement message pagination in MessageList (load more on scroll)
 * 
 * 
 * ═══════════════════════════════════════════════════════════════════
 * TESTING STRATEGY
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Unit Tests:
 * - DepartmentTree: expand/collapse toggle, child rendering
 * - MessageList: message rendering, scroll to latest
 * - ChannelSelector: channel switching, grouping
 * - departmentStore: state updates, derived selectors
 * 
 * Integration Tests:
 * - Select department → ChatPanel filters channels
 * - Send message → appears in MessageList with avatar/metrics
 * - Keyboard nav: works end-to-end in tree and chat
 * - Mobile: ChatPanel modal appears/closes correctly
 * 
 * E2E Tests:
 * - User workflow: select dept → open chat → send message
 * - Department detail: open modal → edit → save → close
 * - Responsive: view on desktop, tablet, mobile
 * 
 * 
 * ═══════════════════════════════════════════════════════════════════
 * MIGRATION NOTES (From Phase 0-1)
 * ═══════════════════════════════════════════════════════════════════
 * 
 * ConversationPanel.tsx (old single-channel component):
 * - Superseded by ChatPanel + ChannelSelector (multi-channel)
 * - Can keep for backward compatibility or migrate to ChatPanel
 * - ChatPanel is drop-in replacement with additional features
 * 
 * Sidebar.tsx (old with hardcoded nav):
 * - Update to use DepartmentTree instead of NAV_GROUPS
 * - Sidebar structure remains the same, just swap nav content
 * 
 * Home.tsx / Dashboard / Landing:
 * - No changes needed, works alongside Phase 2-3 components
 * - Optional: show recent departments or channels on home
 */

// This file is for documentation only. Import from component files as needed.
export {};