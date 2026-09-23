"use client";

import { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import {
  LayoutGrid, Plus, Trash2, UserPlus, Users, Shield, Eye,
  CheckSquare, MessageSquare, Paperclip, Bell, Clock,
  Settings, FolderOpen, List, Tag, AtSign, ChevronRight,
  ChevronLeft, Zap, FileText, Search, Download, History,
  WrapText, X, BookOpen, Rocket,
} from "lucide-react";

// ─── Wizard Steps ─────────────────────────────────────────────────────────────

const USER_STEPS = [
  {
    emoji: "👋",
    label: "Welcome",
    title: "Welcome to EzManage",
    body: "EzManage helps your team manage projects in one place. You'll work inside Workspaces → Boards → Tasks. This guide walks you through it step by step.",
    tip: "Everything starts from the sidebar on the left side.",
  },
  {
    emoji: "🏠",
    label: "Dashboard",
    title: "Your Dashboard",
    body: "When you log in, you land on the Dashboard. Here you can see all the Workspaces you are a member of. Click any workspace card to open it.",
    tip: "Use the Workspace Switcher (top-left of sidebar) to jump between workspaces quickly.",
  },
  {
    emoji: "📋",
    label: "Boards",
    title: "Navigate to a Board",
    body: "Inside a workspace, the sidebar shows all your boards. Click any board name to open it. Boards have columns for status, priority, assignee, dates, and more.",
    tip: "Each board has Groups — think of them as sections like 'To Do', 'In Progress', 'Done'.",
  },
  {
    emoji: "✅",
    label: "First Task",
    title: "Create Your First Task",
    body: "Inside a board, click the '+ Add' button at the bottom of any group. Type a task name and press Enter. Your task is created instantly.",
    tip: "You can drag tasks between groups to move them to a different section.",
  },
  {
    emoji: "🔍",
    label: "Task Details",
    title: "Open Task Details",
    body: "Click any task name to open its full detail panel. Here you can assign it to a teammate, set priority, add a due date, write a description, and add subtasks.",
    tip: "The Activity Log at the bottom shows every change made to the task — who did what and when.",
  },
  {
    emoji: "💬",
    label: "Collaborate",
    title: "Comments & Mentions",
    body: "In the task detail panel, scroll to Comments. Type your update and press Send. Use @name to mention a teammate — they will get an instant notification.",
    tip: "You can attach files directly inside comments — images, PDFs, videos, and more.",
  },
  {
    emoji: "🔔",
    label: "Notifications",
    title: "Stay Updated",
    body: "The bell icon in the top-right corner shows all your notifications — when you are assigned a task, mentioned in a comment, or added to a workspace.",
    tip: "Click any notification to go directly to the relevant task or workspace.",
  },
  {
    emoji: "🎉",
    label: "All Done!",
    title: "You're all set!",
    body: "You now know the basics of EzManage. Explore the reference guide below to discover more features — files, documents, time tracking, board search, and more.",
    tip: "Scroll down to see everything you can do inside EzManage.",
  },
];

const ADMIN_STEPS = [
  {
    emoji: "🏗️",
    label: "Workspace",
    title: "Create a Workspace",
    body: "Click the '+' button in the sidebar (top area) and select 'Create Workspace'. Give it a name — this becomes your team's main container for all boards and members.",
    tip: "One workspace per team or department usually works best.",
  },
  {
    emoji: "👥",
    label: "Invite Team",
    title: "Invite Your Team Members",
    body: "Open the workspace, then click the member count or the Members button. Click 'Invite Member', enter their email, choose a role and select which boards to add them to, then click Invite.",
    tip: "New users will receive an email with a link to set up their password. Existing users are added directly.",
  },
  {
    emoji: "📊",
    label: "Create Board",
    title: "Create Your First Board",
    body: "Inside a workspace, click '+' → 'Create Board'. Name it and choose visibility: Public (all workspace members) or Private (invite only). Then add groups like 'To Do', 'In Progress', 'Done'.",
    tip: "Start with one board and a few groups. You can add more boards and columns later.",
  },
  {
    emoji: "🏷️",
    label: "Roles",
    title: "Assign the Right Roles",
    body: "When inviting members, choose the right role: Owner has full control, Admin can manage boards and members, Member can create and edit tasks, Viewer is read-only, Guest gets access to specific groups only.",
    tip: "You can change a member's role later by opening the workspace Members panel.",
  },
  {
    emoji: "⚡",
    label: "Automation",
    title: "Set Up Automation (Optional)",
    body: "Inside a board, open the Automation panel. Create rules like 'When status changes to Done → notify assignee'. Automation saves your team from repetitive manual work.",
    tip: "Start with one or two simple rules before building complex automations.",
  },
  {
    emoji: "📝",
    label: "Forms",
    title: "Create a Board Form (Optional)",
    body: "Board Forms let external people (or anyone without a login) submit tasks directly into your board. Open the Form panel inside a board, create a form, and share the public link.",
    tip: "Great for collecting requests, support tickets, or feedback without giving board access.",
  },
  {
    emoji: "🎉",
    label: "All Done!",
    title: "Your workspace is ready!",
    body: "You've set up a workspace, invited your team, and created boards. Share the workspace link with your team and start adding tasks together.",
    tip: "Scroll down to see the full Admin capabilities reference guide.",
  },
];

// ─── Wizard Component ─────────────────────────────────────────────────────────

type Track = "user" | "admin";

function Wizard({ onClose, isSuperAdmin }: { onClose: () => void; isSuperAdmin: boolean }) {
  const [track, setTrack] = useState<Track | null>(null);
  const [step, setStep] = useState(0);

  const steps = track === "admin" ? ADMIN_STEPS : USER_STEPS;
  const current = steps[step];
  const progress = ((step + 1) / steps.length) * 100;

  if (!track) {
    return (
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">Interactive Guide</p>
            <h2 className="text-lg font-bold text-gray-900">Where would you like to start?</h2>
            <p className="text-sm text-gray-500 mt-1">Choose a guide and we'll walk you through it step by step.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={`grid gap-4 mt-5 ${isSuperAdmin ? "sm:grid-cols-2" : ""}`}>
          <button
            onClick={() => { setTrack("user"); setStep(0); }}
            className="flex items-start gap-4 rounded-xl border-2 border-gray-100 bg-white p-4 text-left hover:border-indigo-300 hover:shadow-md transition-all duration-200 group"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-teal-50 text-xl">
              👤
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm group-hover:text-indigo-700">I'm a Team Member</p>
              <p className="text-xs text-gray-500 mt-0.5">Learn how to use boards, create tasks, and collaborate with your team.</p>
              <p className="text-xs text-indigo-500 font-medium mt-2">{USER_STEPS.length} steps →</p>
            </div>
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => { setTrack("admin"); setStep(0); }}
              className="flex items-start gap-4 rounded-xl border-2 border-gray-100 bg-white p-4 text-left hover:border-indigo-300 hover:shadow-md transition-all duration-200 group"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl">
                🛠️
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm group-hover:text-indigo-700">I'm an Admin / Owner</p>
                <p className="text-xs text-gray-500 mt-0.5">Set up workspaces, invite members, create boards, and configure automation.</p>
                <p className="text-xs text-indigo-500 font-medium mt-2">{ADMIN_STEPS.length} steps →</p>
              </div>
            </button>
          )}
        </div>
      </div>
    );
  }

  const isLast = step === steps.length - 1;

  return (
    <div className="rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-indigo-500 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`transition-all duration-200 rounded-full ${
                  i === step
                    ? "w-5 h-2 bg-indigo-500"
                    : i < step
                    ? "w-2 h-2 bg-indigo-300"
                    : "w-2 h-2 bg-gray-200"
                }`}
                aria-label={steps[i].label}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Step {step + 1} of {steps.length}</span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Step content */}
        <div className="flex gap-5">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gray-50 text-3xl">
            {current.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 mb-1">{current.label}</p>
            <h3 className="text-base font-bold text-gray-900 leading-tight">{current.title}</h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">{current.body}</p>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
              <span className="text-sm flex-shrink-0">💡</span>
              <p className="text-xs text-amber-800 leading-snug">{current.tip}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
          <button
            onClick={() => step > 0 ? setStep(step - 1) : setTrack(null)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 0 ? "Change guide" : "Previous"}
          </button>

          {isLast ? (
            <button
              onClick={onClose}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              Finish 🎉
            </button>
          ) : (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reference Sections ───────────────────────────────────────────────────────

const WORKSPACE_ADMIN_SECTIONS = [
  {
    title: "Workspaces",
    icon: FolderOpen,
    color: "text-blue-600",
    bg: "bg-blue-50",
    items: [
      { icon: Plus,       text: "Create a new workspace" },
      { icon: LayoutGrid, text: "View all workspaces on the Dashboard" },
      { icon: Trash2,     text: "Delete a workspace — removes all boards & data inside" },
    ],
  },
  {
    title: "Team Members",
    icon: Users,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    items: [
      { icon: UserPlus, text: "Invite new or existing users by email" },
      { icon: Shield,   text: "Set member roles — Owner, Admin, Member, Viewer, Guest" },
      { icon: Eye,      text: "View all members & pending invitations" },
      { icon: Trash2,   text: "Remove members from a workspace" },
    ],
  },
  {
    title: "Boards",
    icon: LayoutGrid,
    color: "text-violet-600",
    bg: "bg-violet-50",
    items: [
      { icon: Plus,     text: "Create boards inside a workspace" },
      { icon: List,     text: "Add and manage groups (sections) inside a board" },
      { icon: Trash2,   text: "Delete boards" },
      { icon: Download, text: "Import a board from an Excel file" },
      { icon: Shield,   text: "Set board visibility — Public or Private" },
    ],
  },
  {
    title: "Automation",
    icon: Zap,
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    items: [
      { icon: Zap, text: "Create automation rules — e.g. auto-assign when status changes" },
      { icon: Zap, text: "Trigger actions based on task field changes" },
      { icon: Eye, text: "Manage and disable existing automations" },
    ],
  },
  {
    title: "Board Forms",
    icon: WrapText,
    color: "text-pink-600",
    bg: "bg-pink-50",
    items: [
      { icon: WrapText, text: "Create public forms that add tasks to a board automatically" },
      { icon: Eye,      text: "Share form link with anyone — no login required to submit" },
      { icon: List,     text: "Map form fields to board columns" },
    ],
  },
];

const SUPER_ADMIN_SECTIONS = [
  {
    title: "System Settings",
    icon: Settings,
    color: "text-slate-600",
    bg: "bg-slate-100",
    items: [
      { icon: Users,  text: "View and manage all users in the system" },
      { icon: Plus,   text: "Add new users directly — no invitation needed" },
      { icon: Shield, text: "Change any user's system role (User / Super Admin)" },
      { icon: Trash2, text: "Delete users from the system" },
      { icon: Eye,    text: "View all workspaces, boards, and media files" },
    ],
  },
];

const USER_SECTIONS = [
  {
    title: "Workspaces & Boards",
    icon: FolderOpen,
    color: "text-teal-600",
    bg: "bg-teal-50",
    items: [
      { icon: LayoutGrid, text: "View workspaces you are a member of" },
      { icon: Eye,        text: "Open boards you have been given access to" },
      { icon: Search,     text: "Search tasks across the board using the search bar" },
    ],
  },
  {
    title: "Tasks",
    icon: CheckSquare,
    color: "text-green-600",
    bg: "bg-green-50",
    items: [
      { icon: Plus,        text: "Create new tasks inside a board" },
      { icon: CheckSquare, text: "Update task status (To Do, In Progress, Done, etc.)" },
      { icon: UserPlus,    text: "Assign yourself or teammates to a task" },
      { icon: Tag,         text: "Set priority, timeline, and other custom fields" },
      { icon: List,        text: "Add subtasks under a main task" },
      { icon: Clock,       text: "Start and stop time tracking on a task" },
      { icon: History,     text: "View full activity log of a task — who did what and when" },
    ],
  },
  {
    title: "Comments & Mentions",
    icon: MessageSquare,
    color: "text-amber-600",
    bg: "bg-amber-50",
    items: [
      { icon: MessageSquare, text: "Add comments and updates on tasks" },
      { icon: AtSign,        text: "Mention a teammate with @name to notify them instantly" },
      { icon: MessageSquare, text: "Reply to comments in thread" },
      { icon: Paperclip,     text: "Attach files inside comments" },
    ],
  },
  {
    title: "Files",
    icon: Paperclip,
    color: "text-orange-600",
    bg: "bg-orange-50",
    items: [
      { icon: Paperclip, text: "Upload files — images, PDFs, Excel, video, audio" },
      { icon: Eye,       text: "Preview files directly inside the app" },
      { icon: Paperclip, text: "Attach files to task cells or comments" },
    ],
  },
  {
    title: "Board Documents",
    icon: FileText,
    color: "text-cyan-600",
    bg: "bg-cyan-50",
    items: [
      { icon: FileText, text: "Write rich-text documents inside a board" },
      { icon: FileText, text: "Use documents for notes, meeting minutes, or SOPs" },
      { icon: Eye,      text: "All board members can view documents" },
    ],
  },
  {
    title: "Notifications",
    icon: Bell,
    color: "text-rose-600",
    bg: "bg-rose-50",
    items: [
      { icon: Bell, text: "Get notified when someone mentions you" },
      { icon: Bell, text: "Get notified when you are assigned to a task" },
      { icon: Bell, text: "Get notified when you are added to a workspace" },
    ],
  },
  {
    title: "Your Profile",
    icon: Settings,
    color: "text-slate-600",
    bg: "bg-slate-100",
    items: [
      { icon: Settings, text: "Update your name and profile picture" },
      { icon: Shield,   text: "Change your password anytime from Settings" },
    ],
  },
];

const ROLES = [
  { name: "Owner",  color: "bg-blue-100 text-blue-700",     desc: "Full control. Delete workspace, manage all members." },
  { name: "Admin",  color: "bg-indigo-100 text-indigo-700", desc: "Invite members, change roles, manage boards." },
  { name: "Member", color: "bg-green-100 text-green-700",   desc: "Create and edit tasks, upload files, comment." },
  { name: "Viewer", color: "bg-gray-100 text-gray-600",     desc: "Read-only. Can see boards and tasks but not edit." },
  { name: "Guest",  color: "bg-orange-100 text-orange-700", desc: "Access to specific boards or groups only." },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ section }: { section: typeof USER_SECTIONS[0] }) {
  const Icon = section.icon;
  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${section.bg}`}>
          <Icon className={`h-4 w-4 ${section.color}`} />
        </div>
        <h3 className="font-semibold text-gray-900 text-sm">{section.title}</h3>
      </div>
      <ul className="px-5 py-3 flex flex-col gap-2.5">
        {section.items.map((item, i) => {
          const ItemIcon = item.icon;
          return (
            <li key={i} className="flex items-start gap-2.5">
              <div className="mt-0.5 flex-shrink-0">
                <ItemIcon className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <span className="text-sm text-gray-600 leading-snug">{item.text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SectionGroup({
  title, badge, badgeColor, icon: Icon, iconBg, iconColor, sections, cols = 2,
}: {
  title: string; badge: string; badgeColor: string;
  icon: any; iconBg: string; iconColor: string;
  sections: typeof USER_SECTIONS; cols?: number;
}) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-2 mb-5">
        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${iconBg}`}>
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        </div>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <span className={`rounded-full border text-[11px] font-semibold px-2 py-0.5 ${badgeColor}`}>
          {badge}
        </span>
      </div>
      <div className={`grid gap-4 sm:grid-cols-2 ${cols === 3 ? "lg:grid-cols-3" : ""}`}>
        {sections.map((s) => (
          <SectionCard key={s.title} section={s} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.systemRole === "SUPER_ADMIN";
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50/60">
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-2">EzManage Guide</p>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">What can you do here?</h1>
            <p className="mt-2 text-gray-500 text-sm max-w-xl">
              {isSuperAdmin
                ? "You are a Super Admin — you have full system access."
                : "Contact your workspace Owner or Admin to get additional access."}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {!wizardOpen && (
              <button
                onClick={() => setWizardOpen(true)}
                className="flex items-center gap-2.5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
              >
                <Rocket className="h-4 w-4" />
                Step-by-step guide
              </button>
            )}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("start-onboarding-tour"))}
              className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              App Tour
            </button>
          </div>
        </div>

        {/* Interactive Wizard */}
        {wizardOpen && (
          <div className="mb-8">
            <Wizard onClose={() => setWizardOpen(false)} isSuperAdmin={isSuperAdmin} />
          </div>
        )}

        {/* Roles reference */}
        <div className="mb-8 rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Workspace Roles</h2>
            <p className="text-xs text-gray-400 mt-0.5">Each workspace member has one of these roles</p>
          </div>
          <div className="px-5 py-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {ROLES.map((role) => (
              <div key={role.name} className="flex flex-col gap-1.5">
                <span className={`self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ${role.color}`}>
                  {role.name}
                </span>
                <p className="text-xs text-gray-500 leading-snug">{role.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SUPER ADMIN ONLY — System Settings */}
        {isSuperAdmin && (
          <>
            <SectionGroup
              title="System Administration"
              badge="Super Admin Only"
              badgeColor="bg-red-50 border-red-100 text-red-600"
              icon={Settings}
              iconBg="bg-red-100"
              iconColor="text-red-600"
              sections={SUPER_ADMIN_SECTIONS}
              cols={2}
            />
            <div className="flex items-center gap-3 mb-8">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 font-medium">Workspace Admin capabilities</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          </>
        )}

        {/* WORKSPACE ADMIN */}
        <SectionGroup
          title="Admin & Owner Capabilities"
          badge="Owner / Admin"
          badgeColor="bg-indigo-50 border-indigo-100 text-indigo-600"
          icon={Shield}
          iconBg="bg-indigo-100"
          iconColor="text-indigo-600"
          sections={WORKSPACE_ADMIN_SECTIONS}
          cols={2}
        />

        {/* Divider */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">Available to all members</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* ALL USERS */}
        <SectionGroup
          title="Every Member Can"
          badge="All Users"
          badgeColor="bg-teal-50 border-teal-100 text-teal-600"
          icon={Users}
          iconBg="bg-teal-100"
          iconColor="text-teal-600"
          sections={USER_SECTIONS}
          cols={3}
        />

        {/* Quick Tips */}
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-6 py-5">
          <h3 className="font-semibold text-amber-800 text-sm mb-3">Quick Tips</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              "Click any task name to open its full detail panel",
              "Use @name in a comment to notify a teammate instantly",
              "Bell icon (top right) shows all your notifications",
              "Drag tasks between groups to change their section",
              "Click the member count on a workspace to see the team",
              "Activity log inside a task shows full history of changes",
              "Board Documents tab → write notes or SOPs for the team",
              "Your profile and password can be changed in Settings",
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-amber-700 leading-snug">{tip}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reopen wizard at bottom if closed */}
        {!wizardOpen && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => { setWizardOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="flex items-center gap-2 text-sm text-indigo-500 hover:text-indigo-700 transition-colors"
            >
              <BookOpen className="h-4 w-4" />
              Open step-by-step guide again
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
