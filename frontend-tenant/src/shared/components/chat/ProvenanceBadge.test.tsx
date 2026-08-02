// Tests for the ProvenanceBadge component.

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProvenanceBadge, type Citation } from '@/shared/components/chat/ProvenanceBadge';

describe('ProvenanceBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('labels the source of the answer', () => {
    render(<ProvenanceBadge source="knowledge" confidence={0.83} excerptHash="abcdef1234567890" />);
    expect(screen.getByLabelText(/Answer provenance: Knowledge base/)).toBeInTheDocument();
    expect(screen.getByText('83% confidence')).toBeInTheDocument();
    expect(screen.getByText('#abcdef12')).toBeInTheDocument();
  });

  it('renders citations as clickable, accessible buttons when href is provided', () => {
    const citations: Citation[] = [
      { id: '1', label: 'Project charter', source: 'record', href: '/projects/123' },
    ];
    const onClick = vi.fn();
    render(
      <ProvenanceBadge source="record" citations={citations} onCitationClick={onClick} />,
    );
    const button = screen.getByLabelText('Re-open Project charter');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledWith(citations[0]);
  });

  it('renders citation labels as plain text when no href is supplied', () => {
    render(
      <ProvenanceBadge
        source="generated"
        citations={[{ id: '1', label: 'Model answer', source: 'generated' }]}
      />,
    );
    expect(screen.getByText('Model answer')).toBeInTheDocument();
  });
});
