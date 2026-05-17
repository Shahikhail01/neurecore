// ─── VoiceProfileService.ts ───────────────────────────────────────────────────
// SRP: Voice profile CRUD + application to recognition instances.
// DIP: Consumers depend on IVoiceProfileService, not this class.

import type {
  IVoiceProfileService,
  VoiceProfile,
  LanguageCode,
} from './interfaces/IVoiceProfile';
import type { VoiceCommand } from './interfaces/IVoiceCommandService';
import { getVoiceCommandService } from './VoiceCommandService';

const DEFAULT_PROFILE_ID = 'default';

function buildDefaultProfile(): VoiceProfile {
  return {
    id:            DEFAULT_PROFILE_ID,
    name:          'Standard',
    description:   'Built-in English (US) voice profile',
    language:      'en-US' as LanguageCode,
    customPhrases: [],
    narrateRate:   0.95,
    narratePitch:  1.0,
    createdAt:     new Date().toISOString(),
    isDefault:     true,
  };
}

let _profileIdSeq = 0;
function genId(): string { return `profile_${Date.now()}_${++_profileIdSeq}`; }

export class VoiceProfileService implements IVoiceProfileService {
  private profiles: VoiceProfile[]       = [buildDefaultProfile()];
  private activeId: string               = DEFAULT_PROFILE_ID;

  getProfiles(): VoiceProfile[] {
    return [...this.profiles];
  }

  getActiveProfile(): VoiceProfile | null {
    return this.profiles.find((p) => p.id === this.activeId) ?? null;
  }

  setActiveProfile(profileId: string): void {
    const profile = this.profiles.find((p) => p.id === profileId);
    if (!profile) return;
    this.activeId = profileId;
    this._applyActiveToVoiceService(profile);
  }

  createProfile(
    data: Omit<VoiceProfile, 'id' | 'createdAt' | 'isDefault'>,
  ): VoiceProfile {
    const profile: VoiceProfile = {
      ...data,
      id:        genId(),
      createdAt: new Date().toISOString(),
      isDefault: false,
    };
    this.profiles.push(profile);
    return profile;
  }

  updateProfile(
    id: string,
    data: Partial<Omit<VoiceProfile, 'id' | 'createdAt'>>,
  ): VoiceProfile {
    const idx = this.profiles.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Voice profile "${id}" not found`);
    this.profiles[idx] = { ...this.profiles[idx], ...data };
    // Re-apply if active
    if (this.activeId === id) {
      this._applyActiveToVoiceService(this.profiles[idx]);
    }
    return this.profiles[idx];
  }

  deleteProfile(id: string): void {
    if (id === DEFAULT_PROFILE_ID) return; // protect built-in
    this.profiles = this.profiles.filter((p) => p.id !== id);
    if (this.activeId === id) this.activeId = DEFAULT_PROFILE_ID;
  }

  applyToRecognition(recognition: { lang: string; rate?: number }): void {
    const active = this.getActiveProfile();
    if (!active) return;
    recognition.lang = active.language;
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private _applyActiveToVoiceService(profile: VoiceProfile): void {
    // Update language on the global speech recognition service
    try {
      const voiceSvc = getVoiceCommandService();
      // Register custom phrase mappings (OCP)
      for (const cp of profile.customPhrases) {
        const cmd: VoiceCommand = {
          phrases: [cp.phrase.toLowerCase()],
          action:  cp.action,
          label:   `Custom: ${cp.phrase}`,
        };
        voiceSvc.registerCommand(cmd);
      }
    } catch {
      // VoiceService may not be available in SSR
    }
  }
}

let _svc: VoiceProfileService | null = null;
export function getVoiceProfileService(): VoiceProfileService {
  if (!_svc) _svc = new VoiceProfileService();
  return _svc;
}
