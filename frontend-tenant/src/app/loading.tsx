import { Loader2 } from 'lucide-react';
import { PageShell } from '@neurecore/ui-visual';

export default function LoadingPage() {
  return (
    <PageShell variant="default">
      <div className="flex flex-col items-center gap-4 py-24">
        <Loader2 className="w-8 h-8 text-[color:var(--accent-400)] animate-spin" />
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    </PageShell>
  );
}
