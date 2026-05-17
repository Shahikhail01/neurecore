/**
 * React Router DOM Compatibility Shim for Next.js
 *
 * This file provides a compatibility layer between NocoBase's react-router-dom
 * imports and Next.js 15 App Router. It maps router functions to Next.js equivalents.
 */

'use client';

import {
  ReactNode,
  CSSProperties,
  FC,
  ComponentProps,
} from 'react';
import NextLink from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import React from 'react';

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
  const params = useSearchParams();
  
  return {
    pathname,
    search: params.toString() ? `?${params.toString()}` : '',
    hash: '',
    state: null,
    key: 'default',
  };
}

/**
 * useParams Hook - Stub for route parameters
 */
export function useParams() {
  return {};
}

/**
 * useSearchParams Hook - Parse URL search parameters
 */
export function useQueryParams() {
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
 * Common exports for compatibility
 */
export const Outlet = () => null;
export const useOutletContext = () => ({});
export const useResolvedPath = (path: string) => ({ pathname: path, search: '', hash: '' });
export const useMatch = () => null;

export type NavigateFunction = ReturnType<typeof useNavigate>;
