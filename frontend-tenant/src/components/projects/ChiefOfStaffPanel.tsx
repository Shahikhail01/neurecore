'use client';
/**
 * ChiefOfStaffPanel — Phase 3C
 *
 * Chat interface for the Chief of Staff agent. Shows project snapshot
 * and allows the human to message the CoS agent.
 *
 * API: POST /v1/projects/:id/cos/messages
 */

import { useState, useRef, useEffect } from 'react';
import api from '@/services/api';

interface CosMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CosPanelProps {
  projectId: string;
  projectName: string;
}

export function ChiefOfStaffPanel({ projectId, projectName }: CosPanelProps) {
  const [messages, setMessages] = useState<CosMessage[]>([
    {
      role: 'assistant',
      content: `I'm your Chief of Staff for "${projectName}". I watch project events, coordinate AI employees, and surface status to you. How can I help?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await api.post(
        `/v1/projects/${projectId}/cos/messages`,
        {
          message: userMessage,
          history: messages.slice(-10),
        },
      );

      const reply = res.data?.data?.reply ?? res.data?.reply ?? 'Sorry, no response.';

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full border rounded-lg bg-white shadow-sm">
      <div className="border-b px-4 py-3 bg-slate-50 rounded-t-lg">
        <h3 className="text-sm font-semibold text-slate-700">
          🎖️ Chief of Staff — {projectName}
        </h3>
        <p className="text-xs text-slate-500">Your AI executive assistant for this project</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[500px]">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-[color:var(--state-info)] text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-400 animate-pulse">
              Thinking...
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t p-3 flex gap-2">
        <input
          type="text"
          aria-label="Message input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask your Chief of Staff anything..."
          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-[color:var(--state-info)] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
        >
          Send
        </button>
      </div>
    </div>
  );
}
