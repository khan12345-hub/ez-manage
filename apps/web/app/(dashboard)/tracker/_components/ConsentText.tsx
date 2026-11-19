"use client";

import { Eye, ShieldCheck, ShieldX } from "lucide-react";

/** the same words the desktop app shows before it records anything */
export function ConsentText({ shots, blur, apps, urls, retention }: { shots: number; blur: boolean; apps: boolean; urls: boolean; retention: number }) {
  return (
    <div className="grid gap-3 text-[13px] sm:grid-cols-3">
      <div className="rounded-2xl bg-[#047857]/[0.06] p-3.5 ring-1 ring-[#047857]/15">
        <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-[#047857] dark:text-[#34d399]"><Eye className="h-4 w-4" /> Recorded while you track</p>
        <ul className="list-disc space-y-1 pl-4 text-foreground/85">
          <li>When you press Start and Stop, and the task you picked</li>
          <li>{shots ? `${shots} screenshot${shots > 1 ? "s" : ""} of your screen(s) every 10 minutes, at random times${blur ? ", blurred" : ""}` : "No screenshots (turned off)"}</li>
          <li>How many keyboard and mouse actions happen (a count only)</li>
          {apps && <li>Which app is in front, and for how long</li>}
          {urls && <li>Website names from the browser&apos;s window title</li>}
        </ul>
      </div>
      <div className="rounded-2xl bg-[#dc2626]/[0.05] p-3.5 ring-1 ring-[#dc2626]/15">
        <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-[#dc2626] dark:text-[#f87171]"><ShieldX className="h-4 w-4" /> Never recorded</p>
        <ul className="list-disc space-y-1 pl-4 text-foreground/85">
          <li>What you type: no keys, messages or passwords</li>
          <li>Anything while the tracker is stopped</li>
          <li>Your microphone or camera</li>
        </ul>
      </div>
      <div className="rounded-2xl bg-black/[0.03] p-3.5 ring-1 ring-border dark:bg-white/[0.04]">
        <p className="mb-1.5 flex items-center gap-1.5 font-semibold"><ShieldCheck className="h-4 w-4" /> Who sees it</p>
        <ul className="list-disc space-y-1 pl-4 text-foreground/85">
          <li>You, and the workspace owners / admins and your manager</li>
          <li>You can delete any of your screenshots; its 10 minutes are removed too</li>
          <li>Screenshots are deleted after {retention ? `${retention} days` : "you or an admin delete them"}</li>
        </ul>
      </div>
    </div>
  );
}
