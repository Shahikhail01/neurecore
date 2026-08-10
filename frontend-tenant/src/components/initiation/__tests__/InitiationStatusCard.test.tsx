import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('@/components/timeline/UnifiedTimeline', () => ({
  UnifiedTimeline: ({
    entityType,
    entityId,
  }: {
    entityType: string;
    entityId: string;
  }) => (
    <div data-testid="timeline-mock">
      {entityType}:{entityId}
    </div>
  ),
}));

vi.mock('@/services/enterpriseInitiation.service', () => ({
  enterpriseInitiationService: {
    getStatus: vi.fn(),
  },
}));

import { enterpriseInitiationService } from '@/services/enterpriseInitiation.service';
import { InitiationStatusCard } from '../InitiationStatusCard';

describe('InitiationStatusCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the loaded initiation status and timeline', async () => {
    vi.mocked(enterpriseInitiationService.getStatus).mockResolvedValue({
      initiationId: 'init-1',
      status: 'APPROVED',
      projectId: 'proj-1',
      projectStatus: 'ACTIVE',
      automationStatus: 'REQUESTED_OR_COMPLETED',
      approvedAt: '2026-08-09T12:00:00.000Z',
      updatedAt: '2026-08-09T12:05:00.000Z',
      correlationId: 'corr-1',
    });

    render(<InitiationStatusCard initiationId="init-1" />);

    expect(screen.getByRole('status')).toHaveTextContent(
      /loading initiation status/i,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /approved/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /view project/i })).toHaveAttribute(
      'href',
      '/projects/proj-1',
    );
    expect(screen.getByTestId('timeline-mock')).toHaveTextContent(
      'Initiation:init-1',
    );
  });

  it('shows a retry state when loading fails', async () => {
    vi.mocked(enterpriseInitiationService.getStatus)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({
        initiationId: 'init-2',
        status: 'DRAFT',
        projectId: null,
        projectStatus: null,
        automationStatus: 'NOT_REQUESTED',
        approvedAt: null,
        updatedAt: '2026-08-09T12:05:00.000Z',
        correlationId: 'corr-2',
      });

    render(<InitiationStatusCard initiationId="init-2" showTimeline={false} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('boom');
    });

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /draft/i })).toBeInTheDocument();
    });
  });
});
