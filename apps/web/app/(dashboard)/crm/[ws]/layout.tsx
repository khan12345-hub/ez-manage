"use client";

import { CrmShell } from "../_components/CrmShell";

export default function CrmWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <CrmShell>{children}</CrmShell>;
}
