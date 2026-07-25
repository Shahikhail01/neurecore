import Link from 'next/link';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { PageShell, GlassPanel } from '@neurecore/ui-visual';

export default function NotFoundPage() {
  return (
    <PageShell variant="default">
      <GlassPanel variant="panel" padding="lg" className="text-center max-w-md mx-auto">
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-white/5">
          <FileQuestion className="w-8 h-8 text-zinc-400" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-100 mb-2">
          Page not found
        </h2>
        <p className="text-zinc-400 text-sm mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/command-center"
          className="nv-btn-accent inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Command Center
        </Link>
      </GlassPanel>
    </PageShell>
  );
}
