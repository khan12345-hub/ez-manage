"use client";

import { UserPlus, Users, Info } from "lucide-react";
import type { UserToCreate, WorkspaceRole, BoardRole } from "./excelImport.types";

interface PeopleResolutionStepProps {
  users: UserToCreate[];
  onChange: (users: UserToCreate[]) => void;
  disabled?: boolean;
}

const WS_ROLES: WorkspaceRole[] = ["MEMBER", "VIEWER", "ADMIN", "GUEST"];
const BOARD_ROLES: BoardRole[] = ["MEMBER", "VIEWER"];

export function PeopleResolutionStep({
  users,
  onChange,
  disabled = false,
}: PeopleResolutionStepProps) {
  if (!users.length) return null;

  const includedCount = users.filter((u) => u.include && u.email.trim() && u.firstName.trim()).length;

  function update(index: number, patch: Partial<UserToCreate>) {
    onChange(users.map((u, i) => (i === index ? { ...u, ...patch } : u)));
  }

  function toggleAll(checked: boolean) {
    onChange(users.map((u) => ({ ...u, include: checked })));
  }

  const allChecked = users.length > 0 && users.every((u) => u.include);

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-border px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
          <Users className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            People found in sheet
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {users.length} unique {users.length === 1 ? "person" : "people"} detected in assignee columns.
            Check the ones you want to create as new users — they&apos;ll be added to this workspace and board automatically.
          </p>
        </div>
        {includedCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
            <UserPlus className="h-3.5 w-3.5" />
            {includedCount} to create
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 border-b border-border bg-muted/30 px-5 py-2.5">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Users are created with a random password. They can sign in and change it via{" "}
          <span className="font-medium text-foreground">Forgot Password</span>.
          If a user with that email already exists they won&apos;t be duplicated — they&apos;ll simply be added to the board.
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="px-4 py-2.5 text-left">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(e) => toggleAll(e.target.checked)}
                  disabled={disabled}
                  className="h-3.5 w-3.5 rounded border-border accent-indigo-600"
                  aria-label="Select all"
                />
              </th>
              <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-muted-foreground">
                Name in sheet
              </th>
              <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-muted-foreground">
                First name
              </th>
              <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-muted-foreground">
                Last name
              </th>
              <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-muted-foreground">
                Email <span className="text-red-500">*</span>
              </th>
              <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-muted-foreground">
                Workspace role
              </th>
              <th className="px-3 py-2.5 text-left font-semibold uppercase tracking-wide text-muted-foreground">
                Board role
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => {
              const needsEmail = user.include && !user.email.trim();
              const needsName = user.include && !user.firstName.trim();
              const hasError = needsEmail || needsName;
              return (
                <tr
                  key={user.rawName}
                  className={`border-b border-border last:border-0 transition-colors ${
                    user.include
                      ? "bg-indigo-50/40 dark:bg-indigo-950/10"
                      : "opacity-60 hover:opacity-80"
                  }`}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={user.include}
                      onChange={(e) => update(i, { include: e.target.checked })}
                      disabled={disabled}
                      className="h-3.5 w-3.5 rounded border-border accent-indigo-600"
                    />
                  </td>

                  {/* Raw name badge */}
                  <td className="px-3 py-2.5">
                    <span className="inline-flex max-w-[140px] truncate rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">
                      {user.rawName}
                    </span>
                  </td>

                  {/* First name */}
                  <td className="px-3 py-2.5">
                    <input
                      type="text"
                      value={user.firstName}
                      onChange={(e) => update(i, { firstName: e.target.value })}
                      disabled={disabled || !user.include}
                      placeholder="First"
                      className={`h-7 w-28 rounded-md border bg-background px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                        needsName ? "border-red-400 focus:ring-red-400" : "border-border"
                      }`}
                    />
                  </td>

                  {/* Last name */}
                  <td className="px-3 py-2.5">
                    <input
                      type="text"
                      value={user.lastName}
                      onChange={(e) => update(i, { lastName: e.target.value })}
                      disabled={disabled || !user.include}
                      placeholder="Last"
                      className="h-7 w-24 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </td>

                  {/* Email */}
                  <td className="px-3 py-2.5">
                    <input
                      type="email"
                      value={user.email}
                      onChange={(e) => update(i, { email: e.target.value })}
                      disabled={disabled || !user.include}
                      placeholder="user@company.com"
                      className={`h-7 w-48 rounded-md border bg-background px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                        needsEmail ? "border-red-400 focus:ring-red-400" : "border-border"
                      }`}
                    />
                    {needsEmail && (
                      <p className="mt-0.5 text-[10px] text-red-500">Required</p>
                    )}
                  </td>

                  {/* Workspace role */}
                  <td className="px-3 py-2.5">
                    <select
                      value={user.workspaceRole}
                      onChange={(e) => update(i, { workspaceRole: e.target.value as WorkspaceRole })}
                      disabled={disabled || !user.include}
                      className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {WS_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.charAt(0) + r.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Board role */}
                  <td className="px-3 py-2.5">
                    <select
                      value={user.boardRole}
                      onChange={(e) => update(i, { boardRole: e.target.value as BoardRole })}
                      disabled={disabled || !user.include}
                      className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {BOARD_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.charAt(0) + r.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer hint */}
      {users.some((u) => u.include) && (
        <div className="border-t border-border bg-muted/20 px-5 py-2.5 text-xs text-muted-foreground">
          Unchecked people are still imported as task assignees if they already exist in the system.
        </div>
      )}
    </div>
  );
}
