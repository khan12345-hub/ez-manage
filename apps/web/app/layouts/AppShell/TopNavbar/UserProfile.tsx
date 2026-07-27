import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Settings, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/providers/AuthProvider";
import { BasicLoader } from "@/components/ui/Loader";
import { useLogout } from "@/services/auth/auth.hooks";

export default function UserProfile() {
  const logout = useLogout();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavigate = (path: string) => {
    router.push(path);
    setOpen(false);
  };
  const { user, isLoading } = useAuth();
  console.log({ user });
  return (
    <>
      {isLoading ? (
        <BasicLoader />
      ) : (
        <div className="flex items-center gap-4">
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger>
              <div className="cursor-pointer">
                {user?.avatarUrl ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}${user?.avatarUrl}`}
                    alt="Profile"
                    width={40}
                    height={40}
                    className="object-cover h-10 w-10 rounded-full border focus-visible:outline-none"
                  />
                ) : (
                  <Avatar className="h-10 w-10 focus-visible:outline-none">
                    <AvatarFallback>
                      {user?.firstName?.charAt(0)}
                      {user?.lastName?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-full" align="end">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => handleNavigate("/settings")}
              >
                <Settings />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => logout.mutate()}
                className="cursor-pointer"
              >
                <LogOut />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </>
  );
}
