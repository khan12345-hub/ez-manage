"use client";

import { TrackerShell } from "../_components/TrackerShell";

export default function TrackerWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <TrackerShell>{children}</TrackerShell>;
}
