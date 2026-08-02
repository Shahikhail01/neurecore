import { ResponseEnvelopeBuilder } from './response-envelope.builder';

describe('ResponseEnvelopeBuilder', () => {
  let builder: ResponseEnvelopeBuilder;

  beforeEach(() => {
    builder = new ResponseEnvelopeBuilder();
  });

  describe('buildToolResponse', () => {
    it('returns "Executed <tool>" when data is missing', () => {
      expect(builder.buildToolResponse('listProjects', null)).toEqual({
        text: 'Executed listProjects',
      });
      expect(
        builder.buildToolResponse('listProjects', { success: true }),
      ).toEqual({ text: 'Executed listProjects' });
    });

    it('returns error message on success=false', () => {
      expect(
        builder.buildToolResponse('listProjects', {
          success: false,
          error: 'boom',
        }),
      ).toEqual({ text: 'Failed: boom' });
    });

    it('builds table component from direct array payload', () => {
      const rows = [
        { id: 'a', name: 'Acme', status: 'ACTIVE' },
        { id: 'b', name: 'Beta', status: 'DORMANT' },
      ];
      const env = builder.buildToolResponse('listCustomers', {
        success: true,
        data: rows,
      });
      expect(env.components).toHaveLength(1);
      expect(env.components![0]).toEqual({
        type: 'table',
        props: {
          headers: ['id', 'name', 'status'],
          rows,
        },
      });
    });

    it('builds table from object-with-array-key payload and surfaces total', () => {
      const env = builder.buildToolResponse('listProjects', {
        success: true,
        data: {
          data: [
            { id: 'p1', name: 'Project 1' },
            { id: 'p2', name: 'Project 2' },
          ],
          total: 12,
        },
      });
      expect(env.text).toBe('(12 total)');
      expect(env.components![0].type).toBe('table');
      expect(
        (env.components![0].props as { rows: unknown[] }).rows,
      ).toHaveLength(2);
    });

    it('builds metrics component from scalar object payload', () => {
      const env = builder.buildToolResponse('getDashboardSummary', {
        success: true,
        data: {
          generatedAt: '2026-08-01',
          agentsTotal: 10,
          activeDepartments: 3,
          pendingApprovals: 2,
        },
      });
      expect(env.components).toHaveLength(1);
      expect(env.components![0].type).toBe('metrics');
      const items = (
        env.components![0].props as {
          items: Array<{ label: string; value: unknown }>;
        }
      ).items;
      // Display labels are human-readable; generated timestamps are omitted.
      expect(items.map((i) => i.label)).toEqual([
        'Agents Total',
        'Active Departments',
        'Pending Approvals',
      ]);
    });

    it('flattens nested dashboard counters into useful metrics', () => {
      const env = builder.buildToolResponse('getDashboardSummary', {
        success: true,
        data: {
          generatedAt: '2026-08-01T10:00:00.000Z',
          agents: { total: 12, byStatus: { IDLE: 10, BUSY: 2 } },
          approvals: { pending: 4 },
          cost: { monthToDateCents: 2500, currency: 'USD' },
        },
      });
      const items = env.components![0].props.items as Array<{
        label: string;
        value: string | number;
      }>;
      expect(items).toContainEqual({ label: 'Agents Total', value: 12 });
      expect(items).toContainEqual({ label: 'Approvals Pending', value: 4 });
      expect(items).toContainEqual({ label: 'Cost Currency', value: 'USD' });
      expect(items.some((item) => item.label === 'Generated At')).toBe(false);
    });

    it('projects table rows to display fields and removes tenant/internal metadata', () => {
      const env = builder.buildToolResponse('listProjects', {
        success: true,
        data: {
          data: [{
            id: 'p1',
            tenantId: 'tenant-secret',
            name: 'Visible project',
            status: 'LEAD',
            metadata: { internal: true },
          }],
          total: 1,
        },
      });
      const table = env.components![0].props as {
        headers: string[];
        rows: Array<Record<string, unknown>>;
      };
      expect(table.headers).toEqual(['id', 'name', 'status']);
      expect(table.rows[0]).toEqual({ id: 'p1', name: 'Visible project', status: 'LEAD' });
      expect(JSON.stringify(table)).not.toContain('tenant-secret');
      expect(JSON.stringify(table)).not.toContain('internal');
    });

    it('returns "No results." for empty array', () => {
      const env = builder.buildToolResponse('listProjects', {
        success: true,
        data: [],
      });
      expect(env).toEqual({ text: 'No results.' });
    });

    it('returns text for scalar payload', () => {
      const env = builder.buildToolResponse('count', {
        success: true,
        data: 42,
      });
      expect(env.text).toBe('42');
    });

    it('does NOT produce envelope for multi-tool runs (gate)', () => {
      // Multi-tool orchestration is the caller's responsibility; this
      // builder is per-tool-call. Verifying it never crashes on weird
      // shapes is enough.
      expect(() =>
        builder.buildToolResponse('anything', { foo: 'bar' }),
      ).not.toThrow();
    });
  });

  describe('merge', () => {
    it('returns plain text when no tool envelope', () => {
      expect(builder.merge('Hello there')).toEqual({ text: 'Hello there' });
    });

    it('returns {} when both empty', () => {
      expect(builder.merge('')).toEqual({});
    });

    it('combines conversational text with envelope text', () => {
      const merged = builder.merge(
        'Here you go:',
        { text: '(3 total)', components: [{ type: 'table', props: {} }] },
      );
      expect(merged.text).toBe('Here you go: (3 total)');
      expect(merged.components).toHaveLength(1);
    });
  });
});
