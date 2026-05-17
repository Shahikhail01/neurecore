'use client';
// ─── voiceProfileStore.ts ─────────────────────────────────────────────────────
// SRP: Persisted Zustand store for voice profiles.
// DIP: Translates persisted data back to the VoiceProfileService layer.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getVoiceProfileService } from '@/core/services/voice/VoiceProfileService';
import type { VoiceProfile, LanguageCode } from '@/core/services/voice/interfaces/IVoiceProfile';
import type { VoiceCommandAction } from '@/core/services/voice/interfaces/IVoiceCommandService';

interface VoiceProfileState {
  profiles:   VoiceProfile[];
  activeId:   string;

  loadFromService: ()                                           => void;
  setActive:       (id: string)                                 => void;
  createProfile:   (name: string, language: LanguageCode)       => void;
  deleteProfile:   (id: string)                                 => void;
  addCustomPhrase: (profileId: string, phrase: string, action: VoiceCommandAction) => void;
  removeCustomPhrase: (profileId: string, phraseIndex: number)  => void;
  updateLanguage:  (profileId: string, language: LanguageCode)  => void;
}

export const useVoiceProfileStore = create<VoiceProfileState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeId: 'default',

      loadFromService: () => {
        const svc = getVoiceProfileService();
        set({
          profiles: svc.getProfiles(),
          activeId: svc.getActiveProfile()?.id ?? 'default',
        });
      },

      setActive: (id) => {
        const svc = getVoiceProfileService();
        svc.setActiveProfile(id);
        set({ activeId: id, profiles: svc.getProfiles() });
      },

      createProfile: (name, language) => {
        const svc = getVoiceProfileService();
        svc.createProfile({ name, language, customPhrases: [], narrateRate: 0.95, narratePitch: 1.0 });
        set({ profiles: svc.getProfiles() });
      },

      deleteProfile: (id) => {
        const svc = getVoiceProfileService();
        svc.deleteProfile(id);
        const state = get();
        set({
          profiles: svc.getProfiles(),
          activeId: state.activeId === id ? 'default' : state.activeId,
        });
      },

      addCustomPhrase: (profileId, phrase, action) => {
        const svc = getVoiceProfileService();
        const profile = svc.getProfiles().find((p) => p.id === profileId);
        if (!profile) return;
        svc.updateProfile(profileId, {
          customPhrases: [...profile.customPhrases, { phrase, action }],
        });
        set({ profiles: svc.getProfiles() });
      },

      removeCustomPhrase: (profileId, phraseIndex) => {
        const svc = getVoiceProfileService();
        const profile = svc.getProfiles().find((p) => p.id === profileId);
        if (!profile) return;
        svc.updateProfile(profileId, {
          customPhrases: profile.customPhrases.filter((_, i) => i !== phraseIndex),
        });
        set({ profiles: svc.getProfiles() });
      },

      updateLanguage: (profileId, language) => {
        const svc = getVoiceProfileService();
        svc.updateProfile(profileId, { language });
        set({ profiles: svc.getProfiles() });
      },
    }),
    {
      name: 'hq_voice_profiles',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ profiles: s.profiles, activeId: s.activeId }),
    },
  ),
);
