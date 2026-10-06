"use client";

import { useEffect, useRef, useState } from "react";
import { PhoneOff, ExternalLink, Video, Phone, Maximize2 } from "lucide-react";

interface Props {
  roomName: string;
  displayName: string;
  startWithVideoMuted?: boolean;
  onClose: () => void;
}

declare global {
  interface Window { JitsiMeetExternalAPI: any; }
}

const DEFAULT_HOST = "jitsi.member.fsf.org";

// Build Jitsi URL that auto-joins (skips pre-join page)
function buildJitsiUrl(host: string, roomName: string, displayName: string, videoMuted: boolean) {
  const params = new URLSearchParams({
    "config.prejoinConfig.enabled":   "false",
    "config.prejoinPageEnabled":      "false",
    "config.startWithVideoMuted":     String(videoMuted),
    "config.startWithAudioMuted":     "false",
    "config.disableDeepLinking":      "true",
    "userInfo.displayName":           displayName,
  });
  return `https://${host}/${roomName}#${params.toString().replace(/\+/g, "%20")}`;
}

export function JitsiCallModal({ roomName, displayName, startWithVideoMuted, onClose }: Props) {
  const host     = process.env.NEXT_PUBLIC_JITSI_HOST ?? DEFAULT_HOST;
  const jitsiUrl = buildJitsiUrl(host, roomName, displayName, startWithVideoMuted ?? false);

  const popupRef = useRef<Window | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);

  // ── Drag state for the "In Call" widget ───────────────────────────────────
  const widgetRef = useRef<HTMLDivElement>(null);
  const dragRef   = useRef<{ sx: number; sy: number; ol: number; ot: number } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const openPopup = () => {
    const w = Math.min(960, window.screen.availWidth);
    const h = Math.min(680, window.screen.availHeight);
    const left = Math.round((window.screen.availWidth  - w) / 2);
    const top  = Math.round((window.screen.availHeight - h) / 2);
    const popup = window.open(
      jitsiUrl,
      `jitsi-${roomName}`,
      `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
    );
    if (popup) {
      popupRef.current = popup;
      setPopupOpen(true);
      popup.focus();
    }
  };

  // Auto-open popup on mount
  useEffect(() => {
    openPopup();

    // Poll to detect if user closed the popup window
    const poll = setInterval(() => {
      if (popupRef.current?.closed) {
        clearInterval(poll);
        setPopupOpen(false);
        onClose();
      }
    }, 1500);

    return () => {
      clearInterval(poll);
      // Don't close the popup — user may still be in the call
    };
  }, []);

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const onHeaderMouseDown = (e: React.MouseEvent) => {
    const el = widgetRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { sx: e.clientX, sy: e.clientY, ol: rect.left, ot: rect.top };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current || !widgetRef.current) return;
      const dx = e.clientX - dragRef.current.sx;
      const dy = e.clientY - dragRef.current.sy;
      const el = widgetRef.current;
      setPos({
        left: Math.max(0, Math.min(window.innerWidth  - el.offsetWidth,  dragRef.current.ol + dx)),
        top:  Math.max(0, Math.min(window.innerHeight - el.offsetHeight, dragRef.current.ot + dy)),
      });
    };
    const onUp = () => { dragRef.current = null; };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };
  }, []);

  const handleEndCall = () => {
    popupRef.current?.close();
    popupRef.current = null;
    onClose();
  };

  const handleFocusPopup = () => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
    } else {
      openPopup();
    }
  };

  const posStyle: React.CSSProperties = pos
    ? { left: pos.left, top: pos.top }
    : { bottom: 24, right: 24 };

  return (
    <div
      ref={widgetRef}
      style={{ position: "fixed", zIndex: 200, ...posStyle }}
      className="w-72 overflow-hidden rounded-xl border border-gray-600 bg-gray-900 shadow-2xl"
    >
      {/* Drag handle / header */}
      <div
        className="flex cursor-grab items-center justify-between bg-gray-800 px-3 py-2 active:cursor-grabbing select-none"
        onMouseDown={onHeaderMouseDown}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-2 w-2 shrink-0 rounded-full bg-green-400 animate-pulse" />
          <span className="truncate text-xs font-medium text-gray-200">{roomName}</span>
        </div>
        <a
          href={jitsiUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in new tab"
          className="ml-2 shrink-0 text-gray-500 hover:text-white transition-colors"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Body */}
      <div
        className="flex flex-col items-center gap-3 px-4 py-4"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-gray-300">
          {startWithVideoMuted
            ? <Phone className="h-4 w-4 text-green-400" />
            : <Video className="h-4 w-4 text-green-400" />
          }
          <span className="text-sm font-semibold">
            {startWithVideoMuted ? "Voice" : "Video"} Call Active
          </span>
        </div>

        {!popupOpen && (
          <p className="text-center text-[11px] text-yellow-400">
            Call window was closed. Click below to reopen.
          </p>
        )}

        <div className="flex w-full gap-2">
          <button
            onClick={handleFocusPopup}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            {popupOpen ? "Return to Call" : "Rejoin Call"}
          </button>
          <button
            onClick={handleEndCall}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
          >
            <PhoneOff className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
