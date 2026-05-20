"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import TenantShell from "@/components/TenantShell";
import api from "../../../services/api";

type WizardStepId = "policy" | "runtime" | "assignment" | "review";

interface PoolSlot {
  id: string;
  templateId: string;
  templateName: string;
  slot: number;
  slotType: "FIXED" | "CHOICE";
  isRequired: boolean;
  isDefaultSelected: boolean;
  defaultBudgetPerDay?: number;
  defaultModel?: string;
  filledAgentId?: string;
  filledAgentName?: string;
  filledAgentStatus?: string;
}

interface TenantPoolStatus {
  tenantId: string;
  tierId: string;
  tierName: string;
  tierSlug: string;
  fixedSlots: PoolSlot[];
  choiceSlots: PoolSlot[];
  totalFixed: number;
  totalChoice: number;
  filledFixed: number;
  filledChoice: number;
  choiceRemaining: number;
  canAddMoreChoiceAgents: boolean;
  isAtLimit: boolean;
}

interface DepartmentOption {
  id: string;
  name: string;
}

const WIZARD_STEPS: Array<{
  id: WizardStepId;
  label: string;
  description: string;
}> = [
  {
    id: "policy",
    label: "Policy Slot",
    description: "Choose an approved tier-owned slot.",
  },
  {
    id: "runtime",
    label: "Runtime Config",
    description: "Set live agent defaults you are allowed to edit.",
  },
  {
    id: "assignment",
    label: "Department",
    description: "Place the new agent into your operating structure.",
  },
  {
    id: "review",
    label: "Review",
    description:
      "Confirm the slot, config, and assignment before provisioning.",
  },
];

