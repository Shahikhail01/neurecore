"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { onboardingApi } from "@/services/onboarding.service";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { UserRole, USER_ROLE_OPTIONS } from "@/types/onboarding.types";

interface TeamStepProps {
  onSubmit?: (data: { emails: string[] }) => void;
  onSkip?: () => void;
}

interface MemberRow {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  departmentId: string;
}

export function TeamStep({ onSubmit, onSkip }: TeamStepProps) {
  const { wizardId, departments, setInvitationsData } = useOnboardingStore();
  const defaultDeptId = departments?.[0]?.id ?? "";

  const [members, setMembers] = useState<MemberRow[]>([
    {
      email: "",
      firstName: "",
      lastName: "",
      role: UserRole.VIEWER,
      departmentId: defaultDeptId,
    },
  ]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const addRow = () =>
    setMembers((prev) => [
      ...prev,
      {
        email: "",
        firstName: "",
        lastName: "",
        role: UserRole.VIEWER,
        departmentId: defaultDeptId,
      },
    ]);

  const removeRow = (i: number) =>
    setMembers((prev) => prev.filter((_, idx) => idx !== i));

  const updateRow = (i: number, field: keyof MemberRow, value: string) =>
    setMembers((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)),
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = members.filter(
      (m) => m.email.trim() && m.firstName.trim() && m.lastName.trim(),
    );

    if (valid.length === 0) {
      onSkip?.();
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      if (!wizardId) throw new Error("No wizard session");

      const invitations = valid.map((m) => ({
        email: m.email.trim(),
        firstName: m.firstName.trim(),
        lastName: m.lastName.trim(),
        role: m.role,
        departmentId: m.departmentId || defaultDeptId,
      }));

      const result = await onboardingApi.inviteUsers({ wizardId, invitations });
      setInvitationsData(
        invitations.map((inv) => ({
          email: inv.email,
          firstName: inv.firstName,
          lastName: inv.lastName,
          role: inv.role as UserRole,
          departmentId: inv.departmentId,
        })),
      );
      onSubmit?.({ emails: result.invitations.map((i) => i.email) });
    } catch (err) {
      // If tenant not yet created (skipped departments), store locally and continue
      const msg =
        err instanceof Error ? err.message : "Failed to send invitations";
      if (msg.includes("Tenant not found") || msg.includes("not found")) {
        const valid2 = members.filter(
          (m) => m.email.trim() && m.firstName.trim() && m.lastName.trim(),
        );
        setInvitationsData(
          valid2.map((m) => ({
            email: m.email.trim(),
            firstName: m.firstName.trim(),
            lastName: m.lastName.trim(),
            role: m.role,
            departmentId: m.departmentId,
          })),
        );
        onSubmit?.({ emails: valid2.map((m) => m.email) });
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-zinc-700 bg-zinc-800/70 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50";
  const selectCls =
    "w-full rounded-xl border border-zinc-700 bg-zinc-800/70 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 max-w-3xl mx-auto shadow-xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-1">
          Invite Your Team
        </h2>
        <p className="text-sm text-zinc-400">
          Add team members who will work with your AI agents (optional)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {members.map((member, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-start">
            {/* Email */}
            <div className="col-span-4">
              {i === 0 && <p className="text-xs text-zinc-500 mb-1">Email *</p>}
              <input
                type="email"
                value={member.email}
                onChange={(e) => updateRow(i, "email", e.target.value)}
                placeholder="colleague@company.com"
                className={inputCls}
              />
            </div>
            {/* First name */}
            <div className="col-span-2">
              {i === 0 && <p className="text-xs text-zinc-500 mb-1">First *</p>}
              <input
                type="text"
                value={member.firstName}
                onChange={(e) => updateRow(i, "firstName", e.target.value)}
                placeholder="Jane"
                className={inputCls}
              />
            </div>
            {/* Last name */}
            <div className="col-span-2">
              {i === 0 && <p className="text-xs text-zinc-500 mb-1">Last *</p>}
              <input
                type="text"
                value={member.lastName}
                onChange={(e) => updateRow(i, "lastName", e.target.value)}
                placeholder="Doe"
                className={inputCls}
              />
            </div>
            {/* Role */}
            <div className="col-span-2">
              {i === 0 && <p className="text-xs text-zinc-500 mb-1">Role</p>}
              <select
                value={member.role}
                onChange={(e) => updateRow(i, "role", e.target.value)}
                className={selectCls}
              >
                {USER_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Department */}
            {departments.length > 0 && (
              <div className="col-span-1">
                {i === 0 && <p className="text-xs text-zinc-500 mb-1">Dept</p>}
                <select
                  value={member.departmentId}
                  onChange={(e) => updateRow(i, "departmentId", e.target.value)}
                  className={selectCls}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* Remove */}
            <div
              className={`col-span-1 flex items-${i === 0 ? "end pb-0.5" : "start pt-0"}`}
            >
              {i === 0 && (
                <p className="text-xs text-zinc-500 mb-1 opacity-0">X</p>
              )}
              {members.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="p-2 text-zinc-600 hover:text-red-400 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition mt-1"
        >
          <Plus className="w-4 h-4" /> Add another member
        </button>

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            {error}
          </div>
        )}

        <div className="flex justify-between pt-2">
          <button
            type="button"
            onClick={onSkip}
            disabled={isLoading}
            className="px-5 py-2 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:border-zinc-600 hover:text-zinc-300 transition"
          >
            Skip
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Inviting…
              </>
            ) : (
              "Send Invites →"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
