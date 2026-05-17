'use client';
// ─── VoiceProfileSettings.tsx ─────────────────────────────────────────────────
// SRP: Settings panel for creating and editing voice profiles.
// OCP: Language list and action list driven by data arrays — extend without touching this file.

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceProfileStore }    from '@/shared/stores/voiceProfileStore';
import { SUPPORTED_LANGUAGES }     from '@/core/services/voice/interfaces/IVoiceProfile';
import type { VoiceCommandAction } from '@/core/services/voice/interfaces/IVoiceCommandService';
import type { LanguageCode }       from '@/core/services/voice/interfaces/IVoiceProfile';

// ─── Available command actions for mapping ────────────────────────────────────
const COMMAND_ACTIONS: { value: VoiceCommandAction; label: string }[] = [
  { value: 'navigateToDashboard', label: 'Go to Dashboard' },
  { value: 'navigateToAgents',    label: 'Go to Agents' },
  { value: 'navigateToTasks',     label: 'Go to Tasks' },
  { value: 'navigateToWorkflows', label: 'Go to Workflows' },
  { value: 'navigateToApprovals', label: 'Go to Approvals' },
  { value: 'navigateToAnalytics', label: 'Go to Analytics' },
  { value: 'openCommandPalette',  label: 'Open Command Palette' },
  { value: 'openNewTask',         label: 'Create New Task' },
  { value: 'bulkApprove',         label: 'Bulk Approve' },
  { value: 'stopListening',       label: 'Stop Listening' },
];

export function VoiceProfileSettings() {
  const {
    profiles, activeId,
    loadFromService, setActive, createProfile, deleteProfile,
    addCustomPhrase, removeCustomPhrase, updateLanguage,
  } = useVoiceProfileStore();

  const [newProfileName, setNewProfileName]     = useState('');
  const [newProfileLang, setNewProfileLang]     = useState<LanguageCode>('en-US');
  const [newPhrase, setNewPhrase]               = useState('');
  const [newPhraseAction, setNewPhraseAction]   = useState<VoiceCommandAction>('navigateToDashboard');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  useEffect(() => { loadFromService(); }, [loadFromService]);

  const activeProfile = profiles.find((p) => p.id === activeId);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-zinc-200">Voice Profiles</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          Customize language and command phrases for voice control.
        </p>
      </div>

      {/* Profile list */}
      <div className="space-y-2">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={`rounded-lg border p-3 transition-colors ${
              profile.id === activeId
                ? 'border-indigo-500/50 bg-indigo-950/20'
                : 'border-zinc-800 bg-zinc-900/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-zinc-200">{profile.name}</span>
                <span className="ml-2 text-xs text-zinc-500">
                  {SUPPORTED_LANGUAGES.find((l) => l.code === profile.language)?.label ?? profile.language}
                </span>
                {profile.customPhrases.length > 0 && (
                  <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    {profile.customPhrases.length} custom phrase{profile.customPhrases.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {profile.id !== activeId && (
                  <button
                    onClick={() => setActive(profile.id)}
                    className="rounded px-2 py-1 text-xs text-indigo-400 hover:bg-indigo-950/40 transition-colors"
                  >
                    Activate
                  </button>
                )}
                {profile.id === activeId && (
                  <span className="rounded bg-indigo-900/40 px-2 py-0.5 text-[10px] text-indigo-300 ring-1 ring-indigo-700/40">
                    Active
                  </span>
                )}
                <button
                  onClick={() => setEditingProfileId(editingProfileId === profile.id ? null : profile.id)}
                  className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 transition-colors"
                >
                  {editingProfileId === profile.id ? 'Close' : 'Edit'}
                </button>
                {!profile.isDefault && (
                  <button
                    onClick={() => deleteProfile(profile.id)}
                    className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-950/20 transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            {/* Inline editor */}
            <AnimatePresence>
              {editingProfileId === profile.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-3 border-t border-zinc-800 pt-3">
                    {/* Language selector */}
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">Language</label>
                      <select
                        value={profile.language}
                        onChange={(e) => updateLanguage(profile.id, e.target.value as LanguageCode)}
                        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 focus:border-indigo-600 focus:outline-none"
                      >
                        {SUPPORTED_LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>{l.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Custom phrases */}
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">Custom Phrases</label>
                      {profile.customPhrases.length > 0 ? (
                        <div className="mb-2 space-y-1">
                          {profile.customPhrases.map((cp, i) => (
                            <div key={i} className="flex items-center justify-between rounded bg-zinc-800/60 px-2 py-1.5">
                              <span className="text-xs text-zinc-300">
                                <span className="text-zinc-500">"{cp.phrase}"</span>
                                <span className="mx-1.5 text-zinc-600">→</span>
                                {cp.action}
                              </span>
                              <button
                                onClick={() => removeCustomPhrase(profile.id, i)}
                                className="text-[10px] text-red-400 hover:text-red-300"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mb-2 text-[10px] text-zinc-600">No custom phrases yet.</p>
                      )}

                      {/* Add phrase form */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Spoken phrase…"
                          value={newPhrase}
                          onChange={(e) => setNewPhrase(e.target.value)}
                          className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:border-indigo-600 focus:outline-none"
                        />
                        <select
                          value={newPhraseAction}
                          onChange={(e) => setNewPhraseAction(e.target.value as VoiceCommandAction)}
                          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-600 focus:outline-none"
                        >
                          {COMMAND_ACTIONS.map((a) => (
                            <option key={a.value} value={a.value}>{a.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            if (!newPhrase.trim()) return;
                            addCustomPhrase(profile.id, newPhrase.trim(), newPhraseAction);
                            setNewPhrase('');
                          }}
                          className="rounded bg-indigo-700 px-3 py-1 text-xs text-white hover:bg-indigo-600 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Create new profile */}
      <div className="rounded-lg border border-dashed border-zinc-700 p-4">
        <p className="mb-3 text-xs font-medium text-zinc-400">New Profile</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Profile name…"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-indigo-600 focus:outline-none"
          />
          <select
            value={newProfileLang}
            onChange={(e) => setNewProfileLang(e.target.value as LanguageCode)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 focus:border-indigo-600 focus:outline-none"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          <button
            onClick={() => {
              if (!newProfileName.trim()) return;
              createProfile(newProfileName.trim(), newProfileLang);
              setNewProfileName('');
            }}
            className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-600 transition-colors"
          >
            Create
          </button>
        </div>
      </div>

      {/* Active profile stats */}
      {activeProfile && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
          <p className="text-xs font-medium text-zinc-400 mb-1">Active Profile</p>
          <p className="text-sm text-zinc-200">{activeProfile.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            Language: {SUPPORTED_LANGUAGES.find((l) => l.code === activeProfile.language)?.label}
            {activeProfile.customPhrases.length > 0 &&
              ` • ${activeProfile.customPhrases.length} custom phrase${activeProfile.customPhrases.length > 1 ? 's' : ''}`
            }
          </p>
        </div>
      )}
    </div>
  );
}
