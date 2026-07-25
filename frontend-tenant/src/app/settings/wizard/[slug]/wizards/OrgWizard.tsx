'use client';

import { useState, useEffect } from 'react';
import { WizardShell } from '@/components/wizard/WizardShell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { useOnboardingChecklistStore } from '@/stores/onboardingChecklist.store';
import { useDepartmentStore } from '@/stores/departmentStore';
import meService from '@/services/me.service';
import type { WizardSlug } from '@/lib/wizard/types';

export function OrgWizard({ slug }: { slug: WizardSlug }) {
  const [primaryDept, setPrimaryDept] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storeComplete = useOnboardingChecklistStore((s) => s.complete);
  const departments = useDepartmentStore((s) => s.departments);
  const storeLoading = useDepartmentStore((s) => s.loading);
  const fetchDepartments = useDepartmentStore((s) => s.fetchDepartments);

  // Load departments + current profile
  useEffect(() => {
    if (departments.length === 0 && !storeLoading) void fetchDepartments();
  }, [departments.length, fetchDepartments, storeLoading]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profile = await meService.profile.get();
        if (cancelled || !profile) return;
        if (profile.primaryDepartmentId) setPrimaryDept(profile.primaryDepartmentId);
      } catch {
        // best-effort hydration
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await meService.profile.update({
        primaryDepartmentId: primaryDept || null,
      });
      await storeComplete(slug);
      setCompleted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (completed) {
    return (
      <WizardShell title="Org Placement">
        <div className="text-center space-y-3 py-4">
          <CheckCircle2 className="w-10 h-10 mx-auto text-[color:var(--state-success)]" />
          <p className="text-sm text-muted-foreground">Org placement saved.</p>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell title="Org Placement" description="Primary department for you, per-agent department overrides.">
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="dept">Your primary department</Label>
              <Select value={primaryDept} onValueChange={setPrimaryDept}>
                <SelectTrigger id="dept">
                  <SelectValue placeholder={departments.length === 0 ? 'No departments yet' : 'Select department'} />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(departments) && departments.map((d: { id: string; name: string }) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {departments.length === 0 && (
                <p className="text-xs text-muted-foreground">No departments found. Create one from the Departments page first.</p>
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save & complete
              </Button>
            </div>
          </>
        )}
      </div>
    </WizardShell>
  );
}
