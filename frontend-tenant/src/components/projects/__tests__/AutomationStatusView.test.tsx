import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const {
  getMock,
  emitMock,
  onMock,
  offMock,
  connectMock,
  disconnectMock,
} = vi.hoisted(() => ({
  getMock: vi.fn(),
  emitMock: vi.fn(),
  onMock: vi.fn(),
  offMock: vi.fn(),
  connectMock: vi.fn(),
  disconnectMock: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  default: {
    get: getMock,
  },
}));

vi.mock('socket.io-client', () => ({
  io: () => ({
    emit: emitMock,
    on: onMock,
    off: offMock,
    connect: connectMock,
    disconnect: disconnectMock,
  }),
}));

import { AutomationStatusView } from '../AutomationStatusView';

describe('AutomationStatusView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders progress from the automation status endpoint', async () => {
    getMock.mockResolvedValue({
      data: {
        data: {
          projectId: 'proj-1',
          tenantId: 'tenant-1',
          canonical: 'PROCESSING',
          lastLog: null,
          progress: {
            goalsCreated: 2,
            tasksCreated: 6,
            assignmentsCreated: 4,
          },
          history: [],
        },
      },
    });

    render(<AutomationStatusView projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByLabelText(/project automation status/i)).toBeInTheDocument();
    });

    expect(getMock).toHaveBeenCalledWith('/project-automation/proj-1/status');
    expect(screen.getByText(/processing/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(connectMock).toHaveBeenCalled();
  });

  it('shows an error state when the status endpoint fails', async () => {
    getMock.mockRejectedValue(new Error('status unavailable'));

    render(<AutomationStatusView projectId="proj-2" />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('status unavailable');
    });
  });
});
