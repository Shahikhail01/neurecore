"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTenantAuth } from "@/hooks/useTenantAuth";
import TenantShell from "@/components/TenantShell";
import api from "@/services/api";

type WizardStepId = "policy" | "structure" | "leadership" | "review";

interface DepartmentPoolSlot {
  id: string;
  departmentTemplateId: string;
  templateName: string;
  slot: number;
  slotType: "FIXED" | "CHOICE";
  isRequired: boolean;
  isDefaultSelected: boolean;
  filledDepartmentId?: string;
  filledDepartmentName?: string;
}

interface TenantDepartmentPoolStatus {
  tenantId: string;
  tierId: string;
  tierName: string;
  tierSlug: string;
  fixedSlots: DepartmentPoolSlot[];
  choiceSlots: DepartmentPoolSlot[];
  totalFixed: number;
  totalChoice: number;
  filledFixed: number;
  filledChoice: number;
  choiceRemaining: number;
  canAddMoreChoiceDepartments: boolean;
  isAtLimit: boolean;
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface AgentOption {
  id: string;
  name: string;
  status?: string;
}

const WIZARD_STEPS: Array<{
  id: WizardStepId;
  label: string;
  description: string;
}> = [
  {
    id: "policy",
    label: "Policy Slot",
    description: "Choose an approved department slot from your tier.",
  },
  {
    id: "structure",
    label: "Structure",
    description: "Set the live department name, description, and parent.",
  },
  {
    id: "leadership",
    label: "Leadership",
    description: "Assign a head agent or leave leadership open for later.",
  },
  {
    id: "review",
    label: "Review",
    description: "Confirm lineage and operational setup before provisioning.",
  },
];

export default function NewDepartmentPage() {
  const user = useTenantAuth();
  const router = useRouter();

  const [poolStatus, setPoolStatus] =
    useState<TenantDepartmentPoolStatus | null>(null);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [headAgentId, setHeadAgentId] = useState("");

  async function loadProvisioningData() {
    setLoading(true);
    setError("");
    try {
      const [statusRes, departmentsRes, agentsRes] = await Promise.all([
        api.get("/tiers/pool/status/departments"),
        api.get("/departments?limit=100"),
        api.get("/agents?limit=200"),
      ]);

      const status = (statusRes.data?.data ??
        statusRes.data) as TenantDepartmentPoolStatus;
      const existingDepartments =
        ((departmentsRes.data?.data ??
          departmentsRes.data) as DepartmentOption[]) ?? [];
      const tenantAgents =
        ((agentsRes.data?.data ?? agentsRes.data) as AgentOption[]) ?? [];
      const firstAvailableSlot = status.choiceSlots.find(
        (slot) => !slot.filledDepartmentId,
      );

      setPoolStatus(status);
      setDepartments(existingDepartments);
      setAgents(tenantAgents);
      setSelectedSlotId(firstAvailableSlot?.id ?? "");
      setName(firstAvailableSlot?.templateName ?? "");
      setDescription("");
      setParentId("");
      setHeadAgentId("");
      setStepIndex(0);
    } catch (err: unknown) {
      const response = err as { response?: { data?: { message?: string } } };
      setError(
        response?.response?.data?.message ??
          "Failed to load department provisioning options",
      );
      setPoolStatus(null);
      setDepartments([]);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProvisioningData();
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
    setName(slot.templateName);
    setDescription("");
    setParentId("");
    setHeadAgentId("");
    setError("");
  }

  function validateStep(index: number) {
    if (index === 0 && !selectedSlotId) {
      setError("Select an available choice slot first");
      return false;
    }

    if (index === 1 && !name.trim()) {
      setError("Department name is required");
      return false;
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

  async function handleProvision() {
    if (!validateStep(1) || !selectedSlotId) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await api.post("/tiers/pool/provision-department-slot", {
        slotId: selectedSlotId,
        name: name.trim(),
        description: description.trim() || undefined,
        parentId: parentId || undefined,
        headAgentId: headAgentId || undefined,
      });
      router.push("/departments");
    } catch (err: unknown) {
      const response = err as { response?: { data?: { message?: string } } };
      setError(
        response?.response?.data?.message ?? "Failed to provision department",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push("/departments")}
            className="text-zinc-500 hover:text-zinc-300 text-sm mb-4 flex items-center gap-1 transition-colors"
          >
            ← Back to Departments
          </button>
          <h1 className="text-2xl font-bold text-zinc-100">
            Provision Department
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Add optional departments from your tier’s approved choice slots and
            set basic operational details during provisioning.
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

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 min-h-[420px] flex flex-col gap-6">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">
              Loading department provisioning options...
            </div>
          ) : !poolStatus ? (
            <div className="flex-1 flex flex-col justify-center gap-4">
              <div className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                {error || "Provisioning options are unavailable right now."}
              </div>
              <button
                onClick={() => void loadProvisioningData()}
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
                  label="Fixed Departments"
                  value={`${poolStatus.filledFixed}/${poolStatus.totalFixed}`}
                />
                <SummaryCard
                  label="Choice Slots Open"
                  value={String(poolStatus.choiceRemaining)}
                />
              </div>

              <div className="rounded-xl border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
                Tenant admins can only provision departments from approved
                choice slots. Fixed departments remain controlled by tier
                policy.
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
                      Your current tier has no optional department slots.
                      Contact an administrator if you need additional
                      operational structure.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {poolStatus.choiceSlots.map((slot) => {
                        const isFilled = Boolean(slot.filledDepartmentId);
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
                                  Provision one tenant-owned live department
                                  from this approved slot.
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
                                  ? `Filled by ${slot.filledDepartmentName}`
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

              {currentStep.id === "structure" && (
                <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-800/30 p-4">
                  <h2 className="text-base font-semibold text-zinc-200">
                    Department Structure
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm text-zinc-300">
                      <span>Department Name</span>
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
                      />
                    </label>

                    <label className="space-y-2 text-sm text-zinc-300">
                      <span>Parent Department</span>
                      <select
                        value={parentId}
                        onChange={(event) => setParentId(event.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
                      >
                        <option value="">No parent</option>
                        {departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block space-y-2 text-sm text-zinc-300">
                    <span>Description</span>
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
                    />
                  </label>
                </div>
              )}

              {currentStep.id === "leadership" && (
                <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-800/30 p-4">
                  <h2 className="text-base font-semibold text-zinc-200">
                    Leadership Setup
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Optionally assign a current tenant-owned agent as department
                    head. You can leave this blank and come back later.
                  </p>
                  <label className="block space-y-2 text-sm text-zinc-300">
                    <span>Head Agent</span>
                    <select
                      value={headAgentId}
                      onChange={(event) => setHeadAgentId(event.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
                    >
                      <option value="">No head agent</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                          {agent.status ? ` · ${agent.status}` : ""}
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
                        <span className="text-zinc-500">Department Name</span>
                        <span className="text-zinc-200 font-medium">
                          {name.trim() || "Required"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-500">Parent</span>
                        <span className="text-zinc-200 font-medium">
                          {departments.find(
                            (department) => department.id === parentId,
                          )?.name ?? "No parent"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-500">Head Agent</span>
                        <span className="text-zinc-200 font-medium">
                          {agents.find((agent) => agent.id === headAgentId)
                            ?.name ?? "No head agent"}
                        </span>
                      </div>
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-3 text-xs text-zinc-500">
                        Tier lineage, slot ownership, and selected status will
                        be recorded automatically when the live department is
                        created.
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">
                      Select an open choice slot to provision an approved
                      department for this tenant.
                    </p>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex justify-between pt-2 mt-auto">
                <button
                  onClick={() =>
                    stepIndex === 0 ? router.push("/departments") : goBack()
                  }
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  {stepIndex === 0 ? "Cancel" : "Back"}
                </button>
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
                    onClick={() => void handleProvision()}
                    disabled={!selectedSlot || saving || !name.trim()}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
                  >
                    {saving ? "Provisioning…" : "Provision Department"}
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
