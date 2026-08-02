// Tests for the ContextChips component. The chip list is the typed
// PageContext rendered with removable buttons. We mock usePageContext so
// we don't need a Next.js router.

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContextChips } from '@/shared/components/chat/ContextChips';
import type { PageContext } from '@/shared/contexts/page-context';

vi.mock('@/shared/contexts/page-context', () => ({
  usePageContext: vi.fn(),
}));

import { usePageContext } from '@/shared/contexts/page-context';
const usePageContextMock = usePageContext as unknown as ReturnType<typeof vi.fn>;

function makeCtx(overrides: Partial<PageContext> = {}): PageContext {
  return {
    entityType: 'Project',
    recordId: 'abc-123',
    selectedFields: ['name', 'email'],
    userLocale: 'en-US',
    userTimeZone: 'UTC',
    allowedActions: [],
    pagePath: '/projects/abc-123',
    ...overrides,
  };
}

describe('ContextChips', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a chip for entityType, recordId, fields, and locale', () => {
    usePageContextMock.mockReturnValue({
      pageContext: makeCtx(),
      setPageContext: vi.fn(),
      clearPageContext: vi.fn(),
      setUserLocale: vi.fn(),
      setUserTimeZone: vi.fn(),
    });
    render(<ContextChips />);
    const list = screen.getByRole('list', { name: /active chat context/i });
    expect(list).toBeInTheDocument();
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('#abc-123')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
    expect(screen.getByText('en-US')).toBeInTheDocument();
  });

  it('removes a single selected field when its remove button is clicked', () => {
    const setPageContext = vi.fn();
    usePageContextMock.mockReturnValue({
      pageContext: makeCtx(),
      setPageContext,
      clearPageContext: vi.fn(),
      setUserLocale: vi.fn(),
      setUserTimeZone: vi.fn(),
    });
    render(<ContextChips />);
    const removeButtons = screen.getAllByLabelText(/Remove field name/);
    fireEvent.click(removeButtons[0]!);
    expect(setPageContext).toHaveBeenCalledWith({ selectedFields: ['email'] });
  });

  it('renders only the locale chip when record context is absent', () => {
    usePageContextMock.mockReturnValue({
      pageContext: { ...makeCtx(), entityType: undefined, recordId: undefined, selectedFields: undefined },
      setPageContext: vi.fn(),
      clearPageContext: vi.fn(),
      setUserLocale: vi.fn(),
      setUserTimeZone: vi.fn(),
    });
    render(<ContextChips />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent).toContain('en-US');
  });
});
