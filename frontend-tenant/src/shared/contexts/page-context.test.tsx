// Tests for the typed PageContext provider.

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  PageContextProvider,
  usePageContext,
  useSetPageContext,
} from '@/shared/contexts/page-context';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

const usePathnameMock = usePathname as unknown as ReturnType<typeof vi.fn>;

function Wrapper({ children }: { children: ReactNode }) {
  return <PageContextProvider>{children}</PageContextProvider>;
}

describe('PageContextProvider', () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue('/projects/abc-123');
  });

  it('infers entityType and recordId from the URL', () => {
    const { result } = renderHook(() => usePageContext(), { wrapper: Wrapper });
    expect(result.current.pageContext.entityType).toBe('Project');
    expect(result.current.pageContext.recordId).toBe('abc-123');
  });

  it('lets pages publish authoritative context via setPageContext', () => {
    const { result } = renderHook(
      () => {
        const ctx = useSetPageContext();
        return ctx;
      },
      { wrapper: Wrapper },
    );
    act(() => {
      result.current.setPageContext({
        entityType: 'Customer',
        recordId: 'cust-99',
        selectedFields: ['name', 'email'],
        allowedActions: ['view', 'edit'],
      });
    });
    expect(result.current.pageContext.entityType).toBe('Customer');
    expect(result.current.pageContext.recordId).toBe('cust-99');
    expect(result.current.pageContext.selectedFields).toEqual(['name', 'email']);
    expect(result.current.pageContext.allowedActions).toEqual(['view', 'edit']);
  });

  it('clears context on demand', () => {
    const { result } = renderHook(() => useSetPageContext(), { wrapper: Wrapper });
    act(() => {
      result.current.setPageContext({ entityType: 'Order', recordId: 'ord-1' });
      result.current.clearPageContext();
    });
    expect(result.current.pageContext.entityType).toBeUndefined();
    expect(result.current.pageContext.recordId).toBeUndefined();
  });

  it('renders children without crashing when used outside a provider', () => {
    function Probe() {
      const ctx = usePageContext();
      return <span data-testid="probe">{ctx.pageContext.userLocale}</span>;
    }
    render(<Probe />);
    expect(screen.getByTestId('probe').textContent).toBe('en-US');
  });
});
