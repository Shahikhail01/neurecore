// ─── IVoiceProfile.ts ─────────────────────────────────────────────────────────
// SRP: Voice profile configuration contract.
// ISP: Separate from IVoiceCommandService — profile concerns are orthogonal.

import type { VoiceCommandAction } from './IVoiceCommandService';

export interface CustomPhrase {
  /** Custom spoken phrase */
  phrase:  string;
  /** Maps to a registered command action */
  action:  VoiceCommandAction;
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'es-ES', label: 'Spanish (Spain)' },
  { code: 'es-MX', label: 'Spanish (Mexico)' },
  { code: 'fr-FR', label: 'French' },
  { code: 'de-DE', label: 'German' },
  { code: 'it-IT', label: 'Italian' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'zh-CN', label: 'Chinese (Simplified)' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export interface VoiceProfile {
  id:             string;
  name:           string;
  description?:   string;
  language:       LanguageCode;
  /** User-defined phrase-to-action mappings (extend built-in commands) */
  customPhrases:  CustomPhrase[];
  /** Speech rate 0.5–2.0 (for TTS narration) */
  narrateRate:    number;
  /** Speech pitch 0.5–2.0 (for TTS narration) */
  narratePitch:   number;
  createdAt:      string;
  isDefault:      boolean;
}

export interface IVoiceProfileService {
  getProfiles():                              VoiceProfile[];
  getActiveProfile():                         VoiceProfile | null;
  setActiveProfile(profileId: string):        void;
  createProfile(data: Omit<VoiceProfile, 'id' | 'createdAt' | 'isDefault'>): VoiceProfile;
  updateProfile(id: string, data: Partial<Omit<VoiceProfile, 'id' | 'createdAt'>>): VoiceProfile;
  deleteProfile(id: string):                  void;
  /** Apply the active profile's language to a SpeechRecognition instance */
  applyToRecognition(recognition: { lang: string; rate?: number }): void;
}
