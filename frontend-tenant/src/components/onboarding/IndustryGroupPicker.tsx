'use client';

/**
 * IndustryGroupPicker — INDUSTRY-GROUPS-CONCEPT.md §6.4
 *
 * Single expandable list, click Group → expand → click Industry inside → select.
 * No sub-industry step. Optional at the API level.
 *
 * Behaviour:
 *   - Click Group header → accordion expands that group, collapses others
 *   - Click Industry → selects it and shows sub-industry bullets below
 *   - Search input filters Groups first, then Industries inside matching Groups
 *   - Selection persists via onChange callback
 */

import { useState, useMemo } from 'react';
import { ChevronRight, Search, Check } from 'lucide-react';
import { GlassPanel } from '@neurecore/ui-visual';
import {
  INDUSTRY_GROUPS,
  INDUSTRY_GROUP_INDUSTRIES,
  type IndustryGroupSlug,
} from '@/lib/industryGroups';

export interface IndustryOption {
  slug: string;
  name: string;
  icon: string | null;
  industryGroup: string | null;
  groupSortOrder: number | null;
}

export interface IndustryGroupPickerProps {
  industries: IndustryOption[];
  value: string;
  onChange: (slug: string) => void;
  /** Show sub-industry description text below the picker. Default true. */
  showSubIndustries?: boolean;
}

export function IndustryGroupPicker({
  industries,
  value,
  onChange,
  showSubIndustries = true,
}: IndustryGroupPickerProps) {
  const [openGroup, setOpenGroup] = useState<IndustryGroupSlug | null>(
    (industries.find((i) => i.slug === value)?.industryGroup as IndustryGroupSlug | null) ?? null,
  );
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const map = new Map<IndustryGroupSlug, IndustryOption[]>();
    for (const ind of industries) {
      if (!ind.industryGroup) continue;
      const g = ind.industryGroup as IndustryGroupSlug;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(ind);
    }
    return map;
  }, [industries]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return INDUSTRY_GROUPS;
    const q = search.toLowerCase();
    return INDUSTRY_GROUPS.filter(
      (g) =>
        g.label.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        (mapGet(grouped, g.slug) ?? []).some(
          (i) => i.slug.toLowerCase().includes(q) || i.name.toLowerCase().includes(q),
        ),
    );
  }, [search, grouped]);

  const selectedIndustry = industries.find((i) => i.slug === value);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          aria-label="Search industries"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search industries…"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <GlassPanel variant="panel" padding="none" className="overflow-hidden divide-y divide-white/10">
        {filteredGroups.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-zinc-400">
            No industries match "{search}"
          </div>
        )}
        {filteredGroups.map((group) => {
          const items = mapGet(grouped, group.slug) ?? [];
          const isOpen = openGroup === group.slug;
          return (
            <div key={group.slug}>
              <button
                type="button"
                onClick={() => setOpenGroup(isOpen ? null : group.slug)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-white/5 transition"
              >
                <div>
                  <div className="text-sm font-medium text-zinc-100">{group.label}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {group.description} · {items.length} {items.length === 1 ? 'industry' : 'industries'}
                  </div>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-zinc-500 transition-transform ${
                    isOpen ? 'rotate-90' : ''
                  }`}
                />
              </button>
              {isOpen && items.length > 0 && (
                <div className="bg-white/5 px-2 py-2 space-y-1">
                  {items.map((ind) => {
                    const isSelected = value === ind.slug;
                    return (
                      <button
                        key={ind.slug}
                        type="button"
                        onClick={() => onChange(ind.slug)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-left transition ${
                          isSelected
                            ? 'bg-[color:var(--accent-500)]/15 text-[color:var(--accent-400)] ring-1 ring-[color:var(--accent-500)]/30'
                            : 'hover:bg-white/10 text-zinc-100'
                        }`}
                      >
                        <span className="text-sm">{ind.name}</span>
                        {isSelected && <Check className="w-4 h-4" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </GlassPanel>

      {showSubIndustries && selectedIndustry && (
        <p className="text-xs text-muted-foreground">
          Contact your platform administrator if your industry needs to change.
        </p>
      )}
    </div>
  );
}

function mapGet<K, V>(m: Map<K, V>, k: K): V | undefined {
  return m.get(k);
}

/** Lightweight hook to fetch industries + groups together. */
export function useIndustryGroups() {
  return { INDUSTRY_GROUPS, INDUSTRY_GROUP_INDUSTRIES };
}
