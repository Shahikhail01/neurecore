'use client';

import { Plus, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface CustomerFieldDefinition {
  key: string;
  label: string;
  type: string;
  options?: string[];
}

interface CustomerFieldEditorProps {
  value: CustomerFieldDefinition[];
  onChange: (fields: CustomerFieldDefinition[]) => void;
}

export function CustomerFieldEditor({
  value,
  onChange,
}: CustomerFieldEditorProps) {
  const addField = () => {
    onChange([
      ...value,
      { key: '', label: '', type: 'text' },
    ]);
  };

  const removeField = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateField = (
    index: number,
    field: keyof CustomerFieldDefinition,
    val: string | string[],
  ) => {
    const updated = value.map((f, i) =>
      i === index ? { ...f, [field]: val } : f,
    );
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Customer Field Definitions</Label>
        <Button type="button" variant="outline" size="sm" onClick={addField}>
          <Plus className="w-3.5 h-3.5" />
          <span className="ml-1">Add Field</span>
        </Button>
      </div>

      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No custom fields defined. Add fields like client type, risk tier, KYC status, etc.
        </p>
      )}

      <div className="space-y-2">
        {value.map((field, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <Input
              value={field.key}
              onChange={(e) => updateField(i, 'key', e.target.value)}
              placeholder="Field key"
              className="w-32"
            />
            <Input
              value={field.label}
              onChange={(e) => updateField(i, 'label', e.target.value)}
              placeholder="Display label"
              className="flex-1 min-w-[120px]"
            />
            <select
              aria-label="Field type"
              value={field.type}
              onChange={(e) => updateField(i, 'type', e.target.value)}
              className="w-28 rounded-md border border-input bg-background px-2 py-2 text-sm"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="enum">Enum</option>
              <option value="date">Date</option>
              <option value="encrypted">Encrypted</option>
              <option value="boolean">Boolean</option>
            </select>
            {field.type === 'enum' && (
              <Input
                value={(field.options ?? []).join(', ')}
                onChange={(e) =>
                  updateField(
                    i,
                    'options',
                    e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  )
                }
                placeholder="Option1, Option2"
                className="w-48"
              />
            )}
            <button
              onClick={() => removeField(i)}
              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
