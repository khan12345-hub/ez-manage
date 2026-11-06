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
import { motion, type Variants } from "framer-motion";

const panel: Variants = {
  hidden: { opacity: 0, x: 18 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const CARD_STYLE = {
  border: "1px solid rgba(4,120,87,0.1)",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

const HEADER_BORDER = { borderBottom: "1px solid rgba(4,120,87,0.07)" };

export function QuickActions() {
  const { user } = useAuth();
  const { open: openInvite } = useInviteModalStore();
  const [createBoardOpen, setCreateBoardOpen] = useState(false);

  const firstWorkspaceId = user?.workspaceMemberships?.[0]?.workspace?.id;
  const firstWorkspaceUid =
    (user?.workspaceMemberships?.[0]?.workspace as any)?.uid ?? firstWorkspaceId;

  return (
    <>
      <motion.div variants={panel} initial="hidden" animate="show" className="space-y-4">
        {/* Quick Actions card */}
        <div className="overflow-hidden rounded-2xl bg-card" style={CARD_STYLE}>
          <div className="px-5 py-4" style={HEADER_BORDER}>
            <div className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: "rgba(4,120,87,0.1)" }}
              >
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-serif text-[19px] font-normal leading-none text-foreground">Quick Actions</h3>
            </div>
          </div>

          <div className="divide-y" style={{ borderColor: "rgba(4,120,87,0.07)" }}>
            <ActionButton
              icon={<Plus className="h-4 w-4 text-primary" />}
              iconBg="bg-primary/10"
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
        <div className="overflow-hidden rounded-2xl bg-card" style={CARD_STYLE}>
          <div className="px-5 py-4" style={HEADER_BORDER}>
            <h3 className="text-sm font-semibold text-muted-foreground">Resources</h3>
          </div>

          <div className="divide-y" style={{ borderColor: "rgba(4,120,87,0.07)" }}>
            <LinkAction
              href="/help"
              icon={<BookOpen className="h-4 w-4 text-blue-600" />}
              iconBg="bg-blue-100"
              label="Help & Guide"
              sublabel="Docs, tour & shortcuts"
            />
            {user?.workspaceMemberships?.[0] && (
              <LinkAction
                href={`/workspace/${firstWorkspaceUid}/chat`}
                icon={<MessageSquare className="h-4 w-4 text-fuchsia-600" />}
                iconBg="bg-fuchsia-100"
                label="Team Chat"
                sublabel="Message your workspace"
              />
            )}
          </div>
        </div>

        {/* Pro tip */}
        <div
          className="rounded-2xl border border-primary/20 bg-accent/60 p-4"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            Pro tip
          </p>
          <p className="mt-1 text-sm font-medium text-primary">
            Press{" "}
            <kbd className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">
              ⌘K
            </kbd>{" "}
            anywhere to search boards, workspaces, and actions instantly.
          </p>
        </div>
      </motion.div>

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
  icon,
  iconBg,
  label,
  sublabel,
  disabled,
  onClick,
  shortcut,
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
      className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-accent disabled:opacity-40"
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg} dark:bg-white/[0.06] dark:ring-1 dark:ring-white/10`}
      >
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
  href,
  icon,
  iconBg,
  label,
  sublabel,
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
      className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-accent"
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg} dark:bg-white/[0.06] dark:ring-1 dark:ring-white/10`}
      >
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
