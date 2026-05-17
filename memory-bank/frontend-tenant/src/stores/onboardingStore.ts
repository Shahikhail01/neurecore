/**
 * Onboarding Wizard Store
 * State management using Zustand
 * Following SOLID principles with single responsibility per action
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { WizardStep } from "@/types/onboarding.types";
import type {
  WizardData,
  TierDto,
  DepartmentOutputDto,
  AgentTemplateDto,
  WorkspaceProvisioningConfig,
} from "@/types/onboarding.types";

interface OnboardingState {
  // State
  wizardId: string | null;
  tempToken: string | null;
  currentStep: WizardStep;
  totalSteps: number;
  completedSteps: WizardStep[];
  wizardData: WizardData;
  tiers: TierDto[];
  agentTemplates: AgentTemplateDto[];
  departments: DepartmentOutputDto[];
  isLoading: boolean;
  error: string | null;
  _hasHydrated: boolean;

  // Actions
  setHasHydrated: (v: boolean) => void;
  startWizard: (wizardId: string, tempToken: string) => void;
  setCurrentStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: WizardStep) => void;
  completeStep: (step: WizardStep) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;

  // Data setters
  setCompanyData: (data: WizardData["company"]) => void;
  setAdminData: (data: WizardData["admin"]) => void;
  setPlanData: (data: WizardData["plan"]) => void;
  setDepartmentsData: (data: DepartmentOutputDto[]) => void;
  setInvitationsData: (data: WizardData["invitations"]) => void;
  setIntegrationsData: (data: string[]) => void;
  setWorkspaceProvisioningData: (data: WorkspaceProvisioningConfig) => void;
  setAgentsData: (data: WizardData["agents"]) => void;
  setSecurityData: (data: WizardData["security"]) => void;
  setTiers: (tiers: TierDto[]) => void;
  setAgentTemplates: (templates: AgentTemplateDto[]) => void;
  setMarketingConsent: (consent: boolean) => void;
  setReferralCode: (code: string) => void;

  // Reset
  resetWizard: () => void;
}

const INITIAL_STATE = {
  wizardId: null,
  tempToken: null,
  currentStep: WizardStep.WELCOME as WizardStep,
  totalSteps: 10,
  completedSteps: [] as WizardStep[],
  wizardData: {} as WizardData,
  tiers: [] as TierDto[],
  agentTemplates: [] as AgentTemplateDto[],
  departments: [] as DepartmentOutputDto[],
  isLoading: false,
  error: null,
  _hasHydrated: false,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      setHasHydrated: (v) => set({ _hasHydrated: v }),

      startWizard: (wizardId, tempToken) =>
        set({
          wizardId,
          tempToken,
          currentStep: WizardStep.ORGANIZATION,
          completedSteps: [],
          wizardData: {},
          error: null,
        }),

      setCurrentStep: (step) => set({ currentStep: step }),

      nextStep: () => {
        const { currentStep, totalSteps, completedSteps } = get();
        if (currentStep < totalSteps) {
          const nextStep = (currentStep + 1) as WizardStep;
          if (!completedSteps.includes(currentStep)) {
            set({ completedSteps: [...completedSteps, currentStep] });
          }
          set({ currentStep: nextStep, error: null });
        }
      },

      prevStep: () => {
        const { currentStep } = get();
        if (currentStep > 1) {
          set({ currentStep: (currentStep - 1) as WizardStep, error: null });
        }
      },

      goToStep: (step) => {
        const { completedSteps } = get();
        // Can only go to completed steps or current step
        if (completedSteps.includes(step) || step === get().currentStep) {
          set({ currentStep: step, error: null });
        }
      },

      completeStep: (step) => {
        const { completedSteps } = get();
        if (!completedSteps.includes(step)) {
          set({ completedSteps: [...completedSteps, step] });
        }
      },

      setError: (error) => set({ error }),

      setLoading: (loading) => set({ isLoading: loading }),

      setCompanyData: (data) =>
        set((state) => ({
          wizardData: { ...state.wizardData, company: data },
        })),

      setAdminData: (data) =>
        set((state) => ({
          wizardData: { ...state.wizardData, admin: data },
        })),

      setPlanData: (data) =>
        set((state) => ({
          wizardData: { ...state.wizardData, plan: data },
        })),

      setDepartmentsData: (data) =>
        set((state) => ({
          wizardData: { ...state.wizardData, departments: data },
          departments: data,
        })),

      setInvitationsData: (data) =>
        set((state) => ({
          wizardData: { ...state.wizardData, invitations: data },
        })),

      setIntegrationsData: (data) =>
        set((state) => ({
          wizardData: { ...state.wizardData, integrations: data },
        })),

      setWorkspaceProvisioningData: (data) =>
        set((state) => ({
          wizardData: { ...state.wizardData, workspaceProvisioning: data },
        })),

      setAgentsData: (data) =>
        set((state) => ({
          wizardData: { ...state.wizardData, agents: data },
        })),

      setSecurityData: (data) =>
        set((state) => ({
          wizardData: { ...state.wizardData, security: data },
        })),

      setTiers: (tiers) => set({ tiers }),

      setAgentTemplates: (templates) => set({ agentTemplates: templates }),

      setMarketingConsent: (consent) =>
        set((state) => ({
          wizardData: { ...state.wizardData, marketingConsent: consent },
        })),

      setReferralCode: (code) =>
        set((state) => ({
          wizardData: { ...state.wizardData, referralCode: code },
        })),

      resetWizard: () =>
        set({
          ...INITIAL_STATE,
          _hasHydrated: true,
        }),
    }),
    {
      name: "onboarding-storage",
      partialize: (state) => ({
        wizardId: state.wizardId,
        tempToken: state.tempToken,
        currentStep: state.currentStep,
        completedSteps: state.completedSteps,
        wizardData: state.wizardData,
        _hasHydrated: state._hasHydrated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

// Selectors for optimized re-renders
export const selectWizardId = (state: OnboardingState) => state.wizardId;
export const selectCurrentStep = (state: OnboardingState) => state.currentStep;
export const selectIsLoading = (state: OnboardingState) => state.isLoading;
export const selectError = (state: OnboardingState) => state.error;
export const selectWizardData = (state: OnboardingState) => state.wizardData;
export const selectTiers = (state: OnboardingState) => state.tiers;
export const selectDepartments = (state: OnboardingState) => state.departments;
export const selectCompletedSteps = (state: OnboardingState) =>
  state.completedSteps;
export const selectHasCompletedStep =
  (step: WizardStep) => (state: OnboardingState) =>
    state.completedSteps.includes(step);
