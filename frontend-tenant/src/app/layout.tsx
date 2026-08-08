import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppInitializer } from '@/shared/components/AppInitializer';
import { ThemeProvider } from '@/shared/components/ThemeProvider';
import { ServiceWorkerRegistrar } from '@/shared/components/ServiceWorkerRegistrar';
import { AuthProvider } from '@/auth';
import { PageContextProvider } from '@/shared/contexts/page-context';
import { MobileProvider } from '@/shared/mobile';

export const metadata: Metadata = {
  title: 'NeureCore — Tenant Portal',
  description: 'Tenant workspace',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Default to `dark theme-dark` for first render (avoid FOUC). ThemeProvider
    // is mounted in body via script and reconciles to the user's saved choice —
    // so `theme-light` users will see a brief dark flash before the swap. The
    // inline pre-paint script keeps that window < 50ms. AppInitializer relies on
    // a stable <html class="dark"> base for the colour-scheme signal.
    <html lang="en" className="dark theme-dark text-size-md" suppressHydrationWarning>
      <head>
        {/* Pre-paint theme reconciliation — runs before React hydrates so users
            with theme='light' never see a dark flash. Reads localStorage and
            toggles the .theme-* classes synchronously. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var raw=localStorage.getItem('hq_ui_preferences');if(raw){var p=JSON.parse(raw);var s=p.state||p;if(s&&s.theme){var r=document.documentElement.classList;r.remove('theme-dark','theme-light','theme-high-contrast');r.add('theme-'+s.theme);}}}catch(e){}",
          }}
        />
      </head>
      <body className="bg-surface text-zinc-100 antialiased font-sans">
        <AuthProvider>
          <PageContextProvider>
            <ThemeProvider />
            <AppInitializer />
            <ServiceWorkerRegistrar />
            <MobileProvider>
              {children}
            </MobileProvider>
          </PageContextProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
