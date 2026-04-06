'use client';

import { useState } from 'react';

export default function TelegramIntegrationPage() {
  const [chatId, setChatId] = useState('');
  const [botToken, setBotToken] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const sendTest = async () => {
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch('/api/v1/integrations/telegram/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: botToken || undefined, chatId, text: 'NeureCore test via web UI' }),
      });
      const j = await res.json();
      if (res.ok) setStatus('Sent');
      else setStatus(`Error: ${j.message ?? JSON.stringify(j)}`);
    } catch (err) {
      setStatus('Failed: ' + String(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 max-w-xl">
      <h2 className="text-lg font-semibold">Telegram Integration (Test)</h2>
      <p className="text-sm text-zinc-400">Enter a chat id and optionally a bot token to send a test message.</p>

      <div className="grid grid-cols-1 gap-2">
        <input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="Telegram chat id" className="w-full rounded-md p-2 bg-surface-overlay border border-surface-border" />
        <input value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="Bot token (optional)" className="w-full rounded-md p-2 bg-surface-overlay border border-surface-border" />
        <div className="flex items-center gap-2">
          <button onClick={sendTest} disabled={sending || !chatId} className="rounded-md bg-indigo-600 px-3 py-2 text-white disabled:opacity-50">{sending ? 'Sending…' : 'Send test'}</button>
          {status && <span className="text-sm text-zinc-300">{status}</span>}
        </div>
      </div>
    </div>
  );
}
