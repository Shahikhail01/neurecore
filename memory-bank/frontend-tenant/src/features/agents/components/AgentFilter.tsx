'use client';
// ─── AgentFilter.tsx ──────────────────────────────────────────────────────────
// SRP: Renders and emits filter changes only — no data fetching.
// OCP: New filter fields added without changing callback API.

import { useId } from 'react';
import type { AgentStatus } from '@/shared/types/domain.types';
import type { Department } from '@/shared/types/domain.types';

export interface AgentFilters {
  search: string;
  status: AgentStatus | '';
  departmentId: string;
}

export const DEFAULT_AGENT_FILTERS: AgentFilters = {
  search: '',
  status: '',
  departmentId: '',
};

interface AgentFilterProps {
  filters: AgentFilters;
  departments?: Department[];
  onChange: (patch: Partial<AgentFilters>) => void;
}

const ALL_STATUSES: { value: AgentStatus | ''; label: string }[] = [
  { value: '',          label: 'All statuses'  },
  { value: 'ACTIVE',   label: 'Active'         },
  { value: 'INACTIVE', label: 'Inactive'       },
  { value: 'PAUSED',   label: 'Paused'         },
  { value: 'TRAINING', label: 'Training'       },
  { value: 'ERROR',    label: 'Error'          },
];

export function AgentFilter({ filters, departments = [], onChange }: AgentFilterProps) {
  const searchId = useId();
  const statusId = useId();
  const deptId   = useId();

  return (
    <div
      role="search"
      aria-label="Agent filters"
      className="flex flex-wrap gap-3 items-center"
    >
      {/* Search */}
      <div className="flex flex-col gap-1">
        <label htmlFor={searchId} className="sr-only">Search agents</label>
        <input
          id={searchId}
          type="search"
          placeholder="Search agents…"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          className="
            h-8 px-3 rounded-lg bg-surface-raised border border-surface-border
            text-sm text-zinc-200 placeholder-zinc-600
            focus:outline-none focus:ring-1 focus:ring-zinc-500
            w-48
          "
        />
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1">
        <label htmlFor={statusId} className="sr-only">Filter by status</label>
        <select
          id={statusId}
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value as AgentStatus | '' })}
          className="
            h-8 px-3 rounded-lg bg-surface-raised border border-surface-border
            text-sm text-zinc-200
            focus:outline-none focus:ring-1 focus:ring-zinc-500
            appearance-none cursor-pointer
          "
        >
          {ALL_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Department */}
      {departments.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor={deptId} className="sr-only">Filter by department</label>
          <select
            id={deptId}
            value={filters.departmentId}
            onChange={(e) => onChange({ departmentId: e.target.value })}
            className="
              h-8 px-3 rounded-lg bg-surface-raised border border-surface-border
              text-sm text-zinc-200
              focus:outline-none focus:ring-1 focus:ring-zinc-500
              appearance-none cursor-pointer
            "
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Clear */}
      {(filters.search || filters.status || filters.departmentId) && (
        <button
          type="button"
          onClick={() => onChange(DEFAULT_AGENT_FILTERS)}
          className="h-8 px-3 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
