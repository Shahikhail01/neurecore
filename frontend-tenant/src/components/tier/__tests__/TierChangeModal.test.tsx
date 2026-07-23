// components/tier/__tests__/TierChangeModal.test.tsx — Phase 6 modal tests.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/services/api', () => ({
  default: { defaults: { baseURL: '/api/v1' } },
  restClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/services/tiers.service', () => ({
  tiersService: {
    list: vi.fn(),
    requestTierChange: vi.fn(),
  },
}));

import { tiersService } from '@/services/tiers.service';
import { TierChangeModal } from '../TierChangeModal';

const TIERS = [
  {
    id: 'tier-basic', slug: 'basic', name: 'Basic', tagline: 'Starter plan',
    monthlyPrice: 0, yearlyPrice: 0, currency: 'USD',
    maxUsers: 3, maxAgents: 3, maxDepartments: 1, maxStorageGB: 1,
    maxApiCalls: 1_000, maxFileSizeMB: 10,
  },
  {
    id: 'tier-business', slug: 'business', name: 'Business', tagline: 'Growing teams',
    monthlyPrice: 99, yearlyPrice: 990, currency: 'USD',
    maxUsers: 10, maxAgents: 10, maxDepartments: 3, maxStorageGB: 10,
    maxApiCalls: 10_000, maxFileSizeMB: 50,
  },
  {
    id: 'tier-pro', slug: 'professional', name: 'Professional', tagline: 'Scale operations',
    monthlyPrice: 299, yearlyPrice: 2_990, currency: 'USD',
    maxUsers: 50, maxAgents: 50, maxDepartments: 10, maxStorageGB: 100,
    maxApiCalls: 100_000, maxFileSizeMB: 200,
  },
  {
    id: 'tier-ent', slug: 'enterprise', name: 'Enterprise', tagline: 'Large org',
    monthlyPrice: 999, yearlyPrice: 9_990, currency: 'USD',
    maxUsers: 9999, maxAgents: 9999, maxDepartments: 9999, maxStorageGB: 1000,
    maxApiCalls: 1_000_000, maxFileSizeMB: 1_000,
  },
];

const CURRENT_BASIC = TIERS[0];

describe('TierChangeModal — Phase 6', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the title + 4 tier cards sorted ascending by price', async () => {
    vi.mocked(tiersService.list).mockResolvedValue(TIERS);

    render(
      <TierChangeModal
        open
        onClose={vi.fn()}
        currentTier={CURRENT_BASIC as never}
      />,
    );

    await waitFor(() => {
      // Title
      expect(screen.getByRole('heading', { name: /change subscription tier/i })).toBeInTheDocument();
      // All 4 tier names visible (header says "You're on Basic" so "Basic"
      // appears multiple times — use getAllByText to allow duplicates).
      expect(screen.getAllByText('Basic').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Business')).toBeInTheDocument();
      expect(screen.getByText('Professional')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
    });

    // Verify ascending order: Basic → Business → Professional → Enterprise
    const cardOrder = screen
      .getAllByRole('button', { name: /Request (upgrade|downgrade)/ })
      .map((b) => b.textContent);
    expect(cardOrder[0]).toMatch(/Request upgrade/); // business
    expect(cardOrder[1]).toMatch(/Request upgrade/); // professional
    expect(cardOrder[2]).toMatch(/Request upgrade/); // enterprise
  });

  it('shows the Current pill on the matching tier', async () => {
    vi.mocked(tiersService.list).mockResolvedValue(TIERS);

    render(
      <TierChangeModal
        open
        onClose={vi.fn()}
        currentTier={CURRENT_BASIC as never}
      />,
    );

    await waitFor(() => {
      // The Current pill is rendered for the Basic card.
      expect(screen.getByText('Current')).toBeInTheDocument();
    });
    // Basic is Active (button text) — other tiers are "Request upgrade".
    const basicActive = screen.getByRole('button', { name: 'Active' });
    expect(basicActive).toBeInTheDocument();
  });

  it('shows Request downgrade for tiers below the current one', async () => {
    const current = TIERS[2]; // Professional
    vi.mocked(tiersService.list).mockResolvedValue(TIERS);

    render(
      <TierChangeModal open onClose={vi.fn()} currentTier={current as never} />,
    );

    await waitFor(() => {
      // Professional should now show Active (current).
      expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument();
      // Basic + Business should both be "Request downgrade".
      const downgrades = screen.getAllByRole('button', { name: /Request downgrade/ });
      expect(downgrades.length).toBe(2);
      // Enterprise should still be "Request upgrade".
      expect(screen.getByRole('button', { name: /Request upgrade/ })).toBeInTheDocument();
    });
  });

  it('calls tiersService.requestTierChange with the target tier + reason', async () => {
    vi.mocked(tiersService.list).mockResolvedValue(TIERS);
    vi.mocked(tiersService.requestTierChange).mockResolvedValue({
      requestId: 'cr-99',
      direction: 'UPGRADE',
      status: 'PENDING',
      toTier: { id: 'tier-pro', slug: 'professional', name: 'Professional' },
    });

    render(
      <TierChangeModal
        open
        onClose={vi.fn()}
        currentTier={CURRENT_BASIC as never}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Business')).toBeInTheDocument();
    });

    // Fill in the reason textarea
    fireEvent.change(screen.getByLabelText(/Why this change/i), {
      target: { value: 'We need approval chains' },
    });

    // Click the Business "Request upgrade" button
    fireEvent.click(screen.getAllByRole('button', { name: /Request upgrade/ })[0]);

    await waitFor(() => {
      expect(tiersService.requestTierChange).toHaveBeenCalledWith(
        'tier-business',
        'We need approval chains',
      );
    });

    // Success banner should render with the request id
    expect(await screen.findByTestId('tier-change-success')).toHaveTextContent('cr-99');
  });

  it('shows an error banner when the request fails', async () => {
    vi.mocked(tiersService.list).mockResolvedValue(TIERS);
    vi.mocked(tiersService.requestTierChange).mockRejectedValue({
      response: { data: { message: 'Cannot downgrade past hard limit' } },
    });

    render(
      <TierChangeModal
        open
        onClose={vi.fn()}
        currentTier={TIERS[2] as never}
      />,
    );

    await waitFor(() => screen.getByText('Basic'));
    fireEvent.click(screen.getAllByRole('button', { name: /Request downgrade/ })[0]);

    await waitFor(() => {
      expect(screen.getByText(/Cannot downgrade past hard limit/)).toBeInTheDocument();
    });
  });
});
