'use client';

/**
 * /marketplace/composer — no-code skill composer (Phase 6 P6).
 *
 * Server-rendered shell renders the visual canvas + NL draft panel +
 * simulation panel. Access is restricted to ADMIN/OWNER roles via
 * the canonical tenant-side RolesGuard — the UI surfaces a friendly
 * empty state when the role is not eligible.
 */

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import TenantShell from '@/components/TenantShell';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import { PageShell, PageHero } from '@neurecore/ui-visual';
import { Sparkles, ShieldAlert } from 'lucide-react';
import NlDraftPanel from './components/NlDraftPanel';
import SimulationPanel from './components/SimulationPanel';
import type { Edge, Node } from 'reactflow';
import type { SkillComposerNodeData } from './components/SkillNode';

const SkillCanvas = dynamic(() => import('./components/SkillCanvas'), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        minHeight: 480,
        background: '#0a0b0f',
        color: '#a1a1aa',
        borderRadius: 12,
        border: '1px solid #27272a',
      }}
    >
      Loading composer…
    </div>
  ),
});

const ADMIN_ROLES = new Set(['OWNER', 'ADMIN', 'SUPER_ADMIN', 'PLATFORM_ADMIN']);

export default function ComposerPage() {
  const user = useTenantAuth();
  const [nodes, setNodes] = useState<Node<SkillComposerNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const handleGraphChange = useCallback(
    (graph: { nodes: Node<SkillComposerNodeData>[]; edges: Edge[] }) => {
      setNodes(graph.nodes);
      setEdges(graph.edges);
    },
    [],
  );

  if (!user) return null;
  const eligible = ADMIN_ROLES.has(user.role);
  return (
    <TenantShell user={user}>
      <PageShell variant="default">
        <PageHero
          eyebrow="Phase 6 — No-code Composer"
          title="Skill Composer"
          subtitle="Compose certified no-code skill graphs for your agents. Validate, simulate, draft with natural language."
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 1fr)',
            gap: 16,
            maxWidth: 1440,
            margin: '0 auto',
          }}
        >
          <div
            role="region"
            aria-label="Composer canvas area"
            style={{
              height: 640,
              background: '#0a0b0f',
              borderRadius: 14,
              border: '1px solid #1f1f24',
              overflow: 'hidden',
            }}
          >
            {eligible ? (
              <SkillCanvas
                onGraphChange={handleGraphChange}
              />
            ) : (
              <UnauthorizedState />
            )}
          </div>
          <aside
            aria-label="Composer side panels"
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <NlDraftPanel />
            <SimulationPanel nodes={nodes} edges={edges} />
            <section
              aria-label="Composer info"
              style={{
                background: 'rgba(17,19,26,0.92)',
                border: '1px solid #27272a',
                borderRadius: 12,
                padding: 12,
                color: '#a1a1aa',
                fontSize: 11,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 6,
                  color: '#e4e4e7',
                }}
              >
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                <span style={{ fontWeight: 600 }}>No-code trust boundary</span>
              </div>
              <p>
                Generated designs cannot contain arbitrary code, SQL,
                shell, raw secrets, or unregistered HTTP calls.
                Validation, simulation, and certification are governed by
                the canonical skill-engine.
              </p>
            </section>
          </aside>
        </div>
      </PageShell>
    </TenantShell>
  );
}

function UnauthorizedState() {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 10,
        color: '#a1a1aa',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <ShieldAlert className="w-8 h-8 text-state-warning" aria-hidden="true" />
      <h3 style={{ color: '#e4e4e7', fontSize: 16 }}>Composer is tenant-admin only</h3>
      <p style={{ fontSize: 12, maxWidth: 360 }}>
        Ask a tenant admin to grant OWNER or ADMIN access to use the
        no-code composer. The composer enforces role checks server-side
        as well.
      </p>
    </div>
  );
}
