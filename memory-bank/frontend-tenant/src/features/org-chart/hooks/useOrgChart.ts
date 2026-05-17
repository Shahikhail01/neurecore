'use client';
// ─── useOrgChart.ts ───────────────────────────────────────────────────────────
// SRP: Org chart data orchestration — fetch, tree build, search, DnD state.
// DIP: Depends on repository abstractions via stores.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDepartmentStore } from '@/stores/departmentStore';
import { useAgentStore }      from '@/stores/agentStore';
import type { Department, Agent } from '@/shared/types/domain.types';

export interface OrgNode {
  type:       'department' | 'agent';
  id:         string;
  name:       string;
  /** For agents: their department id */
  parentId?:  string;
  status?:    string;
  mood?:      string;
  avatarUrl?: string;
  workloadGauge?: number;
  /** Computed children (agents under this dept) */
  children?:  OrgNode[];
  /** Raw source */
  _dept?: Department;
  _agent?: Agent;
}

interface UseOrgChartReturn {
  tree:         OrgNode[];
  filteredTree: OrgNode[];
  query:        string;
  selectedId:   string | null;
  draggingId:   string | null;
  isLoading:    boolean;
  setQuery:     (q: string) => void;
  select:       (id: string | null) => void;
  setDragging:  (id: string | null) => void;
  /** Move agent to a new department */
  moveAgent:    (agentId: string, toDeptId: string) => void;
  expandedDepts: Set<string>;
  toggleDept:   (id: string) => void;
}

function buildTree(departments: Department[], agents: Agent[]): OrgNode[] {
  return departments.map((dept): OrgNode => ({
    type:     'department',
    id:       dept.id,
    name:     dept.name,
    _dept:    dept,
    children: agents
      .filter((a) => a.departmentId === dept.id)
      .map((a): OrgNode => ({
        type:         'agent',
        id:           a.id,
        name:         a.name,
        parentId:     dept.id,
        status:       a.status,
        mood:         a.mood,
        avatarUrl:    a.avatarUrl,
        workloadGauge: a.workloadGauge,
        _agent:       a,
      })),
  }));
}

function nodeMatchesQuery(node: OrgNode, q: string): boolean {
  const lower = q.toLowerCase();
  return (
    node.name.toLowerCase().includes(lower) ||
    (node._agent?.type?.toLowerCase().includes(lower) ?? false) ||
    (node._dept?.description?.toLowerCase().includes(lower) ?? false)
  );
}

function filterTree(tree: OrgNode[], q: string): OrgNode[] {
  if (!q.trim()) return tree;
  return tree
    .map((dept) => ({
      ...dept,
      children: dept.children?.filter((child) => nodeMatchesQuery(child, q)),
    }))
    .filter((dept) => nodeMatchesQuery(dept, q) || (dept.children?.length ?? 0) > 0);
}

export function useOrgChart(): UseOrgChartReturn {
  const {
    departments,
    loading: deptLoading,
    fetchDepartments,
  } = useDepartmentStore();

  const {
    agents,
    loading: agentLoading,
    fetchAgents,
  } = useAgentStore();

  const [query, setQuery]           = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, _setDragging]  = useState<string | null>(null);
  const [expandedDepts, setExpanded] = useState<Set<string>>(new Set());
  // Local agent positions (overrides until next fetch)
  const [overrides, setOverrides]   = useState<Record<string, string>>({});

  useEffect(() => {
    fetchDepartments();
    fetchAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agentsWithOverrides = useMemo(
    () => agents.map((a) => overrides[a.id] ? { ...a, departmentId: overrides[a.id] } : a),
    [agents, overrides],
  );

  const tree = useMemo(
    () => buildTree(departments, agentsWithOverrides),
    [departments, agentsWithOverrides],
  );

  const filteredTree = useMemo(
    () => filterTree(tree, query),
    [tree, query],
  );

  const toggleDept = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const moveAgent = useCallback((agentId: string, toDeptId: string) => {
    setOverrides((prev) => ({ ...prev, [agentId]: toDeptId }));
    // Expand target dept
    setExpanded((prev) => new Set([...prev, toDeptId]));
  }, []);

  return {
    tree,
    filteredTree,
    query,
    selectedId,
    draggingId,
    isLoading: deptLoading || agentLoading,
    setQuery,
    select: setSelectedId,
    setDragging: _setDragging,
    moveAgent,
    expandedDepts,
    toggleDept,
  };
}
