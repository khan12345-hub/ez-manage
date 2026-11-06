"use client";

import { motion } from "framer-motion";
import { CalendarClock, Users, Video } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardMeetings } from "./useDashboardData";
import type { Meeting } from "@/services/ceo-assistant.api";

function meetingTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase(),
    time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function UpcomingMeetings() {
  const { meetings, isLoading } = useDashboardMeetings();

  return (
    <div
      className="rounded-2xl bg-card"
      style={{
        border: "1px solid rgba(4,120,87,0.1)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid rgba(4,120,87,0.07)" }}>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "rgba(4,120,87,0.1)" }}>
          <CalendarClock className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-serif text-[21px] font-normal leading-none text-foreground">Upcoming Meetings</h3>
      </div>

      <div className="px-3 py-2">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
            <CalendarClock className="h-9 w-9 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-medium text-muted-foreground">No upcoming meetings</p>
            <p className="text-xs text-muted-foreground">Meetings you&apos;re invited to appear here.</p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "rgba(4,120,87,0.06)" }}>
            {meetings.map((m, idx) => (
              <MeetingRow key={m.id} meeting={m} index={idx} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MeetingRow({ meeting, index }: { meeting: Meeting; index: number }) {
  const t = meetingTime(meeting.scheduledAt);
  const count = meeting.attendees?.length ?? 0;

  const inner = (
    <>
      <div
        className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl"
        style={{ background: "rgba(4,120,87,0.08)" }}
      >
        <span className="text-[10px] font-bold leading-none text-primary">{t.date}</span>
        <span className="mt-0.5 text-[10px] font-semibold leading-none text-muted-foreground">{t.time}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{meeting.title}</p>
        {meeting.description && (
          <p className="truncate text-xs text-muted-foreground">{meeting.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        {count}
      </div>
    </>
  );

  return (
    <motion.li
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
    >
      {meeting.meetingLink ? (
        <a
          href={meeting.meetingLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-accent"
        >
          {inner}
          <Video className="h-4 w-4 shrink-0 text-primary" />
        </a>
      ) : (
        <div className="flex items-center gap-3 px-2 py-3">{inner}</div>
      )}
    </motion.li>
  );
}
