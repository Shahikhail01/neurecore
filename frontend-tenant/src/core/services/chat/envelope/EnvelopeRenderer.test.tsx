import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { EnvelopeRenderer } from './EnvelopeRenderer';
import type { EnvelopeComponent } from './interfaces/IEnvelopeParser';

describe('EnvelopeRenderer', () => {
  it('renders null when components is empty', () => {
    const { container } = render(<EnvelopeRenderer components={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a metrics component', () => {
    const components: EnvelopeComponent[] = [
      {
        type: 'metrics',
        props: { items: [{ label: 'A', value: 1 }] },
      },
    ];
    const { getByText } = render(<EnvelopeRenderer components={components} />);
    expect(getByText('A:')).toBeDefined();
  });

  it('renders a table component', () => {
    const components: EnvelopeComponent[] = [
      {
        type: 'table',
        props: {
          headers: ['id', 'name'],
          rows: [{ id: 'p1', name: 'Acme' }],
        },
      },
    ];
    const { getByText } = render(<EnvelopeRenderer components={components} />);
    expect(getByText('id')).toBeDefined();
    expect(getByText('Acme')).toBeDefined();
  });

  it('renders a chart component', () => {
    const components: EnvelopeComponent[] = [
      {
        type: 'chart',
        props: { chartData: [{ label: 'X', value: 10 }] },
      },
    ];
    const { container } = render(<EnvelopeRenderer components={components} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('skips unknown component types gracefully', () => {
    // EnvelopeParser rejects unknown types at validation, but the renderer
    // must still be safe if a hand-crafted envelope slips through.
    const components = [
      { type: 'unknown' as unknown as 'chart', props: {} },
    ] as EnvelopeComponent[];
    const { container } = render(<EnvelopeRenderer components={components} />);
    expect(container.firstChild).toBeNull();
  });
});
