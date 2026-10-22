import { LoginAuthGuard } from "./LoginAuthGuard";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LoginAuthGuard>{children}</LoginAuthGuard>;
}
