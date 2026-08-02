'use client';

/**
 * SkillNode — visual node renderer for the no-code composer.
 * Renders {prompt, read, action, condition, transform, approval,
 * envelope} with typed ports and accessibility metadata.
 */

import { memo } from 'react';
import { Handle, Position } from 'reactflow';

export type SkillComposerNodeKind =
  | 'prompt'
  | 'read'
  | 'action'
  | 'condition'
  | 'transform'
  | 'approval'
  | 'envelope';

export interface SkillComposerPort {
  id: string;
  name: string;
  dataType: 'string' | 'number' | 'boolean' | 'record' | 'list' | 'envelope';
  direction: 'IN' | 'OUT';
  required: boolean;
}

export interface SkillComposerNodeData {
  kind: SkillComposerNodeKind;
  label: string;
  description?: string;
  inputs: SkillComposerPort[];
  outputs: SkillComposerPort[];
  toolKey?: string;
  effect?: 'READ' | 'INTERNAL_WRITE' | 'EXTERNAL_WRITE';
}

const KIND_PALETTE: Record<SkillComposerNodeKind, { accent: string; label: string; description: string }> = {
  prompt: { accent: '#06b6d4', label: 'Prompt', description: 'Captures natural-language input' },
  read: { accent: '#3b82f6', label: 'Read', description: 'Reads a registered record' },
  action: { accent: '#f97316', label: 'Action', description: 'Invokes a registered tool' },
  condition: { accent: '#eab308', label: 'Condition', description: 'Branches on a typed predicate' },
  transform: { accent: '#a855f7', label: 'Transform', description: 'Maps typed ports to typed ports' },
  approval: { accent: '#ef4444', label: 'Approval', description: 'Pauses for human approval' },
  envelope: { accent: '#10b981', label: 'Envelope', description: 'Renders a channel-neutral envelope' },
};

function SkillComposerNode({ data }: { data: SkillComposerNodeData }) {
  const palette = KIND_PALETTE[data.kind];
  const label = data.label || palette.label;
  return (
    <div
      role="group"
      aria-label={`${palette.label} node ${label}`}
      tabIndex={0}
      style={{
        background: '#11131a',
        border: `1px solid ${palette.accent}`,
        borderRadius: 12,
        padding: '12px 14px',
        minWidth: 200,
        maxWidth: 260,
        color: '#e4e4e7',
        fontFamily: 'Inter, sans-serif',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        outlineOffset: 2,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
          gap: 8,
        }}
      >
        <span
          style={{
            background: palette.accent + '22',
            color: palette.accent,
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}
          aria-hidden="true"
        >
          {palette.label}
        </span>
        {data.effect ? (
          <span
            style={{
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 6,
              border: `1px solid ${palette.accent}55`,
              color: palette.accent,
            }}
            aria-label={`effect ${data.effect}`}
          >
            {data.effect}
          </span>
        ) : null}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
      {data.description ? (
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
          {data.description}
        </div>
      ) : null}
      {data.toolKey ? (
        <div
          style={{
            fontSize: 10,
            color: '#9ca3af',
            marginTop: 6,
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          tool: {data.toolKey}
        </div>
      ) : null}
      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {data.inputs.map((p) => (
          <span
            key={p.id}
            style={{
              fontSize: 10,
              padding: '2px 6px',
              border: '1px solid #52525b',
              borderRadius: 6,
              color: '#d4d4d8',
            }}
            aria-label={`input ${p.name}, ${p.dataType}${p.required ? ', required' : ''}`}
          >
            in: {p.name}
            {p.required ? ' *' : ''}
          </span>
        ))}
        {data.outputs.map((p) => (
          <span
            key={p.id}
            style={{
              fontSize: 10,
              padding: '2px 6px',
              border: '1px dashed #52525b',
              borderRadius: 6,
              color: '#a1a1aa',
            }}
            aria-label={`output ${p.name}, ${p.dataType}`}
          >
            out: {p.name}
          </span>
        ))}
      </div>
      {data.inputs.map((p, idx) => (
        <Handle
          key={`in-${p.id}`}
          id={`in-${p.id}`}
          type="target"
          position={Position.Left}
          style={{
            background: palette.accent,
            top: `${30 + idx * 14}px`,
            width: 10,
            height: 10,
          }}
          aria-label={`input handle ${p.name}`}
        />
      ))}
      {data.outputs.map((p, idx) => (
        <Handle
          key={`out-${p.id}`}
          id={`out-${p.id}`}
          type="source"
          position={Position.Right}
          style={{
            background: palette.accent,
            top: `${30 + idx * 14}px`,
            width: 10,
            height: 10,
          }}
          aria-label={`output handle ${p.name}`}
        />
      ))}
    </div>
  );
}

export default memo(SkillComposerNode);
