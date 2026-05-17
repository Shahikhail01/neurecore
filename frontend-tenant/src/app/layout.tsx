import type { Metadata } from 'next';
import './globals.css';
import { AppInitializer } from '@/shared/components/AppInitializer';
import { ThemeProvider } from '@/shared/components/ThemeProvider';
import { ServiceWorkerRegistrar } from '@/shared/components/ServiceWorkerRegistrar';

export const metadata: Metadata = {
  title: 'NeureCore — Tenant Portal',
  description: 'Tenant workspace',
  manifest: '/manifest.json',
  themeColor: '#09090b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark theme-dark text-size-md">
      <body className="bg-surface text-zinc-100 antialiased font-sans">
        <ThemeProvider />
        <AppInitializer />
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
