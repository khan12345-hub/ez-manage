import { ProfileSettings } from "./ProfileSettings";
import { WhatsappSettingsSection } from "./WhatsappSettingsSection";
import { NotificationsTab } from "../system-settings/general/NotificationsTab";

export default function SettingsPage() {
  return (
    <div className="w-full p-4">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your profile and account settings.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        <ProfileSettings />
        <WhatsappSettingsSection />
        <div className="mb-20">
          <NotificationsTab />
        </div>
      </div>
    </div>
  );
}