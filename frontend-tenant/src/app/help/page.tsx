'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HelpCircle, Mail, Book, MessageCircle, ArrowLeft, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageShell, PageHero } from '@neurecore/ui-visual';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';

const HELP_RESOURCES = [
  {
    icon: Book,
    title: 'Documentation',
    description: 'Browse product guides, API references, and tutorials.',
    href: 'https://docs.neurecore.com',
    external: true,
  },
  {
    icon: MessageCircle,
    title: 'Live Chat Support',
    description: 'Chat with our support team for quick help.',
    action: 'chat' as const,
  },
  {
    icon: Mail,
    title: 'Email Support',
    description: 'Send us a detailed message and we will get back to you.',
    href: 'mailto:support@neurecore.com',
    external: true,
  },
];

export default function HelpPage() {
  const user = useTenantAuth();
  const router = useRouter();

  useEffect(() => {
    document.title = 'Help — NeureCore';
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <TenantShell user={user}>
      <PageShell variant="default">
        <PageHero
          title="How can we help?"
          subtitle="Find documentation, contact support, or get in touch with our team."
          actions={
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          }
        />
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center space-y-3 py-8 hidden"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-500/15 text-accent-500">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-100">How can we help?</h1>
          <p className="text-sm text-zinc-500 max-w-md mx-auto">
            Find documentation, contact support, or get in touch with our team.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {HELP_RESOURCES.map((resource) => {
            const Icon = resource.icon;
            const content = (
              <div className="card-surface card-interactive p-5 flex flex-col items-center text-center gap-3 h-full">
                <div className="w-10 h-10 rounded-lg bg-accent-500/15 text-accent-500 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h2 className="text-sm font-semibold text-zinc-100">{resource.title}</h2>
                <p className="text-xs text-zinc-500">{resource.description}</p>
                {resource.external && (
                  <ExternalLink className="w-3 h-3 text-zinc-600 mt-auto" />
                )}
              </div>
            );

            if (resource.action === 'chat') {
              return (
                <button
                  key={resource.title}
                  type="button"
                  onClick={() => {
                    const event = new CustomEvent('open-ai-chat', { detail: { message: 'I need help with NeureCore.' } });
                    window.dispatchEvent(event);
                    router.push('/home');
                  }}
                  className="text-left"
                >
                  {content}
                </button>
              );
            }

            return (
              <a
                key={resource.title}
                href={resource.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-left"
              >
                {content}
              </a>
            );
          })}
        </div>

        <div className="card-surface p-5 text-center text-xs text-zinc-500">
          <p>Need something else? Reach us at <a href="mailto:support@neurecore.com" className="text-accent-500 hover:underline">support@neurecore.com</a></p>
        </div>
      </div>
      </PageShell>
    </TenantShell>
  );
}
