"use client";

import { LogOut, Settings, User, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BasicLoader } from "@/components/ui/Loader";
import { useAuth } from "@/providers/AuthProvider";
import { useLogout } from "@/services/auth/auth.hooks";
import { useInviteModalStore } from "@/store/invite-modal";

type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
};

function MenuItem({ icon, label, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] text-gray-700 transition-colors hover:bg-gray-100"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-gray-500">
        {icon}
      </span>

      <span>{label}</span>
    </button>
  );
}

export default function UserProfile() {
  const logout = useLogout();
  const router = useRouter();

  const [open, setOpen] = useState(false);

  const { user, isLoading } = useAuth();

  const handleNavigate = (path: string) => {
    router.push(path);
    setOpen(false);
  };

  const handleLogout = () => {
    setOpen(false);
    logout.mutate();
  };

  if (isLoading) {
    return <BasicLoader />;
  }

  const avatarUrl = user?.avatarUrl
    ? `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${user.avatarUrl}`
    : null;

  const initials =
    `${user?.firstName?.charAt(0) ?? ""}${user?.lastName?.charAt(0) ?? ""}`.toUpperCase();
  const openInviteModal = useInviteModalStore((state) => state.open);

  return (
    <div className="flex items-center gap-4">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="cursor-pointer rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                width={40}
                height={40}
                className="h-10 w-10 rounded-full border border-gray-200 object-cover"
              />
            ) : (
              <Avatar className="h-10 w-10 border border-gray-200">
                <AvatarFallback className="bg-gray-100 text-sm font-medium text-gray-700">
                  {initials || "U"}
                </AvatarFallback>
              </Avatar>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-[300px] overflow-hidden rounded-xl border border-gray-200 bg-white p-0 shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-gray-100 px-5 py-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-gray-100 text-xs font-medium">
                  {initials || "U"}
                </AvatarFallback>
              </Avatar>
            )}

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-800">
                {user?.firstName} {user?.lastName}
              </p>

              {user?.email && (
                <p className="truncate text-xs text-gray-500">{user.email}</p>
              )}
            </div>
          </div>

          {/* Menu */}
          <div className="px-4 py-3">
            <div className="mb-2 px-2 text-[12px] font-medium text-gray-500">
              Account
            </div>

            <div className="space-y-0.5">
              <MenuItem
                icon={<User className="h-3.5 w-3.5" />}
                label="My profile"
                onClick={() => handleNavigate("/settings")}
              />

              <MenuItem
                icon={<UserPlus className="h-3.5 w-3.5" />}
                label="Invite"
                onClick={openInviteModal}
              />

              {user && user?.systemRole === "SUPER_ADMIN" && (
                <MenuItem
                  icon={<Settings className="h-3.5 w-3.5" />}
                  label="Administration"
                  onClick={() => handleNavigate("/system-settings")}
                />
              )}

              <MenuItem
                icon={<LogOut className="h-3.5 w-3.5" />}
                label="Logout"
                onClick={handleLogout}
              />
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
