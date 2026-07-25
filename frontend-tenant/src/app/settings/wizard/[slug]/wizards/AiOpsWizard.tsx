'use client';

import { useState } from 'react';
import { WizardShell } from '@/components/wizard/WizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { tenantsService } from '@/services/tenants.service';
import { useOnboardingChecklistStore } from '@/stores/onboardingChecklist.store';
import type { WizardSlug } from '@/lib/wizard/types';

export function AiOpsWizard({ slug }: { slug: WizardSlug }) {
  const [provider, setProvider] = useState('auto');
  const [model, setModel] = useState('auto');
  const [perAgentBudget, setPerAgentBudget] = useState(10);
  const [authorityLevel, setAuthorityLevel] = useState('suggest');
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storeComplete = useOnboardingChecklistStore((s) => s.complete);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await tenantsService.updateMine({
        defaultsJson: { aiProvider: provider, aiModel: model, perAgentBudget, authorityLevel },
      } as Record<string, unknown>);
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
      <WizardShell title="AI & Operations">
        <div className="text-center space-y-3 py-4">
          <CheckCircle2 className="w-10 h-10 mx-auto text-[color:var(--state-success)]" />
          <p className="text-sm text-muted-foreground">AI settings saved.</p>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell title="AI & Operations" description="Default AI provider, model, per-agent budget, authority level.">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Default AI provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="provider"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (best available)</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="model">Default model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="model"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (best for task)</SelectItem>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
                <SelectItem value="deepseek-chat">DeepSeek Chat</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="budget">Per-agent monthly budget ($)</Label>
          <Select value={String(perAgentBudget)} onValueChange={(v) => setPerAgentBudget(Number(v))}>
            <SelectTrigger id="budget"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">$0 (unlimited)</SelectItem>
              <SelectItem value="5">$5</SelectItem>
              <SelectItem value="10">$10</SelectItem>
              <SelectItem value="20">$20</SelectItem>
              <SelectItem value="50">$50</SelectItem>
              <SelectItem value="100">$100</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Limits total AI spend per agent per month. 0 = unlimited.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="authority">Authority level</Label>
          <Select value={authorityLevel} onValueChange={setAuthorityLevel}>
            <SelectTrigger id="authority"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="suggest">Suggest only</SelectItem>
              <SelectItem value="auto-routine">Auto-approve routine tasks</SelectItem>
              <SelectItem value="auto-all">Full autonomy</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save & complete
          </Button>
        </div>
      </div>
    </WizardShell>
  );
}
