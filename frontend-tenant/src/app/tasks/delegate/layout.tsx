import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Delegate Task | NeureCore',
  description: 'Delegate a task to an AI agent with custom authority settings',
};

export default function DelegateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
