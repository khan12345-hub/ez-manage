import { ProfileSettings } from "./ProfileSettings";
export default function SettingsPage() {

  return (
    <div className="w-full max-w-3xl p-4">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold">
          Settings
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Manage your profile and account settings.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        <ProfileSettings />

      </div>
    </div>
  );
}