export default function NewAgentPage() {
  const user = useTenantAuth();
  const router = useRouter();

  const [poolStatus, setPoolStatus] = useState<TenantPoolStatus | null>(null);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [agentName, setAgentName] = useState("");
  const [agentModel, setAgentModel] = useState("");
  const [budgetPerDay, setBudgetPerDay] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [instructions, setInstructions] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  async function loadPoolStatus() {
    setLoading(true);
    setError("");
    try {
      const [statusRes, departmentsRes] = await Promise.all([
        api.get("/tiers/pool/status"),
        api.get("/departments?limit=100"),
      ]);
      const status = (statusRes.data?.data ??
        statusRes.data) as TenantPoolStatus;
      const tenantDepartments =
        ((departmentsRes.data?.data ??
          departmentsRes.data) as DepartmentOption[]) ?? [];
      setPoolStatus(status);
      setDepartments(tenantDepartments);
      const firstAvailableSlot = status.choiceSlots.find(
        (slot) => !slot.filledAgentId,
      );
      setSelectedSlotId(firstAvailableSlot?.id ?? "");
      setAgentName(firstAvailableSlot?.templateName ?? "");
      setAgentModel(firstAvailableSlot?.defaultModel ?? "");
      setBudgetPerDay(
        firstAvailableSlot?.defaultBudgetPerDay !== undefined
          ? String(firstAvailableSlot.defaultBudgetPerDay)
          : "",
      );
      setSystemPrompt("");
      setInstructions("");
      setDepartmentId("");
      setStepIndex(0);
    } catch (err: unknown) {
      const response = err as { response?: { data?: { message?: string } } };
      setError(
        response?.response?.data?.message ??
          "Failed to load agent provisioning options",
      );
      setPoolStatus(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPoolStatus();
  }, []);

  const selectedSlot = useMemo(
    () =>
      poolStatus?.choiceSlots.find((slot) => slot.id === selectedSlotId) ??
      null,
    [poolStatus, selectedSlotId],
  );

  const currentStep = WIZARD_STEPS[stepIndex];

  function applySlotDefaults(slotId: string) {
    const slot = poolStatus?.choiceSlots.find((entry) => entry.id === slotId);
    if (!slot) return;
    setSelectedSlotId(slotId);
    setAgentName(slot.templateName);
    setAgentModel(slot.defaultModel ?? "");
    setBudgetPerDay(
      slot.defaultBudgetPerDay !== undefined
        ? String(slot.defaultBudgetPerDay)
        : "",
    );
    setSystemPrompt("");
    setInstructions("");
    setError("");
  }

  function validateStep(index: number) {
    if (index === 0 && !selectedSlotId) {
      setError("Select an available choice slot first");
      return false;
    }

    if (index === 1) {
      if (!agentName.trim()) {
        setError("Agent name is required");
        return false;
      }

      if (budgetPerDay && Number.isNaN(Number(budgetPerDay))) {
        setError("Budget per day must be a valid number");
        return false;
      }
    }

    setError("");
    return true;
  }

  function goNext() {
    if (!validateStep(stepIndex)) return;
    setStepIndex((current) => Math.min(current + 1, WIZARD_STEPS.length - 1));
  }

  function goBack() {
    setError("");
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  const handleProvision = async () => {
    if (!validateStep(1) || !selectedSlotId) {
      return;
    }

    setSaving(true);
    setError("");
    try {
      const provisionRes = await api.post("/tiers/pool/provision-slot", {
        slotId: selectedSlotId,
      });
      const provisioned = provisionRes.data?.data ?? provisionRes.data;
      const agentId = provisioned?.agentId as string | undefined;

      if (!agentId) {
        throw new Error("Provisioning did not return an agent id");
      }

      await api.patch(`/agents/${agentId}`, {
        name: agentName.trim(),
        model: agentModel.trim() || undefined,
        budgetPerDay: budgetPerDay ? Number(budgetPerDay) : undefined,
        systemPrompt: systemPrompt.trim() || undefined,
        instructions: instructions.trim() || undefined,
      });

      if (departmentId) {
        await api.post(`/agents/${agentId}/assign-department`, {
          departmentId,
        });
      }

      router.push("/agents");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(
        e?.response?.data?.message ?? "Failed to provision and configure agent",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push("/agents")}
            className="text-zinc-500 hover:text-zinc-300 text-sm mb-4 flex items-center gap-1 transition-colors"
          >
            ← Back to Agents
          </button>
          <h1 className="text-2xl font-bold text-zinc-100">Provision Agent</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Add agents through your tier’s allowed choice slots. Fixed agents
            are managed by plan policy.
          </p>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-4">
          {WIZARD_STEPS.map((step, index) => {
            const isActive = index === stepIndex;
            const isComplete = index < stepIndex;
            return (
              <div
                key={step.id}
                className={`rounded-2xl border px-4 py-3 transition ${
                  isActive
                    ? "border-violet-500 bg-violet-950/40"
                    : isComplete
                      ? "border-emerald-800 bg-emerald-950/20"
                      : "border-zinc-800 bg-zinc-900"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Step {index + 1}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      isActive
                        ? "text-violet-300"
                        : isComplete
                          ? "text-emerald-300"
                          : "text-zinc-500"
                    }`}
                  >
                    {isComplete ? "Done" : isActive ? "Current" : "Pending"}
                  </span>
                </div>
                <div className="mt-2 text-sm font-semibold text-zinc-100">
                  {step.label}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {step.description}
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 min-h-[340px] flex flex-col gap-6">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">
              Loading provisioning options...
            </div>
          ) : !poolStatus ? (
            <div className="flex-1 flex flex-col justify-center gap-4">
              <div className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                {error || "Provisioning options are unavailable right now."}
              </div>
              <button
                onClick={() => void loadPoolStatus()}
                className="self-start px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SummaryCard label="Tier" value={poolStatus.tierName} />
                <SummaryCard
                  label="Fixed Agents"
                  value={`${poolStatus.filledFixed}/${poolStatus.totalFixed}`}
                />
                <SummaryCard
                  label="Choice Slots Open"
                  value={String(poolStatus.choiceRemaining)}
                />
              </div>

              <div className="rounded-xl border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
                Tenant admins can only provision agents from approved choice
                slots. Manual freeform agent creation is disabled under the tier
                policy model.
              </div>

              {currentStep.id === "policy" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-zinc-200">
                      Available Choice Slots
                    </h2>
                    <span className="text-xs text-zinc-500">
                      {poolStatus.totalChoice} total
                    </span>
                  </div>

                  {poolStatus.choiceSlots.length === 0 ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 px-4 py-4 text-sm text-zinc-400">
                      Your current tier has no optional agent slots. Contact an
                      administrator if you need additional agent capacity.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {poolStatus.choiceSlots.map((slot) => {
                        const isFilled = Boolean(slot.filledAgentId);
                        const isSelected = selectedSlotId === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() =>
                              !isFilled && applySlotDefaults(slot.id)
                            }
                            disabled={isFilled}
                            className={`w-full text-left rounded-xl border px-4 py-4 transition ${
                              isFilled
                                ? "border-zinc-800 bg-zinc-900/70 opacity-70 cursor-not-allowed"
                                : isSelected
                                  ? "border-violet-500 bg-violet-950/50"
                                  : "border-zinc-800 bg-zinc-800/40 hover:border-zinc-700"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-zinc-100">
                                    Slot {slot.slot}
                                  </span>
                                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                                    {slot.templateName}
                                  </span>
                                  {slot.isDefaultSelected && (
                                    <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-[11px] text-emerald-300">
                                      Default
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 text-xs text-zinc-500">
                                  {slot.defaultModel
                                    ? `Default model: ${slot.defaultModel}`
                                    : "Uses template defaults"}
                                  {slot.defaultBudgetPerDay
                                    ? ` · Budget: $${slot.defaultBudgetPerDay}/day`
                                    : ""}
                                </div>
                              </div>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  isFilled
                                    ? "bg-zinc-800 text-zinc-300"
                                    : "bg-sky-950 text-sky-300"
                                }`}
                              >
                                {isFilled
                                  ? `Filled by ${slot.filledAgentName}`
                                  : "Available"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {currentStep.id === "runtime" && (
                <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-800/30 p-4">
                  <h2 className="text-base font-semibold text-zinc-200">
                    Runtime Configuration
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm text-zinc-300">
                      <span>Agent Name</span>
                      <input
                        value={agentName}
                        onChange={(event) => setAgentName(event.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
                      />
                    </label>

                    <label className="space-y-2 text-sm text-zinc-300">
                      <span>Model</span>
                      <input
                        value={agentModel}
                        onChange={(event) => setAgentModel(event.target.value)}
                        placeholder={
                          selectedSlot?.defaultModel ?? "Template default"
                        }
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
                      />
                    </label>
                  </div>

                  <label className="block space-y-2 text-sm text-zinc-300">
                    <span>Budget Per Day</span>
                    <input
                      value={budgetPerDay}
                      onChange={(event) => setBudgetPerDay(event.target.value)}
                      placeholder={
                        selectedSlot?.defaultBudgetPerDay !== undefined
                          ? String(selectedSlot.defaultBudgetPerDay)
                          : "Template default"
                      }
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
                    />
                  </label>

                  <label className="block space-y-2 text-sm text-zinc-300">
                    <span>System Prompt</span>
                    <textarea
                      value={systemPrompt}
                      onChange={(event) => setSystemPrompt(event.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
                    />
                  </label>

                  <label className="block space-y-2 text-sm text-zinc-300">
                    <span>Instructions</span>
                    <textarea
                      value={instructions}
                      onChange={(event) => setInstructions(event.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
                    />
                  </label>
                </div>
              )}

              {currentStep.id === "assignment" && (
                <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-800/30 p-4">
                  <h2 className="text-base font-semibold text-zinc-200">
                    Department Assignment
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Place this live agent into a tenant-owned department now, or
                    leave it unassigned and move it later.
                  </p>
                  <label className="block space-y-2 text-sm text-zinc-300">
                    <span>Department</span>
                    <select
                      value={departmentId}
                      onChange={(event) => setDepartmentId(event.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
                    >
                      <option value="">No department assignment</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {currentStep.id === "review" && (
                <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-800/30 p-4">
                  <h2 className="text-base font-semibold text-zinc-200">
                    Provision Review
                  </h2>
                  {selectedSlot ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-500">Template</span>
                        <span className="text-zinc-200 font-medium">
                          {selectedSlot.templateName}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-500">Slot</span>
                        <span className="text-zinc-200 font-medium">
                          Choice Slot {selectedSlot.slot}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-500">Agent Name</span>
                        <span className="text-zinc-200 font-medium">
                          {agentName.trim()}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-500">Model</span>
                        <span className="text-zinc-200 font-medium">
                          {agentModel.trim() ||
                            selectedSlot.defaultModel ||
                            "Template default"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-500">Budget</span>
                        <span className="text-zinc-200 font-medium">
                          {budgetPerDay
                            ? `$${budgetPerDay}/day`
                            : selectedSlot.defaultBudgetPerDay
                              ? `$${selectedSlot.defaultBudgetPerDay}/day`
                              : "Template default"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-500">Department</span>
                        <span className="text-zinc-200 font-medium">
                          {departments.find(
                            (department) => department.id === departmentId,
                          )?.name ?? "Unassigned"}
                        </span>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-3 text-xs text-zinc-500">
                        Tier lineage, slot ownership, and selected status will
                        be recorded automatically when the live agent is
                        created.
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">
                      Select an open choice slot to provision an allowed agent
                      for this tenant.
                    </p>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex justify-between pt-2 mt-auto">
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      stepIndex === 0 ? router.push("/agents") : goBack()
                    }
                    className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    {stepIndex === 0 ? "Cancel" : "Back"}
                  </button>
                </div>
                {stepIndex < WIZARD_STEPS.length - 1 ? (
                  <button
                    onClick={goNext}
                    disabled={poolStatus.choiceSlots.length === 0}
                    className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    onClick={handleProvision}
                    disabled={!selectedSlot || saving}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
                  >
                    {saving ? "Provisioning…" : "Provision Agent"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </TenantShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-zinc-100">{value}</div>
    </div>
  );
}
