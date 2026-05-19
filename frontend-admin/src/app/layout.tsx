import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NeureCore — Admin Portal',
  description: 'Super Admin workspace',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  );
}
