"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { PageHeader } from "../../_components/PageHeader";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Copy, Mic, MicOff, Pencil, Square, Trash2, Video } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { userName, type WorkUser } from "@/services/work.api";
import { useAuth } from "@/providers/AuthProvider";

type Clip = { id: number; uid: string; title: string; durationSec: number; createdAt: string; file: { id: number; url: string; mimeType: string; fileSize: number } | null; createdBy: WorkUser | null };
const errMsg = (e: any, f: string) => e?.response?.data?.message?.toString?.() ?? f;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const linkOf = (ws: string, uid: string) => `${window.location.origin}/work/${ws}/clips?clip=${uid}`;

/** Work → Clips: record your screen (with your voice), share the link. */
function ClipsInner() {
  const { workspaceId: ws } = useParams<{ workspaceId: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = ["work", "clips", ws];
  const current = sp.get("clip");
  const { data: clips = [], isLoading } = useQuery({ queryKey: key, queryFn: async () => (await api.get<Clip[]>(`/work/workspaces/${ws}/clips`)).data });
  const [recOpen, setRecOpen] = useState(false);
  useEffect(() => {
    if (sp.get("record") === "1") { setRecOpen(true); router.replace(`/work/${ws}/clips`); }
  }, [sp, router, ws]);

  if (current) return <ClipViewer ws={ws} uid={current} me={user?.id} onBack={() => router.push(`/work/${ws}/clips`)} onChanged={() => qc.invalidateQueries({ queryKey: key })} />;

  return (
    <div className="flex min-h-full w-full flex-col p-4 sm:p-6">
      <PageHeader icon={Video} color="#db2777" title="Clips" subtitle="Record your screen and voice, then share the link instead of writing a long message."
        actions={<button type="button" onClick={() => setRecOpen(true)} className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground"><Video className="h-4 w-4" /> Record a clip</button>} />
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-52 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : !clips.length ? (
        <div className="py-20 text-center">
          <Video className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-[14px] font-medium">No clips yet</p>
          <p className="text-[13px] text-muted-foreground">Your team&apos;s screen recordings show up here.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {clips.map((c) => (
            <li key={c.uid}>
              <button type="button" onClick={() => router.push(`/work/${ws}/clips?clip=${c.uid}`)} className="group block w-full overflow-hidden rounded-xl border border-border bg-card text-left hover:shadow-[0_10px_28px_-18px_rgb(11_42_31/0.4)]">
                <span className="relative block aspect-video bg-black">
                  {c.file && <video src={`${c.file.url}#t=0.5`} preload="metadata" muted className="h-full w-full object-contain" />}
                  <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white">{mmss(c.durationSec)}</span>
                </span>
                <span className="block p-3">
                  <span className="block truncate text-[14px] font-semibold group-hover:text-primary">{c.title}</span>
                  <span className="block text-[12px] text-muted-foreground">{c.createdBy ? userName(c.createdBy) : "Someone"} · {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {recOpen && <Recorder ws={ws} onClose={() => setRecOpen(false)} onSaved={(c) => { qc.invalidateQueries({ queryKey: key }); setRecOpen(false); router.push(`/work/${ws}/clips?clip=${c.uid}`); }} />}
    </div>
  );
}

function ClipViewer({ ws, uid, me, onBack, onChanged }: { ws: string; uid: string; me?: number; onBack: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const { data: c, isError } = useQuery({ queryKey: ["work", "clip", uid], queryFn: async () => (await api.get<Clip>(`/work/clips/${uid}`)).data });
  const [title, setTitle] = useState<string | null>(null);
  const rename = useMutation({
    mutationFn: async (t: string) => (await api.patch(`/work/clips/${uid}`, { title: t })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work", "clip", uid] }); onChanged(); setTitle(null); },
    onError: (e) => toast.error(errMsg(e, "Couldn't rename it.")),
  });
  const remove = useMutation({
    mutationFn: async () => (await api.delete(`/work/clips/${uid}`)).data,
    onSuccess: () => { onChanged(); toast.success("Clip deleted"); onBack(); },
    onError: (e) => toast.error(errMsg(e, "Couldn't delete it.")),
  });
  if (isError) return <div className="p-10 text-center text-sm text-muted-foreground">This clip doesn&apos;t exist or you don&apos;t have access.</div>;
  const mine = !!c && c.createdBy?.id === me;
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8">
      <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All clips</button>
      {!c ? <div className="aspect-video animate-pulse rounded-xl bg-muted" /> : (
        <>
          <div className="overflow-hidden rounded-xl bg-black">{c.file && <video src={c.file.url} controls autoPlay className="max-h-[70vh] w-full" />}</div>
          <div className="mt-4 flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              {title !== null ? (
                <form onSubmit={(e) => { e.preventDefault(); rename.mutate(title); }} className="flex gap-2">
                  <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setTitle(null)} aria-label="Clip title" className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 text-[15px] outline-none focus:border-primary/50" />
                  <button type="submit" className="h-9 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground">Save</button>
                </form>
              ) : (
                <h1 className="flex items-center gap-2 text-[20px] font-semibold">{c.title}{mine && <button type="button" aria-label="Rename" onClick={() => setTitle(c.title)} className="rounded p-1 text-muted-foreground hover:bg-accent"><Pencil className="h-3.5 w-3.5" /></button>}</h1>
              )}
              <p className="text-[12.5px] text-muted-foreground">{c.createdBy ? userName(c.createdBy) : "Someone"} · {new Date(c.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {mmss(c.durationSec)}</p>
            </div>
            <button type="button" onClick={() => navigator.clipboard.writeText(linkOf(ws, c.uid)).then(() => toast.success("Link copied. Paste it in a chat, comment or task."))} className="flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-[13px] font-medium hover:bg-accent"><Copy className="h-3.5 w-3.5" /> Copy link</button>
            {mine && <button type="button" aria-label="Delete clip" onClick={() => window.confirm("Delete this clip?") && remove.mutate()} className="flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-[13px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</button>}
          </div>
        </>
      )}
    </div>
  );
}

function pickType() {
  for (const t of ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  return "";
}

/** screen + (optional) microphone recorder */
function Recorder({ ws, onClose, onSaved }: { ws: string; onClose: () => void; onSaved: (c: Clip) => void }) {
  const [mic, setMic] = useState(true);
  const [state, setState] = useState<"idle" | "recording" | "done" | "saving">("idle");
  const [secs, setSecs] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [title, setTitle] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const streams = useRef<MediaStream[]>([]);
  const ctx = useRef<AudioContext | null>(null);
  const started = useRef(0);
  const preview = useRef<string | null>(null);

  const stopAll = () => {
    streams.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streams.current = [];
    void ctx.current?.close().catch(() => null);
    ctx.current = null;
  };
  useEffect(() => () => { stopAll(); if (rec.current?.state === "recording") rec.current.stop(); if (preview.current) URL.revokeObjectURL(preview.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (state !== "recording") return;
    const t = setInterval(() => setSecs(Math.round((Date.now() - started.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [state]);

  const start = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") { toast.error("This browser can't record the screen."); return; }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
      streams.current.push(screen);
      const tracks: MediaStreamTrack[] = [...screen.getVideoTracks()];
      let voice: MediaStream | null = null;
      if (mic) {
        try { voice = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); streams.current.push(voice); } catch { toast("Recording without your microphone."); }
      }
      const sources = [screen, ...(voice ? [voice] : [])].filter((s) => s.getAudioTracks().length);
      if (sources.length > 1) {
        // mix screen sound and voice into one track
        const ac = new AudioContext(); ctx.current = ac;
        const dest = ac.createMediaStreamDestination();
        for (const s of sources) ac.createMediaStreamSource(s).connect(dest);
        tracks.push(...dest.stream.getAudioTracks());
      } else if (sources.length === 1) tracks.push(...sources[0]!.getAudioTracks());
      const type = pickType();
      const r = new MediaRecorder(new MediaStream(tracks), type ? { mimeType: type, videoBitsPerSecond: 2_500_000 } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stopAll();
        const b = new Blob(chunks, { type: (type || "video/webm").split(";")[0] });
        if (preview.current) URL.revokeObjectURL(preview.current);
        preview.current = URL.createObjectURL(b);
        setBlob(b); setState("done");
      };
      // the browser's own "Stop sharing" button ends the clip too
      screen.getVideoTracks()[0]?.addEventListener("ended", () => { if (r.state === "recording") r.stop(); });
      rec.current = r;
      r.start(1000);
      started.current = Date.now(); setSecs(0); setState("recording");
    } catch (e: any) {
      stopAll();
      if (e?.name !== "NotAllowedError") toast.error("Couldn't start recording.");
    }
  };
  const stop = () => { if (rec.current?.state === "recording") rec.current.stop(); };
  const save = async () => {
    if (!blob) return;
    setState("saving");
    try {
      const fd = new FormData();
      fd.append("file", new File([blob], `clip-${Date.now()}.${blob.type.includes("mp4") ? "mp4" : "webm"}`, { type: blob.type }));
      fd.append("title", title.trim());
      fd.append("durationSec", String(secs));
      const c = (await api.post<Clip>(`/work/workspaces/${ws}/clips`, fd)).data;
      toast.success("Clip saved");
      onSaved(c);
    } catch (e) { toast.error(errMsg(e, "Couldn't save the clip.")); setState("done"); }
  };
  const discard = () => { setBlob(null); setState("idle"); setSecs(0); };

  return (
    <div role="dialog" aria-label="Record a clip" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-popover p-5 shadow-2xl">
        <h2 className="text-[17px] font-semibold">Record a clip</h2>
        {state === "idle" && (
          <>
            <p className="mt-1 text-[13px] text-muted-foreground">Pick a screen, window or tab to record. Your browser will ask which one.</p>
            <button type="button" aria-pressed={mic} onClick={() => setMic(!mic)} className={cn("mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px]", mic ? "border-primary/50 bg-primary/5" : "border-border")}>
              {mic ? <Mic className="h-4 w-4 text-primary" /> : <MicOff className="h-4 w-4 text-muted-foreground" />} {mic ? "Microphone on" : "Microphone off"}
            </button>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="h-9 rounded-md px-3 text-[13px] text-muted-foreground hover:bg-accent">Cancel</button>
              <button type="button" onClick={start} className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground"><Video className="h-4 w-4" /> Start recording</button>
            </div>
          </>
        )}
        {state === "recording" && (
          <div className="mt-4 flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-destructive" />
            <span className="font-mono text-[18px]">{mmss(secs)}</span>
            <span className="flex-1 text-[13px] text-muted-foreground">Recording…</span>
            <button type="button" onClick={stop} className="flex h-9 items-center gap-1.5 rounded-md bg-destructive px-4 text-[13px] font-semibold text-white"><Square className="h-3.5 w-3.5 fill-current" /> Stop</button>
          </div>
        )}
        {(state === "done" || state === "saving") && blob && (
          <div className="mt-3 space-y-3">
            {preview.current && <video src={preview.current} controls className="max-h-72 w-full rounded-lg bg-black" />}
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name this clip" aria-label="Clip name" className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px] outline-none focus:border-primary/50" />
            <div className="flex justify-end gap-2">
              <button type="button" disabled={state === "saving"} onClick={discard} className="h-9 rounded-md px-3 text-[13px] text-muted-foreground hover:bg-accent">Discard</button>
              <button type="button" disabled={state === "saving"} onClick={save} className="h-9 rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50">{state === "saving" ? "Saving…" : "Save clip"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClipsPage() {
  return <Suspense fallback={<div className="p-6"><div className="h-28 animate-pulse rounded-xl bg-muted" /></div>}><ClipsInner /></Suspense>;
}
