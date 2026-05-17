'use client';

import { useEffect, useState } from 'react';
import { delegationService, type Department } from '@/services/delegation.service';
import type { DelegationFormData } from '@/types/delegation.types';

interface Props {
  form: DelegationFormData;
  patch: (u: Partial<DelegationFormData>) => void;
}

export function StepDepartment({ form, patch }: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    delegationService.listDepartments().then((d) => {
      setDepartments(d);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-surface-overlay animate-pulse" />
        ))}
      </div>
    );
  }

  if (!departments.length) {
    return (
      <p className="text-sm text-zinc-500 text-center py-8">
        No departments found. Create one in Settings first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {departments.map((dept) => {
        const selected = form.departmentId === dept.id;
        return (
          <button
            key={dept.id}
            onClick={() => patch({ departmentId: dept.id, departmentName: dept.name })}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition ${
              selected
                ? 'border-violet-500 bg-violet-500/10 text-violet-200'
                : 'border-surface-border text-zinc-300 hover:border-zinc-600 hover:bg-surface-overlay'
            }`}
          >
            <span className="font-medium">{dept.name}</span>
            <span className="text-xs text-zinc-500">{dept.agentCount} agents</span>
          </button>
        );
      })}
    </div>
  );
}
