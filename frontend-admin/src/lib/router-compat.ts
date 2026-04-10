/**
 * React Router DOM Compatibility Shim for Next.js
 *
 * This file provides a compatibility layer between NocoBase's react-router-dom
 * imports and Next.js 15 App Router. It maps router functions to Next.js equivalents.
 *
 * Usage: Replace "import { Link } from '@/lib/router-compat'" with
 *        "import { Link } from '@/lib/router-compat'"
 */

'use client';

import {
  ReactNode,
  CSSProperties,
  FC,
  ComponentProps,
  AnchorHTMLAttributes,
} from 'react';
import NextLink from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

/**
 * Link Component - Next.js compatible replacement for react-router Link
 */
export const Link: FC<{
  to: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  [key: string]: any;
}> = ({ to, children, className, style, ...props }) => {
  return (
    <NextLink href={to} className={className} style={style} {...props}>
      {children}
    </NextLink>
  );
};

/**
 * useNavigate Hook - Provides navigate() function for Next.js
 */
export function useNavigate() {
  const router = useRouter();
  return (path: string) => router.push(path);
}

/**
 * useLocation Hook - Returns current location info
 */
export function useLocation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  return {
    pathname,
    search: searchParams.toString() ? `?${searchParams.toString()}` : '',
    hash: '',
    state: null,
    key: 'default',
  };
}

/**
 * useParams Hook - Stub for route parameters (limited support)
 * Note: Full support requires dynamic routes in Next.js
 */
export function useParams() {
  return {};
}

/**
 * useSearchParams Hook - Parse URL search parameters
 */
export function useSearchParams() {
  const params = useSearchParams();
  const obj: Record<string, string> = {};
  params.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

/**
 * Navigate Component - Declarative navigation
 */
export const Navigate: FC<{ to: string; replace?: boolean }> = ({ to }) => {
  const router = useRouter();
  
  React.useEffect(() => {
    router.push(to);
  }, [to, router]);
  
  return null;
};

/**
 * Routes/Route Components - Stub implementations
 * Note: These are minimal stubs. For complex routing, use Next.js file-based routing.
 */
export const Routes: FC<{ children: ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const Route: FC<{
  path?: string;
  element?: ReactNode;
  children?: ReactNode;
}> = ({ element, children }) => {
  return element || children;
};

/**
 * BrowserRouter - Stub (not needed in Next.js)
 */
export const BrowserRouter: FC<{ children: ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

/**
 * Re-export common types for compatibility
 */
export type { ReactNode } from 'react';
export type NavigateFunction = ReturnType<typeof useNavigate>;

/**
 * Placeholder exports for less common router features
 */
export const Outlet = () => null;
export const useOutletContext = () => ({});
export const useResolvedPath = (path: string) => ({ pathname: path, search: '', hash: '' });
export const useMatch = () => null;

// Support for React usage
import React from 'react';
