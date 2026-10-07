import { ProfileSettings } from "./ProfileSettings";
import { WhatsappSettingsSection } from "./WhatsappSettingsSection";
import { NotificationsTab } from "../system-settings/general/NotificationsTab";
import { Settings2, BellRing, Plug2 } from "lucide-react";

function SectionDivider({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="min-h-full bg-muted/30">
      {/* Page header */}
      <div className="border-b border-border bg-background px-4 py-4 sm:px-8 sm:py-5">
        <div className="mx-auto max-w-3xl flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10">
            <Settings2 className="h-4.5 w-4.5 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">Settings</h1>
            <p className="text-xs text-muted-foreground">
              Manage your profile, security, and notifications
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-8">
          <ProfileSettings />

          <SectionDivider icon={Plug2} label="Integrations" />

          <WhatsappSettingsSection />

          <SectionDivider icon={BellRing} label="Notifications" />

          <div className="mb-24">
            <NotificationsTab />
          </div>
        </div>
      </div>
    </div>
  );
}
