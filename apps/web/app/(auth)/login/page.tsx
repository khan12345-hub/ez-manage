import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-[85vh] flex-col items-center justify-center">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
