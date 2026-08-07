// ─── railPreferencesStore ────────────────────────────────────────────────────
// Persistence for which sections + items the user wants visible in the
// canonical IconRail (left navigation). The defaults match the canonical
// 19-link rail defined in components/layout/IconRail.tsx — see the
// RAIL_SECTIONS export there for the canonical id list.
//
// Shape:
//   hiddenSections: Set<SectionId>          — sections that are toggled off
//   hiddenItems:    Set<ItemId>             — individual items hidden
//                                             (a hidden item stays hidden even
//                                             if its parent section is visible)
//
// Visible = (item is not in hiddenItems) AND (parent section is not in
// hiddenSections). This dual-level toggle gives the user both a fast
// "hide the whole Workspace section" switch and a fine-grained
// "hide just Workflows" knob.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SectionId =
    | 'home'
    | 'workspace'
    | 'marketplace'
    | 'sales'
    | 'service-desk'
    | 'finance'
    | 'intelligence';

export type ItemId =
    | 'home'
    | 'departments'
    | 'org-chart'
    | 'tasks'
    | 'workflows'
    | 'routines'
    | 'goals'
    | 'projects'
    | 'customers'
    | 'marketplace'
    | 'agents'
    | 'connectors'
    | 'ai-skills'
    | 'service-desk'
    | 'inbox'
    | 'approvals'
    | 'activity'
    | 'finance'
    | 'intelligence'
    | 'settings'
    | 'engagements' | 'loans' | 'portfolios' | 'audits' | 'tax' | 'payroll' | 'compliance' | 'risk'
    | 'appointments' | 'medical-records' | 'pharmacy' | 'laboratory'
    | 'programs' | 'grants' | 'field-operations' | 'cases' | 'licenses' | 'inspections'
    | 'tickets' | 'releases' | 'contracts' | 'knowledge'
    | 'sites' | 'production' | 'work-orders' | 'equipment' | 'shipments' | 'fleet' | 'warehouses'
    | 'products' | 'orders' | 'inventory' | 'stores' | 'promotions' | 'campaigns' | 'content'
    | 'farms' | 'fields' | 'livestock'
    | 'operations' | 'assets' | 'documents' | 'custom'
    // Phase 10.6 — tenant sales domain surfaces (R1-BACKLOG).
    | 'deals' | 'leads' | 'opportunities' | 'quotes' | 'emails';

interface RailPreferencesState {
    hiddenSections: SectionId[];
    hiddenItems: ItemId[];
    /** Persisted "expanded section" preferences (per-section collapse state). */
    collapsedSections: SectionId[];

    // Actions
    toggleSection: (id: SectionId) => void;
    toggleItem: (id: ItemId) => void;
    toggleSectionCollapsed: (id: SectionId) => void;
    reset: () => void;
}

const DEFAULTS = {
    hiddenSections: [] as SectionId[],
    hiddenItems: [] as ItemId[],
    collapsedSections: [] as SectionId[],
};

export const useRailPreferencesStore = create<RailPreferencesState>()(
    persist(
        (set) => ({
            ...DEFAULTS,

            toggleSection: (id) =>
                set((s) => ({
                    hiddenSections: s.hiddenSections.includes(id)
                        ? s.hiddenSections.filter((x) => x !== id)
                        : [...s.hiddenSections, id],
                })),

            toggleItem: (id) =>
                set((s) => ({
                    hiddenItems: s.hiddenItems.includes(id)
                        ? s.hiddenItems.filter((x) => x !== id)
                        : [...s.hiddenItems, id],
                })),

            toggleSectionCollapsed: (id) =>
                set((s) => ({
                    collapsedSections: s.collapsedSections.includes(id)
                        ? s.collapsedSections.filter((x) => x !== id)
                        : [...s.collapsedSections, id],
                })),

            reset: () => set({ ...DEFAULTS }),
        }),
        {
            name: 'neurecore-rail-preferences',
            version: 1,
            merge: (persistedState, currentState) => {
                const ps = (persistedState ?? {}) as Partial<RailPreferencesState>;
                const sanitisedSections = Array.isArray(ps.hiddenSections)
                    ? ps.hiddenSections.filter((x): x is SectionId =>
                          typeof x === 'string' &&
                          ['home', 'workspace', 'marketplace', 'sales', 'service-desk', 'finance', 'intelligence'].includes(x),
                      )
                    : currentState.hiddenSections;
                const validItems: ItemId[] = [
                    'home', 'departments', 'org-chart', 'tasks', 'workflows', 'routines', 'goals', 'projects',
                    'customers', 'marketplace', 'agents', 'connectors', 'ai-skills',
                    'service-desk', 'inbox', 'approvals', 'activity',
                    'finance', 'intelligence', 'settings',
                    'engagements', 'loans', 'portfolios', 'audits', 'tax', 'payroll', 'compliance', 'risk',
                    'appointments', 'medical-records', 'pharmacy', 'laboratory',
                    'programs', 'grants', 'field-operations', 'cases', 'licenses', 'inspections',
                    'tickets', 'releases', 'contracts', 'knowledge',
                    'sites', 'production', 'work-orders', 'equipment', 'shipments', 'fleet', 'warehouses',
                    'products', 'orders', 'inventory', 'stores', 'promotions', 'campaigns', 'content',
                    'farms', 'fields', 'livestock',
                    'operations', 'assets', 'documents', 'custom',
                    // Phase 10.6 R1 — Sales domain surfaces.
                    'deals', 'leads', 'opportunities', 'quotes', 'emails',
                ];
                const sanitisedItems = Array.isArray(ps.hiddenItems)
                    ? ps.hiddenItems.filter((x): x is ItemId => typeof x === 'string' && validItems.includes(x as ItemId))
                    : currentState.hiddenItems;
                const sanitisedCollapsed = Array.isArray(ps.collapsedSections)
                    ? ps.collapsedSections.filter((x): x is SectionId =>
                          typeof x === 'string' &&
                          ['home', 'workspace', 'marketplace', 'service-desk', 'finance', 'intelligence'].includes(x),
                      )
                    : currentState.collapsedSections;
                return {
                    ...currentState,
                    ...ps,
                    hiddenSections: sanitisedSections,
                    hiddenItems: sanitisedItems,
                    collapsedSections: sanitisedCollapsed,
                };
            },
        },
    ),
);