import { ProfileSettings } from "./ProfileSettings";
import { WhatsappSettingsSection } from "./WhatsappSettingsSection";
import { NotificationsTab } from "../system-settings/general/NotificationsTab";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* Page header */}
      <div className="border-b border-slate-200 bg-white px-8 py-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your profile, security, and notification preferences.
        </p>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex flex-col gap-10">
          <ProfileSettings />

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase tracking-widest text-slate-400">Integrations</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <WhatsappSettingsSection />

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase tracking-widest text-slate-400">Notifications</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="mb-24">
            <NotificationsTab />
          </div>
        </div>
      </div>
    </div>
  );
}
