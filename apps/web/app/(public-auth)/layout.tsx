import { GuestHeader } from "@/app/(auth)/GuestHeader";
import { GuestFooter } from "@/app/(auth)/GuestFooter";

export default function PublicAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GuestHeader />
      {children}
      <GuestFooter />
    </>
  );
}
