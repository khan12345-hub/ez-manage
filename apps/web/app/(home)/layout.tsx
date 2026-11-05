import { AuthWrapper } from "@/app/(auth)/AuthWrapper";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthWrapper>{children}</AuthWrapper>;
}
