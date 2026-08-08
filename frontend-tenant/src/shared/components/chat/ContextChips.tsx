// ─── ContextChips.tsx ──────────────────────────────────────────────────────────
// Renders the current typed PageContext as removable chips above the chat
// message list. P1 of the Creatio AI parity plan — explicit context chips so
// users can see and remove the records/files used as grounding. WCAG 2.2 AA:
// each chip's remove button has an aria-label, is keyboard-activable, and
// the chip group is announced as a list via `role="list"`.

'use client';

import { useCallback } from 'react';
import { usePageContext } from '@/shared/contexts/page-context';

export interface AttachedFileChip {
  id: string;
  name: string;
  mimeType?: string;
}

interface ContextChipsProps {
  attachedFiles?: AttachedFileChip[];
  onRemoveAttachedFile?: (id: string) => void;
  activeAgentLabel?: string;
}

interface ChipDescriptor {
  key: string;
  label: string;
  group: 'record' | 'field' | 'locale' | 'agent' | 'file';
  removable: boolean;
  onRemove?: () => void;
}

export function ContextChips({
  attachedFiles,
  onRemoveAttachedFile,
  activeAgentLabel,
}: ContextChipsProps) {
  const { pageContext, setPageContext } = usePageContext();

  const removeRecord = useCallback(() => {
    setPageContext({ recordId: undefined });
  }, [setPageContext]);

  const removeEntityType = useCallback(() => {
    setPageContext({ entityType: undefined, recordId: undefined });
  }, [setPageContext]);

  const removeField = useCallback(
    (field: string) => {
      const next = (pageContext.selectedFields ?? []).filter((f) => f !== field);
      setPageContext({ selectedFields: next });
    },
    [pageContext.selectedFields, setPageContext],
  );

  const chips: ChipDescriptor[] = [];
  if (pageContext.entityType) {
    chips.push({
      key: 'entityType',
      group: 'record',
      label: pageContext.entityType,
      removable: true,
      onRemove: removeEntityType,
    });
  }
  if (pageContext.recordId) {
    const shortId =
      pageContext.recordId.length > 12
        ? `${pageContext.recordId.slice(0, 8)}…`
        : pageContext.recordId;
    chips.push({
      key: 'recordId',
      group: 'record',
      label: `#${shortId}`,
      removable: true,
      onRemove: removeRecord,
    });
  }
  for (const field of pageContext.selectedFields ?? []) {
    chips.push({
      key: `field:${field}`,
      group: 'field',
      label: field,
      removable: true,
      onRemove: () => removeField(field),
    });
  }
  if (activeAgentLabel) {
    chips.push({
      key: 'agent',
      group: 'agent',
      label: activeAgentLabel,
      removable: false,
    });
  }
  chips.push({
    key: 'locale',
    group: 'locale',
    label: pageContext.userLocale,
    removable: false,
  });
  for (const file of attachedFiles ?? []) {
    chips.push({
      key: `file:${file.id}`,
      group: 'file',
      label: file.name,
      removable: true,
      onRemove: onRemoveAttachedFile ? () => onRemoveAttachedFile(file.id) : undefined,
    });
  }

  if (chips.length === 0) return null;

  return (
    <div
      role="list"
      aria-label="Active chat context"
      className="flex flex-wrap gap-1 px-3 pt-2 pb-1 border-b border-surface-border bg-surface-raised/40"
      data-testid="chat-context-chips"
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          role="listitem"
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${chipGroupClass(chip.group)}`}
        >
          <span aria-hidden="true" className="opacity-70">
            {chipGroupIcon(chip.group)}
          </span>
          <span className="truncate max-w-[140px]">{chip.label}</span>
          {chip.removable && chip.onRemove && (
            <button
              type="button"
              onClick={chip.onRemove}
              aria-label={`Remove ${chip.group} ${chip.label} from context`}
              className="ml-0.5 -my-1 rounded-full min-w-6 min-h-6 flex items-center justify-center text-[10px] leading-none hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/40"
            >
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

function chipGroupClass(group: ChipDescriptor['group']): string {
  switch (group) {
    case 'record':
      return 'bg-violet-900/40 text-violet-200 border border-violet-700/40';
    case 'field':
      return 'bg-indigo-900/40 text-indigo-200 border border-indigo-700/40';
    case 'agent':
      return 'bg-emerald-900/40 text-emerald-200 border border-emerald-700/40';
    case 'locale':
      return 'bg-zinc-800 text-zinc-300 border border-zinc-700';
    case 'file':
      return 'bg-amber-900/40 text-amber-200 border border-amber-700/40';
    default:
      return 'bg-zinc-800 text-zinc-300 border border-zinc-700';
  }
}

function chipGroupIcon(group: ChipDescriptor['group']): string {
  switch (group) {
    case 'record':
      return '◉';
    case 'field':
      return '⌗';
    case 'agent':
      return '✦';
    case 'locale':
      return '🌐';
    case 'file':
      return '📎';
    default:
      return '•';
  }
}
