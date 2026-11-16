"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { create } from "zustand";
import { toast } from "sonner";
import { Phone, PhoneOff, Video } from "lucide-react";
import { api } from "@/lib/api";
import { playRingtone } from "@/lib/sounds";
import { WORK_CHAT_EVENT, type WorkChatEvent } from "@/services/notifications.sse";

const LiveKitCallPanel = dynamic(() => import("@/components/Chat/LiveKitCallPanel").then((m) => m.LiveKitCallPanel), { ssr: false });

type Incoming = { room: string; video: boolean; callerName: string; channelName: string; channelUid: string };
type Active = { room: string; video: boolean; token: string; url: string; startedAt: number };
export const useWorkCall = create<{ incoming: Incoming | null; active: Active | null; setIncoming: (c: Incoming | null) => void; setActive: (c: Active | null) => void }>((set) => ({
  incoming: null, active: null,
  setIncoming: (incoming) => set({ incoming }),
  setActive: (active) => set({ active }),
}));
const errMsg = (e: any, f: string) => e?.response?.data?.message?.toString?.() ?? f;

/** start a call from a Work channel / DM */
export async function startWorkCall(channelUid: string, video: boolean) {
  if (useWorkCall.getState().active) { toast.error("You are already in a call."); return; }
  try {
    const r = (await api.post<{ room: string; video: boolean; token: string; url: string }>(`/work/chat/channels/${channelUid}/call`, { video })).data;
    useWorkCall.getState().setActive({ ...r, startedAt: Date.now() });
  } catch (e) {
    toast.error(errMsg(e, "Couldn't start the call."));
  }
}

/** call buttons for a channel header */
export function CallButtons({ channelUid, disabled }: { channelUid: string; disabled?: boolean }) {
  return (
    <span className="flex items-center gap-0.5">
      <button type="button" aria-label="Voice call" title="Voice call" disabled={disabled} onClick={() => startWorkCall(channelUid, false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"><Phone className="h-4 w-4" /></button>
      <button type="button" aria-label="Video call" title="Video call" disabled={disabled} onClick={() => startWorkCall(channelUid, true)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"><Video className="h-4 w-4" /></button>
    </span>
  );
}

/** mounted once in the app: rings for incoming Work calls and shows the call window */
export function WorkCallLayer() {
  const { incoming, active, setIncoming, setActive } = useWorkCall();
  const [joining, setJoining] = useState(false);
  const stopRing = useRef<(() => void) | null>(null);

  useEffect(() => {
    const on = (ev: Event) => {
      const e = (ev as CustomEvent<WorkChatEvent & { call?: any }>).detail;
      if (e?.type !== "call" || !e.call) return;
      const c = e.call;
      const st = useWorkCall.getState();
      if (c.action === "ring" && !st.active) st.setIncoming({ room: c.room, video: !!c.video, callerName: c.callerName, channelName: c.channelName, channelUid: e.channelUid });
      if (c.action === "ended") {
        if (st.incoming?.room === c.room) st.setIncoming(null);
        if (st.active?.room === c.room) { st.setActive(null); toast("The call ended"); }
      }
      if (c.action === "declined" && st.active?.room === c.room) toast(`${c.byName} declined the call`);
    };
    window.addEventListener(WORK_CHAT_EVENT, on);
    return () => window.removeEventListener(WORK_CHAT_EVENT, on);
  }, []);

  useEffect(() => {
    if (!incoming) return;
    setJoining(false);
    stopRing.current = playRingtone();
    const t = setTimeout(() => { stopRing.current?.(); setIncoming(null); }, 30_000);
    return () => { clearTimeout(t); stopRing.current?.(); };
  }, [incoming, setIncoming]);

  const join = async () => {
    if (!incoming || joining) return;
    stopRing.current?.(); setJoining(true);
    try {
      const r = (await api.post<{ room: string; video: boolean; token: string; url: string }>(`/work/chat/calls/join`, { room: incoming.room })).data;
      setActive({ ...r, video: incoming.video, startedAt: Date.now() });
      setIncoming(null);
    } catch (e) { toast.error(errMsg(e, "Couldn't join the call.")); setJoining(false); }
  };
  const decline = () => { if (!incoming) return; void api.post(`/work/chat/calls/decline`, { room: incoming.room }).catch(() => null); setIncoming(null); };
  const leave = () => { const a = useWorkCall.getState().active; if (a) void api.post(`/work/chat/calls/leave`, { room: a.room }).catch(() => null); setActive(null); };

  return (
    <>
      {incoming && (
        <div role="alertdialog" aria-label="Incoming call" className="fixed bottom-6 right-6 z-[80] flex w-[320px] items-center gap-3 rounded-2xl border border-border bg-popover p-4 shadow-2xl">
          <span className="flex h-11 w-11 shrink-0 animate-pulse items-center justify-center rounded-full bg-primary/15 text-primary">{incoming.video ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold">{incoming.callerName}</span><span className="block truncate text-[12px] text-muted-foreground">{incoming.video ? "Video" : "Voice"} call · {incoming.channelName}</span></span>
          <button type="button" aria-label="Decline" onClick={decline} className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive text-white"><PhoneOff className="h-4 w-4" /></button>
          <button type="button" aria-label="Join" disabled={joining} onClick={join} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-60"><Phone className="h-4 w-4" /></button>
        </div>
      )}
      {active && <LiveKitCallPanel token={active.token} serverUrl={active.url} startWithVideoMuted={!active.video} startedAt={active.startedAt} onClose={leave} />}
    </>
  );
}
