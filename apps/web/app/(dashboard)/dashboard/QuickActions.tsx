"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Plus, UserPlus, BookOpen, Command, ChevronRight,
  Zap, MessageSquare,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useInviteModalStore } from "@/store/invite-modal";
import { CreateBoardModal } from "@/components/CreateBoardModal";

export function QuickActions() {
  const { user } = useAuth();
  const { open: openInvite } = useInviteModalStore();
  const [createBoardOpen, setCreateBoardOpen] = useState(false);

  const firstWorkspaceId = user?.workspaceMemberships?.[0]?.workspace?.id;

  return (
    <>
      {/* Quick Actions panel */}
      <div className="space-y-4">
        {/* Actions card */}
        <div className="rounded-2xl border bg-background shadow-sm">
          <div className="border-b px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
                <Zap className="h-4 w-4 text-indigo-600" />
              </div>
              <h3 className="text-sm font-semibold">Quick Actions</h3>
            </div>
          </div>

          <div className="divide-y">
            <ActionButton
              icon={<Plus className="h-4 w-4 text-indigo-600" />}
              iconBg="bg-indigo-100"
              label="Create new board"
              sublabel="Start a new project board"
              disabled={!firstWorkspaceId}
              onClick={() => firstWorkspaceId && setCreateBoardOpen(true)}
            />

            <ActionButton
              icon={<UserPlus className="h-4 w-4 text-emerald-600" />}
              iconBg="bg-emerald-100"
              label="Invite team member"
              sublabel="Add someone to your workspace"
              onClick={openInvite}
            />

            <ActionButton
              icon={<Command className="h-4 w-4 text-violet-600" />}
              iconBg="bg-violet-100"
              label="Command palette"
              sublabel="Search anything fast"
              shortcut="⌘K"
              onClick={() =>
                window.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
                )
              }
            />
          </div>
        </div>

        {/* Resources card */}
        <div className="rounded-2xl border bg-background shadow-sm">
          <div className="border-b px-5 py-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Resources</h3>
          </div>

          <div className="divide-y">
            <LinkAction
              href="/help"
              icon={<BookOpen className="h-4 w-4 text-blue-600" />}
              iconBg="bg-blue-100"
              label="Help & Guide"
              sublabel="Docs, tour & shortcuts"
            />
            {user?.workspaceMemberships?.[0] && (
              <LinkAction
                href={`/workspace/${firstWorkspaceId}/chat`}
                icon={<MessageSquare className="h-4 w-4 text-fuchsia-600" />}
                iconBg="bg-fuchsia-100"
                label="Team Chat"
                sublabel="Message your workspace"
              />
            )}
          </div>
        </div>

        {/* Tip card */}
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">Pro tip</p>
          <p className="mt-1 text-sm font-medium text-indigo-900">
            Press <kbd className="rounded bg-indigo-100 px-1.5 py-0.5 font-mono text-xs text-indigo-700">⌘K</kbd> anywhere to search boards, workspaces, and actions instantly.
          </p>
        </div>
      </div>

      {/* Create Board Modal */}
      {firstWorkspaceId && (
        <CreateBoardModal
          isOpen={createBoardOpen}
          onClose={() => setCreateBoardOpen(false)}
          workspaceId={firstWorkspaceId}
        />
      )}
    </>
  );
}

function ActionButton({
  icon, iconBg, label, sublabel, disabled, onClick, shortcut,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  sublabel: string;
  disabled?: boolean;
  onClick: () => void;
  shortcut?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-muted/50 disabled:opacity-40"
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      </div>
      {shortcut ? (
        <kbd className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          {shortcut}
        </kbd>
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

function LinkAction({
  href, icon, iconBg, label, sublabel,
}: {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  sublabel: string;
}) {
  return (
    <Link
      href={href}
      className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-muted/50"
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
