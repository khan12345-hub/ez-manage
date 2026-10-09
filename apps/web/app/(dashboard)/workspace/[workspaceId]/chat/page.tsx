"use client";

import React, { useEffect, useRef, useState } from "react";
import { resolveUrl } from "@/lib/resolveUrl";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import {
  Hash, MessageSquare, Plus, Send, Trash2, Video,
  Users, Search, X, Loader2, Phone, UserPlus, Check,
  Paperclip, Download, Settings, CornerDownRight, AtSign,
  Mail, UserX, ChevronLeft, Pencil, SmilePlus,
  Pin, ArrowDown, BookmarkCheck,
  Bell, BellOff, BellMinus, Smile, Clock, CalendarClock,
} from "lucide-react";

const EmojiPicker = dynamic(() => import("@/components/Chat/EmojiPicker"), { ssr: false });
import type { ChatRichTextInputHandle } from "@/components/Chat/ChatRichTextInput";
const ChatRichTextInputDynamic = dynamic(() => import("@/components/Chat/ChatRichTextInput"), { ssr: false });
// Preserve forwardRef typing through the dynamic wrapper
const ChatRichTextInput = ChatRichTextInputDynamic as React.ForwardRefExoticComponent<
  { placeholder: string; channelId: number | null; onUpdate: (html: string, text: string) => void; onSend: () => void } &
  React.RefAttributes<ChatRichTextInputHandle>
>;
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/providers/AuthProvider";
import { useChatStore } from "@/store/chat-store";
import { useInviteModalStore } from "@/store/invite-modal";
import { getSocket, sendChatMessage } from "@/components/Chat/ChatProvider";
import {
  getChannels, getDMs, getMessages, getOrCreateDM,
  createChannel, updateChannel, deleteMessage, editMessage, toggleReaction, getAllChatUsers,
  joinChannel, markRead, ensureGeneralChannel,
  getChannelMembers, addChannelMember, removeChannelMember, uploadChatFile,
  getReplies, assignMessage as apiAssignMessage,
  searchMessages, pinMessage, getPinnedMessages, setChannelPref,
  fetchLinkPreview, setUserStatus as apiSetUserStatus,
  createScheduledMessage, listScheduledMessages, cancelScheduledMessage,
} from "@/services/chat.api";
import type { ScheduledMessage } from "@/services/chat.api";
import type { ChatChannel, ChatMessage, ChatNotifPref, LinkPreview } from "@/services/chat.api";
import { getBoards, getBoardGroups } from "@/services/boards.api";
import { createTask } from "@/services/tasks.api";
import { UserProfilePanel } from "@/components/UserProfilePanel";

// ─── helpers ────────────────────────────────────────────────────────────────

/** Strip dangerous HTML before dangerouslySetInnerHTML */
function sanitizeChatHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]*/gi, "")
    .replace(/javascript\s*:/gi, "");
}

/** Renders plain text OR TipTap HTML — used for all chat message content */
type MentionUser = { userId: number; user: { firstName: string; lastName: string } };

function parseMentionNodes(
  text: string,
  users: MentionUser[],
  onMentionClick: (uid: number) => void,
): React.ReactNode {
  if (!text.includes("@") || !users.length) return text;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  // Match @FirstName or @FirstName LastName (alpha + optional space + alpha)
  const re = /@([A-Za-z]+(?:\s[A-Za-z]+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = m[1].toLowerCase();
    const found = users.find((u) => {
      const full = `${u.user.firstName} ${u.user.lastName}`.toLowerCase();
      return full === name || u.user.firstName.toLowerCase() === name;
    });
    if (found) {
      if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
      const uid = found.userId;
      parts.push(
        <button
          key={`mention-${m.index}`}
          type="button"
          onClick={(e) => { e.stopPropagation(); onMentionClick(uid); }}
          className="rounded px-0.5 font-semibold text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 cursor-pointer leading-tight"
        >
          @{m[1]}
        </button>,
      );
      lastIndex = m.index + m[0].length;
    }
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

function injectMentionSpans(html: string): string {
  return html.replace(
    /@([A-Za-z]+(?:\s[A-Za-z]+)?)/g,
    (_match, name) =>
      `<span data-mention-name="${name}" class="rounded px-0.5 font-semibold text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 cursor-pointer">@${name}</span>`,
  );
}

function RichContent({
  content,
  className,
  allUsers,
  onMentionClick,
}: {
  content: string;
  className?: string;
  allUsers?: MentionUser[];
  onMentionClick?: (uid: number) => void;
}) {
  const isHtml = /<[a-z][\s\S]*>/i.test(content);

  if (!isHtml) {
    const nodes =
      allUsers && onMentionClick
        ? parseMentionNodes(content, allUsers, onMentionClick)
        : content;
    return (
      <span className={`whitespace-pre-wrap break-words ${className ?? ""}`}>
        {nodes}
      </span>
    );
  }

  const handleHtmlClick =
    allUsers && onMentionClick
      ? (e: React.MouseEvent<HTMLDivElement>) => {
          const span = (e.target as HTMLElement).closest("[data-mention-name]");
          if (!span) return;
          const name = span.getAttribute("data-mention-name")?.toLowerCase() ?? "";
          const found = allUsers.find((u) => {
            const full = `${u.user.firstName} ${u.user.lastName}`.toLowerCase();
            return full === name || u.user.firstName.toLowerCase() === name;
          });
          if (found) onMentionClick(found.userId);
        }
      : undefined;

  return (
    <div
      className={`prose-chat ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: injectMentionSpans(sanitizeChatHtml(content)) }}
      onClick={handleHtmlClick}
    />
  );
}

// ── Link preview helpers ─────────────────────────────────────────────────────

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
function extractFirstUrl(content: string): string | null {
  const plain = content.replace(/<[^>]+>/g, " ");
  const m = URL_RE.exec(plain);
  URL_RE.lastIndex = 0;
  return m ? m[0].replace(/[.,;!?]+$/, "") : null;
}

function LinkPreviewCard({ preview }: { preview: LinkPreview }) {
  if (!preview.title && !preview.description && !preview.image) return null;
  const host = (() => { try { return new URL(preview.url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex max-w-sm overflow-hidden rounded-xl border border-border bg-muted/50 hover:bg-background transition-colors no-underline"
      onClick={(e) => e.stopPropagation()}
    >
      {preview.image && (
        <img
          src={preview.image}
          alt=""
          className="h-20 w-24 shrink-0 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div className="min-w-0 flex flex-col justify-center gap-0.5 p-2.5">
        <p className="text-[10px] font-medium text-muted-foreground truncate">{preview.siteName || host}</p>
        {preview.title && (
          <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">{preview.title}</p>
        )}
        {preview.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">{preview.description}</p>
        )}
      </div>
    </a>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string) {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
// ─── helpers ─────────────────────────────────────────────────────────────────

const av = (url?: string | null) => resolveUrl(url) || undefined;


export default function ChatPage() {
  const params = useParams();
  const workspaceId = Number(Array.isArray(params.workspaceId) ? params.workspaceId[0] : params.workspaceId);
  const { user } = useAuth();
  const { setWorkspace } = useInviteModalStore();

  const {
    channels, dms, messages, activeChannelId, unreadCounts, onlineUserIds,
    userStatuses, setUserStatus: storeSetUserStatus,
    setChannels, setDMs, setActiveChannel, setMessages,
    clearUnread, setActiveCall, clearWorkspaceUnread,
    isSocketConnected,
  } = useChatStore();

  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<number | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editingMsgContent, setEditingMsgContent] = useState("");
  const [editingChannel, setEditingChannel] = useState(false);
  const [editChannelName, setEditChannelName] = useState("");
  const [editChannelDesc, setEditChannelDesc] = useState("");
  // All system users for DM picker
  const [allUsers, setAllUsers] = useState<{ userId: number; user: { id: number; firstName: string; lastName: string; avatarUrl: string | null; email?: string; phone?: string | null; whatsappPhone?: string | null; whatsappEnabled?: boolean; lastLoginAt?: string | null; createdAt?: string } }[]>([]);
  const [profileMember, setProfileMember] = useState<{ userId: number; user: { id: number; firstName: string; lastName: string; avatarUrl: string | null; email?: string; phone?: string | null; whatsappPhone?: string | null; whatsappEnabled?: boolean; lastLoginAt?: string | null; createdAt?: string } } | null>(null);
  // Current channel members (for member management panel)
  const [channelMembers, setChannelMembers] = useState<{ userId: number; user: { id: number; firstName: string; lastName: string; avatarUrl: string | null } }[]>([]);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showDMProfile, setShowDMProfile] = useState(false);
  const [mentionProfileUserId, setMentionProfileUserId] = useState<number | null>(null);
  const [addMemberSearch, setAddMemberSearch] = useState("");

  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelSearch, setNewChannelSearch] = useState("");
  const [newChannelMembers, setNewChannelMembers] = useState<number[]>([]);
  const [showDMPicker, setShowDMPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [msgSearch, setMsgSearch] = useState("");
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [input, setInput] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReplyEmojiPicker, setShowReplyEmojiPicker] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);
  const rateLimitTimer = useRef<NodeJS.Timeout | null>(null);
  const [assigningMsgId, setAssigningMsgId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  type PendingFile = { file: File; previewUrl: string; name: string; fileType: "image" | "file" };
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  // Thread panel
  const [threadMsg, setThreadMsg] = useState<ChatMessage | null>(null);
  const [replies, setReplies] = useState<ChatMessage[]>([]);
  const [replyInput, setReplyInput] = useState("");
  const [replyUploading, setReplyUploading] = useState(false);
  const replyFileRef = useRef<HTMLInputElement>(null);
  const threadMsgRef = useRef<ChatMessage | null>(null);


  // Message scheduling
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [scheduledList, setScheduledList] = useState<ScheduledMessage[]>([]);
  const [showScheduledList, setShowScheduledList] = useState(false);
  const [schedulingMsg, setSchedulingMsg] = useState(false);

  const SCHEDULE_PRESETS: { label: string; getDate: () => Date }[] = [
    { label: "In 30 min",    getDate: () => new Date(Date.now() + 30 * 60_000) },
    { label: "In 1 hour",    getDate: () => new Date(Date.now() + 60 * 60_000) },
    { label: "In 4 hours",   getDate: () => new Date(Date.now() + 240 * 60_000) },
    { label: "Tomorrow 9am", getDate: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
    { label: "Monday 9am",   getDate: () => { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() + ((8 - day) % 7 || 7)); d.setHours(9, 0, 0, 0); return d; } },
  ];

  const toLocalDatetimeInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleScheduleSend = async () => {
    if (!activeChannelId || !scheduleDateTime) return;
    const html = editorRef.current?.getHTML() ?? "";
    const text = editorRef.current?.getText() ?? input;
    if (!text.trim()) return;
    setSchedulingMsg(true);
    try {
      const msg = await createScheduledMessage(workspaceId, activeChannelId, html, new Date(scheduleDateTime).toISOString());
      setScheduledList((prev) => [...prev, msg]);
      editorRef.current?.clearContent();
      setInput("");
      setShowSchedulePicker(false);
      setScheduleDateTime("");
    } catch {}
    setSchedulingMsg(false);
  };

  const handleLoadScheduled = async () => {
    if (!activeChannelId) return;
    const list = await listScheduledMessages(workspaceId, activeChannelId);
    setScheduledList(list);
    setShowScheduledList(true);
  };

  const handleCancelScheduled = async (id: number) => {
    await cancelScheduledMessage(workspaceId, id);
    setScheduledList((prev) => prev.filter((m) => m.id !== id));
  };

  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>([]);
  const [firstUnreadId, setFirstUnreadId] = useState<number | null>(null);
  const [showJumpToUnread, setShowJumpToUnread] = useState(false);
  const [msgSearchResults, setMsgSearchResults] = useState<ChatMessage[] | null>(null);
  const [msgSearchLoading, setMsgSearchLoading] = useState(false);
  // Per-channel notification pref (keyed by channelId)
  const [channelPrefs, setChannelPrefs] = useState<Record<number, ChatNotifPref>>({});
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [notifMenuPos, setNotifMenuPos] = useState({ top: 0, right: 0 });
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const bellBtnRef = useRef<HTMLButtonElement>(null);

  // Link previews: keyed by URL — null = fetched but empty / loading
  const [linkPreviews, setLinkPreviews] = useState<Record<string, LinkPreview | "loading">>({});

  // Mobile sidebar toggle
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const firstUnreadRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<NodeJS.Timeout | null>(null);
  const activeChannelRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<ChatRichTextInputHandle>(null);

  useEffect(() => {
    setWorkspace(workspaceId);
    // User opened this workspace's chat — clear the workspace badge in the FAB
    if (workspaceId) clearWorkspaceUnread(Number(workspaceId));
  }, [workspaceId]);
  useEffect(() => { activeChannelRef.current = activeChannelId; }, [activeChannelId]);

  // Close assign picker on outside click
  useEffect(() => {
    if (!assigningMsgId) return;
    const t = setTimeout(() => window.addEventListener("click", () => setAssigningMsgId(null), { once: true }), 0);
    return () => clearTimeout(t);
  }, [assigningMsgId]);

  // Clean up socket room on page unmount
  useEffect(() => {
    return () => {
      const socket = getSocket();
      if (activeChannelRef.current) {
        socket?.emit("channel:leave", { channelId: activeChannelRef.current });
      }
    };
  }, []);

  // Load sidebar data
  useEffect(() => {
    if (!workspaceId || !user) return;

    ensureGeneralChannel(workspaceId)
      .catch(() => {})
      .finally(() => {
        getChannels(workspaceId).then((chs) => {
          setChannels(chs);
          if (!activeChannelId && chs.length > 0) setActiveChannel(chs[0]!.id);
          // Seed channelPrefs from member data (current user's notifPref per channel)
          if (user) {
            const prefs: Record<number, ChatNotifPref> = {};
            for (const ch of chs) {
              const m = ch.members.find((mb) => mb.userId === user.id);
              if (m?.notifPref) prefs[ch.id] = m.notifPref;
            }
            setChannelPrefs((prev) => ({ ...prev, ...prefs }));
          }
        }).catch(() => {});
      });

    getDMs(workspaceId).then((dms) => {
      setDMs(dms);
      if (user) {
        const prefs: Record<number, ChatNotifPref> = {};
        for (const dm of dms) {
          const m = dm.members.find((mb) => mb.userId === user.id);
          if (m?.notifPref) prefs[dm.id] = m.notifPref;
        }
        setChannelPrefs((prev) => ({ ...prev, ...prefs }));
      }
    }).catch(() => {});
    getAllChatUsers(workspaceId).then((list) =>
      setAllUsers(list.filter((m) => m.user && m.userId !== user.id) as any)
    ).catch(() => {});
  }, [workspaceId, user?.id]);

  // Socket events — ChatProvider handles message:new, user:online/offline, call:incoming globally.
  // This effect only handles page-specific events (typing, thread replies).
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;

    const onTypingStart = (d: { userId: number; userName: string; channelId: number }) => {
      if (d.channelId === activeChannelRef.current && d.userId !== user.id) setTypingUser(d.userName);
    };
    const onTypingStop = (d: { channelId: number }) => {
      if (d.channelId === activeChannelRef.current) setTypingUser(null);
    };

    const onMessageUpdated = (updated: ChatMessage) => {
      const state = useChatStore.getState();
      const msgs = state.messages[updated.channelId] ?? [];
      if (msgs.some((m) => m.id === updated.id)) {
        state.setMessages(updated.channelId, msgs.map((m) => m.id === updated.id ? { ...m, ...updated } : m));
      }
    };

    const onReplyNew = (reply: ChatMessage) => {
      setReplies((prev) => {
        if (prev.some((r) => r.id === reply.id)) return prev;
        return reply.parentId === threadMsgRef.current?.id ? [...prev, reply] : prev;
      });
      // Update reply count using fresh store state (avoid stale closure)
      if (reply.parentId && reply.channelId) {
        const state = useChatStore.getState();
        const msgs = state.messages[reply.channelId] ?? [];
        state.setMessages(reply.channelId, msgs.map((m) =>
          m.id === reply.parentId
            ? { ...m, _count: { replies: (m._count?.replies ?? 0) + 1 } }
            : m
        ));
      }
    };

    const onRateLimited = (d: { message: string; retryAfterMs: number }) => {
      setRateLimitMsg(d.message);
      if (rateLimitTimer.current) clearTimeout(rateLimitTimer.current);
      rateLimitTimer.current = setTimeout(() => setRateLimitMsg(null), d.retryAfterMs + 500);
    };

    socket.on("typing:start", onTypingStart);
    socket.on("typing:stop", onTypingStop);
    socket.on("reply:new", onReplyNew);
    socket.on("message:updated", onMessageUpdated);
    socket.on("error:rate_limited", onRateLimited);
    return () => {
      socket.off("typing:start", onTypingStart);
      socket.off("typing:stop", onTypingStop);
      socket.off("reply:new", onReplyNew);
      socket.off("message:updated", onMessageUpdated);
      socket.off("error:rate_limited", onRateLimited);
    };
  }, [user?.id]);

  // Load messages + channel members when channel changes
  useEffect(() => {
    if (!activeChannelId || !workspaceId) return;
    setLoadingMessages(true);
    setMsgSearchResults(null);
    setShowMsgSearch(false);
    setMsgSearch("");
    setShowPinnedPanel(false);
    setFirstUnreadId(null);
    setShowJumpToUnread(false);

    // Find first unread BEFORE marking as read
    const currentUnread = unreadCounts[activeChannelId] ?? 0;

    markRead(workspaceId, activeChannelId).catch(() => {});
    getMessages(workspaceId, activeChannelId)
      .then((msgs) => {
        setMessages(activeChannelId, msgs);
        setHasMore(msgs.length >= 50);
        // Mark first unread message so we can show a divider
        if (currentUnread > 0 && msgs.length > 0) {
          const topLevel = msgs.filter((m) => !m.parentId);
          const firstUnread = topLevel[Math.max(0, topLevel.length - currentUnread)];
          if (firstUnread) {
            setFirstUnreadId(firstUnread.id);
            setShowJumpToUnread(true);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMessages(false));

    clearUnread(activeChannelId);

    const socket = getSocket();
    socket?.emit("channel:join", { channelId: activeChannelId });

    // Load channel members for member management
    getChannelMembers(workspaceId, activeChannelId)
      .then(setChannelMembers as any)
      .catch(() => {});
  }, [activeChannelId, workspaceId]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages[activeChannelId ?? 0]?.length]);

  // Fetch link previews for new messages (deduplicated, batched 3 at once)
  useEffect(() => {
    if (!activeChannelId || !workspaceId) return;
    const msgs = messages[activeChannelId] ?? [];
    const toFetch: string[] = [];
    for (const msg of msgs) {
      if (msg.isSystemMessage || msg.callType || msg.attachmentUrl) continue;
      const url = extractFirstUrl(msg.content ?? "");
      if (url && !(url in linkPreviews)) toFetch.push(url);
    }
    if (toFetch.length === 0) return;
    const batch = toFetch.slice(0, 5);
    setLinkPreviews((prev) => {
      const next = { ...prev };
      batch.forEach((u) => { next[u] = "loading"; });
      return next;
    });
    batch.forEach(async (url) => {
      try {
        const preview = await fetchLinkPreview(workspaceId, url);
        setLinkPreviews((prev) => ({ ...prev, [url]: preview }));
      } catch {
        setLinkPreviews((prev) => ({ ...prev, [url]: { url, title: null, description: null, image: null, siteName: null } }));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages[activeChannelId ?? -1]?.length, activeChannelId]);

  const allChannels = [...channels, ...dms];
  const activeChannel = allChannels.find((c) => c.id === activeChannelId) ?? null;
  const channelMessages = (activeChannelId ? messages[activeChannelId] : undefined) ?? [];
  // Use backend search results when available; otherwise show locally-loaded messages
  const topLevelMessages = msgSearchResults !== null
    ? msgSearchResults
    : channelMessages.filter((m) => !m.parentId);

  const handleSelectChannel = (ch: ChatChannel) => {
    setActiveChannel(ch.id);
    clearUnread(ch.id);
    setShowMembersPanel(false);
    setShowDMProfile(false);
    setProfileMember(null);
    setMsgSearch("");
    setShowMsgSearch(false);
    setMsgSearchResults(null);
    setShowPinnedPanel(false);
    setPinnedMessages([]);
    setInput("");       // reset Send button — editor loads draft via its own useEffect
    setMentionQuery(null);
    setShowNotifMenu(false);
    setMobileSidebarOpen(false);
  };

  // Close notif menu when clicking outside
  useEffect(() => {
    if (!showNotifMenu) return;
    const handler = (e: MouseEvent) => {
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifMenu]);

  const handleSetNotifPref = async (pref: ChatNotifPref) => {
    if (!activeChannelId || !workspaceId) return;
    const prev = channelPrefs[activeChannelId] ?? "ALL";
    setChannelPrefs((s) => ({ ...s, [activeChannelId]: pref }));
    setShowNotifMenu(false);
    try {
      await setChannelPref(workspaceId, activeChannelId, pref);
    } catch (err) {
      console.error("[notifPref] API failed:", err);
      // Restore previous value on failure
      setChannelPrefs((s) => ({ ...s, [activeChannelId]: prev }));
    }
  };

  const handleMsgSearchSubmit = async () => {
    if (!activeChannelId || !workspaceId) return;
    const q = msgSearch.trim();
    if (!q) { setMsgSearchResults(null); return; }
    setMsgSearchLoading(true);
    try {
      const results = await searchMessages(workspaceId, activeChannelId, q);
      setMsgSearchResults(results);
    } catch {}
    finally { setMsgSearchLoading(false); }
  };

  const handlePinToggle = async (msgId: number, currentlyPinned: boolean) => {
    if (!activeChannelId) return;
    const updated = await pinMessage(workspaceId, msgId, !currentlyPinned);
    if (updated) {
      setMessages(activeChannelId, channelMessages.map((m) => m.id === msgId ? { ...m, isPinned: updated.isPinned } : m));
      // Also update pinned panel if open
      if (showPinnedPanel) {
        if (updated.isPinned) {
          setPinnedMessages((prev) => [...prev.filter((m) => m.id !== msgId), updated]);
        } else {
          setPinnedMessages((prev) => prev.filter((m) => m.id !== msgId));
        }
      }
    }
  };

  const handleOpenPinnedPanel = async () => {
    if (!activeChannelId || !workspaceId) return;
    if (!showPinnedPanel) {
      try {
        const pinned = await getPinnedMessages(workspaceId, activeChannelId);
        setPinnedMessages(pinned);
      } catch {}
    }
    setShowPinnedPanel((v) => !v);
  };

  const handleJumpToUnread = () => {
    firstUnreadRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setShowJumpToUnread(false);
  };

  const resetNewChannel = () => {
    setShowNewChannel(false);
    setNewChannelName("");
    setNewChannelSearch("");
    setNewChannelMembers([]);
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    await createChannel(workspaceId, newChannelName.trim(), undefined, newChannelMembers);
    const updated = await getChannels(workspaceId);
    setChannels(updated);
    // Also re-join new channel room for any newly added members who are online
    resetNewChannel();
  };

  const toggleNewChannelMember = (uid: number) => {
    setNewChannelMembers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleStartDM = async (targetUserId: number) => {
    const dm = await getOrCreateDM(workspaceId, targetUserId);
    await joinChannel(workspaceId, dm.id);
    const updatedDMs = await getDMs(workspaceId);
    setDMs(updatedDMs);
    setActiveChannel(dm.id);
    setShowDMPicker(false);
    setMobileSidebarOpen(false);
  };

  const handleSend = async () => {
    if (!activeChannelId) return;
    const html = editorRef.current?.getHTML() ?? "";
    const text = editorRef.current?.getText() ?? input;
    const hasText = text.trim().length > 0;
    const hasFiles = pendingFiles.length > 0;
    if (!hasText && !hasFiles) return;

    // Upload pending files first, each sends as its own message
    if (hasFiles) {
      setUploading(true);
      try {
        for (const item of pendingFiles) {
          const result = await uploadChatFile(workspaceId, activeChannelId, item.file);
          const socket = getSocket();
          socket?.emit("message:send", {
            channelId: activeChannelId,
            content: result.originalName,
            attachmentUrl: result.url,
            attachmentType: result.type,
          });
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        }
        setPendingFiles([]);
      } catch {
        alert("File upload failed. Max size is 20MB.");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    // Send text message if any
    if (hasText) {
      sendChatMessage({ channelId: activeChannelId, content: html });
      editorRef.current?.clearContent();
      setInput("");
      setMentionQuery(null);
    }

    const socket = getSocket();
    socket?.emit("typing:stop", { channelId: activeChannelId });
  };

  /** Called by the TipTap editor on every content change */
  const handleEditorUpdate = (html: string, text: string) => {
    setInput(text); // shadow plain-text for disabled check & @mention detection
    if (!user || !activeChannelId) return;
    const socket = getSocket();
    socket?.emit("typing:start", { channelId: activeChannelId, userName: `${user.firstName} ${user.lastName}` });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket?.emit("typing:stop", { channelId: activeChannelId });
    }, 2000);
    // Detect @mention at the end of the plain text
    const atMatch = text.match(/@([a-zA-Z0-9_]*)$/);
    setMentionQuery(atMatch ? (atMatch[1] ?? null) : null);
  };

  const handlePickMention = (member: { userId: number; user: { firstName: string; lastName: string } }) => {
    const name = `${member.user.firstName} ${member.user.lastName}`;
    editorRef.current?.insertMention(name, mentionQuery ?? "");
    setMentionQuery(null);
  };

  const handleDeleteMessage = async (msgId: number) => {
    await deleteMessage(workspaceId, msgId);
    if (activeChannelId) {
      setMessages(activeChannelId, channelMessages.filter((m) => m.id !== msgId));
    }
  };

  const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

  const handleToggleReaction = async (msgId: number, emoji: string) => {
    if (!activeChannelId) return;
    const updated = await toggleReaction(workspaceId, msgId, emoji);
    if (updated) setMessages(activeChannelId, channelMessages.map((m) => m.id === msgId ? { ...m, ...updated } : m));
    setReactionPickerMsgId(null);
  };

  const handleSaveMessageEdit = async () => {
    if (!editingMsgId || !editingMsgContent.trim() || !activeChannelId) return;
    const updated = await editMessage(workspaceId, editingMsgId, editingMsgContent);
    setMessages(activeChannelId, channelMessages.map((m) => m.id === editingMsgId ? { ...m, ...updated } : m));
    setEditingMsgId(null);
    setEditingMsgContent("");
  };

  const handleSaveChannelEdit = async () => {
    if (!activeChannelId) return;
    const trimmed = editChannelName.trim();
    if (!trimmed) return;
    await updateChannel(workspaceId, activeChannelId, {
      name: trimmed,
      description: editChannelDesc.trim(),
    });
    const updated = await getChannels(workspaceId);
    setChannels(updated);
    setEditingChannel(false);
  };

  const handleLoadMore = async () => {
    if (!activeChannelId || !workspaceId || loadingMore) return;
    const oldest = topLevelMessages[0];
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const older = await getMessages(workspaceId, activeChannelId, oldest.id);
      if (older.length > 0) {
        setMessages(activeChannelId, [...older, ...channelMessages]);
      }
      setHasMore(older.length >= 50);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleAssign = async (msgId: number, assigneeId: number) => {
    const updated = await apiAssignMessage(workspaceId, msgId, assigneeId);
    // Update the message in the store so assignedTo shows immediately
    if (activeChannelId) {
      setMessages(activeChannelId, channelMessages.map((m) => m.id === msgId ? { ...m, ...updated } : m));
    }
    setAssigningMsgId(null);
  };

  // Thread panel
  const openThread = async (msg: ChatMessage) => {
    setThreadMsg(msg);
    threadMsgRef.current = msg;
    const r = await getReplies(workspaceId, msg.id);
    setReplies(r);
  };

  const handleSendReply = async () => {
    if (!replyInput.trim() || !threadMsg || !activeChannelId) return;
    const socket = getSocket();
    socket?.emit("message:send", {
      channelId: activeChannelId,
      content: replyInput.trim(),
      parentId: threadMsg.id,
    });
    setReplyInput("");
  };

  const handleReplyFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !threadMsg || !activeChannelId) return;
    e.target.value = "";
    setReplyUploading(true);
    try {
      const result = await uploadChatFile(workspaceId, activeChannelId, file);
      const socket = getSocket();
      socket?.emit("message:send", {
        channelId: activeChannelId,
        content: result.originalName,
        attachmentUrl: result.url,
        attachmentType: result.type,
        parentId: threadMsg.id,
      });
    } catch {
      alert("File upload failed.");
    } finally {
      setReplyUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !activeChannelId) return;
    e.target.value = "";
    setPendingFiles((prev) => [
      ...prev,
      ...files.map((file) => ({
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
        name: file.name,
        fileType: (file.type.startsWith("image/") ? "image" : "file") as "image" | "file",
      })),
    ]);
  };

  const handleAddMember = async (targetUserId: number) => {
    if (!activeChannelId) return;
    await addChannelMember(workspaceId, activeChannelId, targetUserId);
    const updated = await getChannelMembers(workspaceId, activeChannelId);
    setChannelMembers(updated as any);
    setAddMemberSearch("");
  };

  const handleRemoveMember = async (targetUserId: number) => {
    if (!activeChannelId) return;
    await removeChannelMember(workspaceId, activeChannelId, targetUserId);
    const updated = await getChannelMembers(workspaceId, activeChannelId);
    setChannelMembers(updated as any);
    if (profileMember?.userId === targetUserId) setProfileMember(null);
  };

  // Display name for current channel
  const isDM = activeChannel?.type === "DIRECT";
  const otherMember = isDM
    ? activeChannel?.members.find((m) => m.userId !== user?.id)
    : null;
  const displayName = isDM
    ? `${(otherMember as any)?.user?.firstName ?? ""} ${(otherMember as any)?.user?.lastName ?? ""}`.trim()
    : activeChannel?.name ?? "";

  const filteredDMUsers = allUsers.filter((m) =>
    `${m.user.firstName} ${m.user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const memberUserIds = new Set(channelMembers.map((m) => m.userId));
  const nonMemberUsers = allUsers.filter(
    (u) => !memberUserIds.has(u.userId) &&
      `${u.user.firstName} ${u.user.lastName}`.toLowerCase().includes(addMemberSearch.toLowerCase())
  );

  // Group messages for rendering
  let lastDate = "";

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* ── LEFT SIDEBAR ─────────────────────────────────────── */}
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 sm:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}
      <div className={`${mobileSidebarOpen ? "flex" : "hidden"} sm:flex fixed inset-y-0 left-0 z-30 w-64 shrink-0 flex-col border-r border-border bg-background sm:relative sm:z-auto sm:bg-muted/30`}>
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-4">
          <MessageSquare className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-bold text-foreground">Team Chat</span>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* Channels */}
          <div className="mb-2">
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Channels
              </span>
              <button
                onClick={() => { setShowNewChannel(true); setShowDMPicker(false); }}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {showNewChannel && (
              <div className="mx-3 mb-2 rounded-lg border border-indigo-200 bg-background p-3 shadow-sm">
                {/* Channel name */}
                <div className="mb-2 flex items-center gap-1">
                  <span className="text-muted-foreground text-sm">#</span>
                  <input
                    autoFocus
                    placeholder="channel-name"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") resetNewChannel(); }}
                    className="flex-1 rounded border border-indigo-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>

                {/* Member search */}
                <input
                  placeholder="Add members…"
                  value={newChannelSearch}
                  onChange={(e) => setNewChannelSearch(e.target.value)}
                  className="mb-1.5 w-full rounded border border-border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />

                {/* User list */}
                <div className="max-h-36 overflow-y-auto space-y-0.5">
                  {allUsers
                    .filter((m) =>
                      `${m.user.firstName} ${m.user.lastName}`
                        .toLowerCase()
                        .includes(newChannelSearch.toLowerCase())
                    )
                    .map((m) => {
                      const selected = newChannelMembers.includes(m.userId);
                      const isOnline = onlineUserIds.has(m.userId);
                      return (
                        <button
                          key={m.userId}
                          onClick={() => toggleNewChannelMember(m.userId)}
                          className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition-colors ${
                            selected
                              ? "bg-indigo-500/10 text-indigo-700"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <div className="relative shrink-0">
                            {m.user.avatarUrl ? (
                              <img src={av(m.user.avatarUrl)} className="h-5 w-5 rounded-full object-cover" alt="" />
                            ) : (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500/10 text-[9px] font-bold text-indigo-600">
                                {m.user.firstName[0]}{m.user.lastName[0]}
                              </div>
                            )}
                            <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background ${isOnline ? "bg-green-400" : "bg-muted-foreground/40"}`} />
                          </div>
                          <span className="flex-1 truncate">{m.user.firstName} {m.user.lastName}</span>
                          {selected && <span className="text-indigo-500">✓</span>}
                        </button>
                      );
                    })}
                </div>

                {/* Selected count + actions */}
                {newChannelMembers.length > 0 && (
                  <p className="mt-1.5 text-[10px] text-indigo-500">{newChannelMembers.length} member{newChannelMembers.length !== 1 ? "s" : ""} selected</p>
                )}
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={handleCreateChannel}
                    disabled={!newChannelName.trim()}
                    className="flex-1 rounded bg-indigo-500 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-40"
                  >
                    Create
                  </button>
                  <button
                    onClick={resetNewChannel}
                    className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {channels.map((ch) => {
              const unread = unreadCounts[ch.id] ?? 0;
              const pref = channelPrefs[ch.id] ?? "ALL";
              const isMuted = pref === "MUTED";
              return (
                <button
                  key={ch.id}
                  onClick={() => handleSelectChannel(ch)}
                  className={`flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm transition-colors ${
                    activeChannelId === ch.id
                      ? "bg-indigo-500/10 font-semibold text-indigo-700"
                      : isMuted ? "text-muted-foreground hover:bg-muted" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{ch.name}</span>
                  {isMuted && <BellOff className="h-3 w-3 shrink-0 text-muted-foreground" />}
                  {!isMuted && unread > 0 && (
                    <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
              );
            })}

            {channels.length === 0 && !showNewChannel && (
              <p className="px-4 py-1 text-[11px] text-muted-foreground">No channels yet</p>
            )}
          </div>

          {/* Direct Messages */}
          <div>
            <div className="flex items-center justify-between px-4 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Direct Messages
              </span>
              <button
                onClick={() => { setShowDMPicker(!showDMPicker); setShowNewChannel(false); }}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {showDMPicker && (
              <div className="mx-3 mb-2 overflow-hidden rounded-lg border border-border bg-background shadow-md">
                <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
                  <Search className="h-3 w-3 text-muted-foreground" />
                  <input
                    autoFocus
                    placeholder="Search people…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 text-xs outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto">
                  {filteredDMUsers.length === 0 && (
                    <p className="px-3 py-2 text-[11px] text-muted-foreground">No users found</p>
                  )}
                  {filteredDMUsers.map((m) => {
                    const isOnline = onlineUserIds.has(m.userId);
                    return (
                      <button
                        key={m.userId}
                        onClick={() => handleStartDM(m.userId)}
                        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted"
                      >
                        <div className="relative shrink-0">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={av(m.user.avatarUrl)} />
                            <AvatarFallback className="text-[9px]">
                              {m.user.firstName[0]}{m.user.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background ${isOnline ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate font-medium">{m.user.firstName} {m.user.lastName}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{isOnline ? "Online" : "Offline"}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {dms.map((dm) => {
              const other = dm.members.find((m) => m.userId !== user?.id);
              if (!other) return null;
              const otherUser = (other as any).user;
              if (!otherUser) return null;
              const isOnline = onlineUserIds.has(otherUser.id);
              const unread = unreadCounts[dm.id] ?? 0;
              return (
                <button
                  key={dm.id}
                  onClick={() => handleSelectChannel(dm)}
                  className={`flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm transition-colors ${
                    activeChannelId === dm.id
                      ? "bg-indigo-500/10 font-semibold text-indigo-700"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={av(otherUser.avatarUrl)} />
                      <AvatarFallback className="text-[9px]">
                        {otherUser.firstName[0]}{otherUser.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background ${isOnline ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                  </div>
                  <span className="flex-1 truncate">{otherUser.firstName} {otherUser.lastName}</span>
                  {unread > 0 && (
                    <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
              );
            })}

            {dms.length === 0 && (
              <p className="px-4 py-1 text-[11px] text-muted-foreground">No direct messages yet</p>
            )}
          </div>
        </div>

        {/* Online count */}
        <div className="flex items-center gap-1.5 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-green-400" />
          <span>{onlineUserIds.size} online</span>
        </div>
      </div>

      {/* ── MAIN CHAT AREA ───────────────────────────────────── */}
      {activeChannel ? (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Channel Header */}
            <div className="group flex items-center justify-between border-b border-border px-6 py-3">
              <button
                className="mr-2 shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted sm:hidden"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                {isDM && otherMember ? (
                  <button
                    onClick={() => setShowDMProfile((v) => !v)}
                    className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-muted transition-colors"
                  >
                    <div className="relative">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={av((otherMember as any).user?.avatarUrl)} />
                        <AvatarFallback className="text-[10px]">
                          {(otherMember as any).user?.firstName?.[0]}{(otherMember as any).user?.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${onlineUserIds.has((otherMember as any).user?.id) ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground">{displayName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {onlineUserIds.has((otherMember as any).user?.id) ? "● Online" : "○ Offline"}
                      </p>
                    </div>
                  </button>
                ) : editingChannel ? (
                  <div className="flex items-center gap-2">
                    <Hash className="h-5 w-5 text-muted-foreground shrink-0" />
                    <input
                      autoFocus
                      value={editChannelName}
                      onChange={(e) => setEditChannelName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveChannelEdit(); if (e.key === "Escape") setEditingChannel(false); }}
                      className="rounded border border-indigo-300 px-2 py-0.5 text-sm font-semibold text-foreground outline-none focus:ring-1 focus:ring-indigo-400 w-36"
                    />
                    <input
                      value={editChannelDesc}
                      onChange={(e) => setEditChannelDesc(e.target.value)}
                      placeholder="Description (optional)"
                      className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-indigo-300 w-44"
                    />
                    <button onClick={handleSaveChannelEdit} className="rounded bg-indigo-600 px-2 py-0.5 text-xs text-white hover:bg-indigo-700">Save</button>
                    <button onClick={() => setEditingChannel(false)} className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted">Cancel</button>
                  </div>
                ) : (
                  <>
                    <Hash className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-foreground">{displayName}</p>
                        <button
                          onClick={() => { setEditChannelName(displayName); setEditChannelDesc(activeChannel.description ?? ""); setEditingChannel(true); }}
                          className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-opacity"
                          title="Rename channel"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{activeChannel.members.length} members</span>
                        {activeChannel.description && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[280px]" title={activeChannel.description}>
                              {activeChannel.description}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Call buttons */}
                <button
                  onClick={() => {
                    const socket = getSocket();
                    const chId = activeChannelId!;
                    socket?.emit("call:start", {
                      channelId: chId, callType: "video",
                      workspaceId, callerName: `${user?.firstName} ${user?.lastName}`, channelName: displayName,
                    }, (ack: { callMessageId?: number; roomName?: string; livekitToken?: string; livekitUrl?: string }) => {
                      if (ack?.roomName && ack?.livekitToken) {
                        setActiveCall({
                          roomName: ack.roomName, channelId: chId, startWithVideoMuted: false,
                          livekitToken: ack.livekitToken, livekitUrl: ack.livekitUrl ?? "",
                          callMessageId: ack.callMessageId,
                        });
                      }
                    });
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-green-500/10 hover:border-green-300 hover:text-green-700"
                >
                  <Video className="h-3.5 w-3.5" />
                  Video
                </button>
                <button
                  onClick={() => {
                    const socket = getSocket();
                    const chId = activeChannelId!;
                    socket?.emit("call:start", {
                      channelId: chId, callType: "voice",
                      workspaceId, callerName: `${user?.firstName} ${user?.lastName}`, channelName: displayName,
                    }, (ack: { callMessageId?: number; roomName?: string; livekitToken?: string; livekitUrl?: string }) => {
                      if (ack?.roomName && ack?.livekitToken) {
                        setActiveCall({
                          roomName: ack.roomName, channelId: chId, startWithVideoMuted: true,
                          livekitToken: ack.livekitToken, livekitUrl: ack.livekitUrl ?? "",
                          callMessageId: ack.callMessageId,
                        });
                      }
                    });
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-blue-500/10 hover:border-blue-300 hover:text-blue-700"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Voice
                </button>

                {/* Scheduled messages */}
                <button
                  onClick={handleLoadScheduled}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    showScheduledList
                      ? "border-indigo-300 bg-indigo-500/10 text-indigo-700"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                  title="Scheduled messages"
                >
                  <Clock className="h-3.5 w-3.5" />
                  {scheduledList.filter(m => m.status === "PENDING").length > 0 && (
                    <span className="text-[10px] font-bold">{scheduledList.filter(m => m.status === "PENDING").length}</span>
                  )}
                </button>
                {/* Pinned messages */}
                <button
                  onClick={handleOpenPinnedPanel}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    showPinnedPanel
                      ? "border-amber-300 bg-amber-500/10 text-amber-700"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                  title="Pinned messages"
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
                {/* Notification pref */}
                <div ref={notifMenuRef}>
                  <button
                    ref={bellBtnRef}
                    onClick={() => {
                      if (!showNotifMenu && bellBtnRef.current) {
                        const r = bellBtnRef.current.getBoundingClientRect();
                        setNotifMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
                      }
                      setShowNotifMenu((v) => !v);
                    }}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      channelPrefs[activeChannelId ?? -1] === "MUTED"
                        ? "border-border bg-muted text-muted-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                    title="Notification preferences"
                  >
                    {channelPrefs[activeChannelId ?? -1] === "MUTED" ? (
                      <BellOff className="h-3.5 w-3.5" />
                    ) : channelPrefs[activeChannelId ?? -1] === "MENTIONS" ? (
                      <BellMinus className="h-3.5 w-3.5" />
                    ) : (
                      <Bell className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {showNotifMenu && (
                    <div
                      style={{ position: "fixed", top: notifMenuPos.top, right: notifMenuPos.right, zIndex: 9999 }}
                      className="w-48 rounded-xl border border-border bg-popover py-1 shadow-lg"
                    >
                      {(["ALL", "MENTIONS", "MUTED"] as ChatNotifPref[]).map((pref) => {
                        const Icon = pref === "MUTED" ? BellOff : pref === "MENTIONS" ? BellMinus : Bell;
                        const labels = { ALL: "All messages", MENTIONS: "Mentions only", MUTED: "Muted" };
                        const cur = channelPrefs[activeChannelId ?? -1] ?? "ALL";
                        return (
                          <button
                            key={pref}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSetNotifPref(pref);
                            }}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-muted ${
                              cur === pref ? "font-semibold text-indigo-600" : "text-foreground"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            {labels[pref]}
                            {cur === pref && <Check className="ml-auto h-3 w-3" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* Search messages */}
                <button
                  onClick={() => { setShowMsgSearch((v) => !v); setMsgSearch(""); setMsgSearchResults(null); }}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    showMsgSearch
                      ? "border-indigo-300 bg-indigo-500/10 text-indigo-700"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                  title="Search messages"
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
                {/* Member management (channels only) */}
                {!isDM && (
                  <button
                    onClick={() => setShowMembersPanel(!showMembersPanel)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      showMembersPanel
                        ? "border-indigo-300 bg-indigo-500/10 text-indigo-700"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                    title="Manage members"
                  >
                    <Users className="h-3.5 w-3.5" />
                    Members
                  </button>
                )}
              </div>
            </div>

            {/* Message search bar */}
            {showMsgSearch && (
              <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-6 py-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  autoFocus
                  placeholder="Search messages… press Enter"
                  value={msgSearch}
                  onChange={(e) => { setMsgSearch(e.target.value); if (!e.target.value.trim()) setMsgSearchResults(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleMsgSearchSubmit(); }}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                {msgSearchLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                {msgSearchResults !== null && (
                  <span className="text-[11px] text-muted-foreground">{msgSearchResults.length} result{msgSearchResults.length !== 1 ? "s" : ""}</span>
                )}
                {msgSearch && (
                  <button onClick={() => { setMsgSearch(""); setMsgSearchResults(null); }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Scheduled messages panel */}
            {showScheduledList && (
              <div className="border-b border-indigo-900/20 dark:border-indigo-900/50 bg-indigo-500/10 px-6 py-3">
                <div className="mb-2 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-indigo-600" />
                  <span className="text-xs font-semibold text-indigo-800">Scheduled Messages</span>
                  <span className="ml-auto text-[11px] text-indigo-500">{scheduledList.filter(m => m.status === "PENDING").length} pending</span>
                  <button onClick={() => setShowScheduledList(false)} className="text-indigo-400 hover:text-indigo-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {scheduledList.filter(m => m.status === "PENDING").length === 0 ? (
                  <p className="text-xs text-indigo-600">No scheduled messages for this channel.</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                    {scheduledList.filter(m => m.status === "PENDING").map((sm) => (
                      <div key={sm.id} className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-background px-3 py-2">
                        <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-indigo-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-semibold text-indigo-600">
                            {new Date(sm.scheduledAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <div className="text-xs text-muted-foreground line-clamp-1"><RichContent content={sm.content} /></div>
                        </div>
                        <button
                          onClick={() => handleCancelScheduled(sm.id)}
                          className="shrink-0 text-muted-foreground hover:text-red-500 transition-colors"
                          title="Cancel"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pinned messages panel */}
            {showPinnedPanel && (
              <div className="border-b border-amber-900/20 dark:border-amber-900/50 bg-amber-500/10 px-6 py-3">
                <div className="mb-2 flex items-center gap-2">
                  <Pin className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-800">Pinned Messages</span>
                  <span className="ml-auto text-[11px] text-amber-600">{pinnedMessages.length} pinned</span>
                </div>
                {pinnedMessages.length === 0 ? (
                  <p className="text-xs text-amber-700">No pinned messages in this channel.</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                    {pinnedMessages.map((pm) => (
                      <div key={pm.id} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-background px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-semibold text-foreground">{pm.user.firstName} {pm.user.lastName}</span>
                          <div className="text-xs text-muted-foreground truncate"><RichContent content={pm.content} /></div>
                        </div>
                        <button
                          onClick={() => handlePinToggle(pm.id, true)}
                          className="shrink-0 text-amber-400 hover:text-red-500 transition-colors"
                          title="Unpin"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Jump to unread banner */}
            {showJumpToUnread && firstUnreadId && (
              <div className="flex justify-center border-b border-indigo-900/20 dark:border-indigo-900/50 bg-indigo-500/10 py-1.5">
                <button
                  onClick={handleJumpToUnread}
                  className="flex items-center gap-1.5 rounded-full border border-indigo-200 bg-background px-4 py-1 text-xs font-medium text-indigo-700 shadow-sm hover:bg-muted transition-colors"
                >
                  <ArrowDown className="h-3 w-3" />
                  Jump to first unread
                </button>
              </div>
            )}

            {/* Search result notice */}
            {msgSearchResults !== null && (
              <div className="flex items-center gap-2 border-b border-indigo-900/20 dark:border-indigo-900/50 bg-indigo-500/10 px-6 py-1.5 text-xs text-indigo-700">
                <BookmarkCheck className="h-3.5 w-3.5 shrink-0" />
                Showing {msgSearchResults.length} search result{msgSearchResults.length !== 1 ? "s" : ""} for <strong className="ml-1">"{msgSearch}"</strong>
                <button onClick={() => { setMsgSearchResults(null); setMsgSearch(""); setShowMsgSearch(false); }} className="ml-auto text-indigo-400 hover:text-indigo-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Messages */}
            <div
              className="relative flex-1 overflow-y-auto px-6 py-4"
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop < 100 && hasMore && !loadingMore && !loadingMessages) {
                  handleLoadMore();
                }
              }}
            >
              {loadingMessages && (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {!loadingMessages && hasMore && (
                <div className="flex justify-center pb-2">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm hover:bg-muted disabled:opacity-50"
                  >
                    {loadingMore ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    {loadingMore ? "Loading…" : "Load older messages"}
                  </button>
                </div>
              )}

              {!loadingMessages && topLevelMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10">
                    {isDM ? <MessageSquare className="h-6 w-6 text-indigo-400" /> : <Hash className="h-6 w-6 text-indigo-400" />}
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {isDM ? `Start a conversation with ${displayName}` : `Welcome to #${displayName}`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Send your first message below</p>
                </div>
              )}

              {topLevelMessages.map((msg, i) => {
                const msgDate = formatDate(msg.createdAt);
                const showDate = msgDate !== lastDate;
                if (showDate) lastDate = msgDate;
                const prevMsg = topLevelMessages[i - 1];
                const isGrouped =
                  prevMsg &&
                  prevMsg.userId === msg.userId &&
                  new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 120_000;

                // ── Call system message ──────────────────────────────────
                if (msg.isSystemMessage && msg.callType) {
                  const isVideo = msg.callType === "video";
                  const statusColor =
                    msg.callStatus === "ended" ? "text-green-600 bg-green-500/10 border-green-200 dark:text-green-400 dark:border-green-900/50" :
                    msg.callStatus === "declined" || msg.callStatus === "missed" ? "text-red-500 bg-red-500/10 border-red-200 dark:text-red-400 dark:border-red-900/50" :
                    "text-indigo-600 bg-indigo-500/10 border-indigo-200 dark:text-indigo-400 dark:border-indigo-900/50";
                  const statusLabel =
                    msg.callStatus === "ended" ? "Call ended" :
                    msg.callStatus === "declined" ? "Call declined" :
                    msg.callStatus === "missed" ? "Missed call" : "Call started";
                  const durationStr = msg.callDuration && msg.callStatus === "ended"
                    ? msg.callDuration >= 60
                      ? `${Math.floor(msg.callDuration / 60)}m ${msg.callDuration % 60}s`
                      : `${msg.callDuration}s`
                    : null;

                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="my-4 flex items-center gap-3">
                          <div className="flex-1 h-px bg-border" />
                          <span className="shrink-0 rounded-full border border-border px-3 py-0.5 text-[11px] text-muted-foreground">{msgDate}</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}
                      <div className="my-3 flex justify-center">
                        <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium ${statusColor}`}>
                          {isVideo
                            ? <Video className="h-3.5 w-3.5" />
                            : <Phone className="h-3.5 w-3.5" />
                          }
                          <span>{msg.user.firstName} {msg.user.lastName} · {isVideo ? "Video" : "Voice"} call · {statusLabel}</span>
                          {durationStr && <span className="opacity-70">· {durationStr}</span>}
                          <span className="opacity-50">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                // ── End call system message ───────────────────────────────

                const isFirstUnread = firstUnreadId === msg.id;

                return (
                  <div key={msg.id} ref={isFirstUnread ? firstUnreadRef : undefined}>
                    {showDate && (
                      <div className="my-4 flex items-center gap-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="shrink-0 rounded-full border border-border px-3 py-0.5 text-[11px] text-muted-foreground">
                          {msgDate}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}

                    {/* New messages divider */}
                    {isFirstUnread && (
                      <div className="my-2 flex items-center gap-2">
                        <div className="flex-1 h-px bg-indigo-300" />
                        <span className="shrink-0 rounded-full bg-indigo-500 px-3 py-0.5 text-[10px] font-semibold text-white">New</span>
                        <div className="flex-1 h-px bg-indigo-300" />
                      </div>
                    )}

                    <div className={`group relative flex gap-3 ${isGrouped ? "mt-0.5" : "mt-4"} ${msg.isPinned ? "rounded-lg bg-amber-500/10 pr-2" : ""}`}>
                      <div className="w-8 shrink-0 pt-0.5">
                        {!isGrouped && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={av(msg.user.avatarUrl)} />
                            <AvatarFallback className="text-[11px]">
                              {msg.user.firstName[0]}{msg.user.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {!isGrouped && (
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-foreground">
                              {msg.user.firstName} {msg.user.lastName}
                            </span>
                            <span className="text-[11px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
                          </div>
                        )}

                        {/* Attachment rendering */}
                        {msg.attachmentUrl && msg.attachmentType === "image" && (
                          <a
                            href={resolveUrl(msg.attachmentUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="mb-1 block"
                          >
                            <img
                              src={resolveUrl(msg.attachmentUrl)}
                              alt={msg.content}
                              className="max-h-64 max-w-sm rounded-lg border border-border object-contain"
                            />
                          </a>
                        )}
                        {msg.attachmentUrl && msg.attachmentType === "file" && (
                          <a
                            href={resolveUrl(msg.attachmentUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="mb-1 flex w-fit items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-foreground hover:bg-muted"
                          >
                            <Download className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{msg.content}</span>
                          </a>
                        )}

                        <div className="relative">
                          {/* Message content — inline edit when active */}
                          {!msg.attachmentUrl && (
                            editingMsgId === msg.id ? (
                              <div className="flex flex-1 flex-col gap-1">
                                <textarea
                                  autoFocus
                                  value={editingMsgContent}
                                  onChange={(e) => setEditingMsgContent(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSaveMessageEdit(); }
                                    if (e.key === "Escape") { setEditingMsgId(null); }
                                  }}
                                  className="w-full rounded border border-indigo-300 px-2 py-1 text-sm leading-relaxed text-foreground outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
                                  rows={2}
                                />
                                <div className="flex gap-1.5 text-[11px]">
                                  <button onClick={handleSaveMessageEdit} className="rounded bg-indigo-600 px-2 py-0.5 text-white hover:bg-indigo-700">Save</button>
                                  <button onClick={() => setEditingMsgId(null)} className="rounded border border-border px-2 py-0.5 text-muted-foreground hover:bg-muted">Cancel</button>
                                  <span className="text-muted-foreground self-center">Enter to save · Esc to cancel</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex-1 break-words">
                                <RichContent content={msg.content} className="text-foreground" allUsers={allUsers} onMentionClick={setMentionProfileUserId} />
                                {msg.editedAt && <span className="ml-1 text-[10px] text-muted-foreground">(edited)</span>}
                                {msg.isPinned && (
                                  <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-amber-500">
                                    <Pin className="h-2.5 w-2.5" />pinned
                                  </span>
                                )}
                                {/* Link preview card */}
                                {!msg.attachmentUrl && !msg.isSystemMessage && !msg.callType && (() => {
                                  const url = extractFirstUrl(msg.content ?? "");
                                  const p = url ? linkPreviews[url] : undefined;
                                  if (p && p !== "loading") return <LinkPreviewCard preview={p} />;
                                  return null;
                                })()}
                              </div>
                            )
                          )}
                          {/* Hover action buttons — floats above message on hover */}
                          <div className="absolute -top-8 right-0 hidden group-hover:flex items-center gap-0.5 rounded-lg border border-border bg-popover px-1 py-0.5 shadow-md z-20">
                            {/* Reply button */}
                            <button
                              onClick={() => openThread(msg)}
                              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-indigo-600"
                              title="Reply in thread"
                            >
                              <CornerDownRight className="h-3.5 w-3.5" />
                            </button>
                            {/* Assign button */}
                            <div className="relative">
                              <button
                                onClick={() => setAssigningMsgId(assigningMsgId === msg.id ? null : msg.id)}
                                className={`rounded p-1.5 transition-colors ${
                                  msg.assignedTo ? "text-green-600" : "text-muted-foreground hover:bg-muted hover:text-indigo-600"
                                }`}
                                title="Assign to someone"
                              >
                                {msg.assignedTo ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                              </button>
                              {assigningMsgId === msg.id && (
                                <div className="absolute right-0 top-8 z-50 w-44 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                                  <p className="border-b border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Assign to</p>
                                  <div className="max-h-36 overflow-y-auto">
                                    {allUsers.map((m) => (
                                      <button
                                        key={m.userId}
                                        onClick={() => handleAssign(msg.id, m.userId)}
                                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted"
                                      >
                                        <Avatar className="h-5 w-5 shrink-0">
                                          <AvatarImage src={av(m.user.avatarUrl)} />
                                          <AvatarFallback className="text-[9px]">{m.user.firstName[0]}{m.user.lastName[0]}</AvatarFallback>
                                        </Avatar>
                                        <span className="truncate">{m.user.firstName} {m.user.lastName}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            {/* Reaction button */}
                            {!msg.isSystemMessage && (
                              <div className="relative">
                                <button
                                  onClick={() => setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id)}
                                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-yellow-600 transition-colors"
                                  title="Add reaction"
                                >
                                  <SmilePlus className="h-3.5 w-3.5" />
                                </button>
                                {reactionPickerMsgId === msg.id && (
                                  <div className="absolute right-0 top-8 z-50 flex gap-1 rounded-xl border border-border bg-popover p-1.5 shadow-lg">
                                    {QUICK_EMOJIS.map((e) => (
                                      <button
                                        key={e}
                                        onClick={() => handleToggleReaction(msg.id, e)}
                                        className="rounded p-1 text-base hover:bg-muted transition-colors"
                                      >
                                        {e}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {/* Pin message */}
                            {!msg.isSystemMessage && (
                              <button
                                onClick={() => handlePinToggle(msg.id, !!msg.isPinned)}
                                className={`rounded p-1.5 transition-colors ${
                                  msg.isPinned
                                    ? "text-amber-500 hover:bg-amber-500/10"
                                    : "text-muted-foreground hover:bg-muted hover:text-amber-500"
                                }`}
                                title={msg.isPinned ? "Unpin message" : "Pin message"}
                              >
                                <Pin className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {/* Edit + Delete (own messages only) */}
                            {msg.userId === user?.id && !msg.isSystemMessage && (
                              <>
                                <button
                                  onClick={() => { setEditingMsgId(msg.id); setEditingMsgContent(msg.content); }}
                                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-indigo-600 transition-colors"
                                  title="Edit message"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="rounded p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                  title="Delete message"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {/* Reaction bubbles */}
                        {(msg.reactions?.length ?? 0) > 0 && (() => {
                          const grouped: Record<string, { count: number; myReaction: boolean }> = {};
                          for (const r of msg.reactions ?? []) {
                            if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, myReaction: false };
                            grouped[r.emoji]!.count++;
                            if (r.userId === user?.id) grouped[r.emoji]!.myReaction = true;
                          }
                          return (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {Object.entries(grouped).map(([emoji, { count, myReaction }]) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleToggleReaction(msg.id, emoji)}
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                                    myReaction
                                      ? "border-indigo-300 bg-indigo-500/10 text-indigo-700"
                                      : "border-border bg-muted/50 text-muted-foreground hover:border-indigo-200 hover:bg-indigo-500/10"
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  <span className="font-medium">{count}</span>
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                        {/* assignedTo badge + reply count */}
                        {(msg.assignedTo || (msg._count?.replies ?? 0) > 0) && (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {msg.assignedTo && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-900/20 dark:border-indigo-900/50 bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-600">
                                <AtSign className="h-2.5 w-2.5" />
                                {msg.assignedTo.firstName} {msg.assignedTo.lastName}
                              </span>
                            )}
                            {(msg._count?.replies ?? 0) > 0 && (
                              <button
                                onClick={() => openThread(msg)}
                                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-indigo-200 hover:bg-indigo-500/10 hover:text-indigo-600 transition-colors"
                              >
                                <CornerDownRight className="h-2.5 w-2.5" />
                                {msg._count?.replies} {msg._count?.replies === 1 ? "reply" : "replies"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>{/* closes flex-1 min-w-0 */}
                    </div>
                  </div>
                );
              })}

              {/* Seen by — show below the last message */}
              {(() => {
                const lastMsg = topLevelMessages[topLevelMessages.length - 1];
                if (!lastMsg || lastMsg.userId !== user?.id) return null;
                const seenBy = (activeChannel?.members ?? []).filter(
                  (m) => m.userId !== user?.id && m.lastReadAt && m.lastReadAt >= lastMsg.createdAt,
                );
                const seenUsers = seenBy
                  .map((m) => channelMembers.find((cm) => cm.userId === m.userId)?.user)
                  .filter(Boolean);
                if (seenUsers.length === 0) return null;
                return (
                  <div className="mt-1 flex items-center gap-1 px-1 text-[10px] text-muted-foreground">
                    <span>Seen by</span>
                    <div className="flex -space-x-1">
                      {seenUsers.slice(0, 5).map((u) => (
                        <Avatar key={u!.id} className="h-3.5 w-3.5 ring-1 ring-background">
                          <AvatarImage src={av(u!.avatarUrl)} />
                          <AvatarFallback className="text-[7px]">{u!.firstName[0]}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    {seenUsers.length > 5 && <span>+{seenUsers.length - 5}</span>}
                  </div>
                );
              })()}

              {typingUser && (
                <div className="mt-2 flex items-center gap-2 text-[11px] italic text-muted-foreground">
                  <div className="flex gap-0.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                  </div>
                  <span>{typingUser} is typing…</span>
                </div>
              )}
              {rateLimitMsg && (
                <div className="mt-1 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-600">
                  <BellOff className="h-3 w-3 shrink-0" />
                  {rateLimitMsg}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Reconnecting banner */}
            {!isSocketConnected && (
              <div className="flex items-center justify-center gap-2 border-t border-amber-900/20 dark:border-amber-900/50 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700">
                <Loader2 className="h-3 w-3 animate-spin" />
                Reconnecting… queued messages will send when connection is restored.
              </div>
            )}

            {/* Message Input */}
            <div className="border-t border-border px-6 py-4 pr-20">
              {/* @mention autocomplete */}
              {mentionQuery !== null && (
                <div className="mb-2 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                  {channelMembers
                    .filter((m) => m.userId !== user?.id)
                    .filter((m) =>
                      !mentionQuery ||
                      `${m.user.firstName} ${m.user.lastName}`.toLowerCase().startsWith(mentionQuery.toLowerCase())
                    )
                    .slice(0, 6)
                    .map((m) => (
                      <button
                        key={m.userId}
                        onMouseDown={(e) => { e.preventDefault(); handlePickMention(m as any); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarImage src={av((m.user as any).avatarUrl)} />
                          <AvatarFallback className="text-[9px]">{m.user.firstName[0]}{m.user.lastName[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{m.user.firstName} {m.user.lastName}</span>
                      </button>
                    ))}
                  {channelMembers.filter((m) => m.userId !== user?.id && (!mentionQuery || `${m.user.firstName} ${m.user.lastName}`.toLowerCase().startsWith(mentionQuery.toLowerCase()))).length === 0 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No match</p>
                  )}
                </div>
              )}
              {/* Pending file previews — shown above the input */}
              {pendingFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2 rounded-xl border border-border bg-muted/20 p-2">
                  {pendingFiles.map((item, idx) => (
                    <div key={idx} className="relative">
                      {item.fileType === "image" ? (
                        <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-border">
                          <img src={item.previewUrl} alt={item.name} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
                              setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-foreground shadow"
                          >
                            <X className="h-2.5 w-2.5 text-background" />
                          </button>
                        </div>
                      ) : (
                        <div className="relative flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5 pr-6 text-xs">
                          <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="max-w-[120px] truncate text-foreground">{item.name}</span>
                          <button
                            type="button"
                            onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="relative flex items-end gap-3 rounded-xl border border-border bg-muted/30 px-4 py-2.5 focus-within:border-indigo-300 focus-within:bg-background focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                {/* File attachment button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="shrink-0 text-muted-foreground hover:text-indigo-500 transition-colors disabled:opacity-50"
                  title="Attach file or image"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {/* Emoji button */}
                <div className="relative shrink-0">
                  <button
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    className="text-muted-foreground hover:text-yellow-500 transition-colors"
                    title="Emoji"
                  >
                    <SmilePlus className="h-4 w-4" />
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-8 left-0 z-50">
                      <EmojiPicker
                        onSelect={(emoji) => {
                          editorRef.current?.appendText(emoji);
                          setShowEmojiPicker(false);
                        }}
                        onClose={() => setShowEmojiPicker(false)}
                      />
                    </div>
                  )}
                </div>
                {/* Rich-text editor replaces the plain <input> */}
                <ChatRichTextInput
                  ref={editorRef}
                  placeholder={`Message ${isDM ? displayName : `#${displayName}`}`}
                  channelId={activeChannelId}
                  onUpdate={handleEditorUpdate}
                  onSend={handleSend}
                />
                {/* Schedule send button */}
                <div className="relative">
                  <button
                    onClick={() => setShowSchedulePicker((v) => !v)}
                    disabled={!input.trim()}
                    title="Schedule message"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                  >
                    <Clock className="h-3.5 w-3.5" />
                  </button>

                  {showSchedulePicker && (
                    <div className="absolute bottom-10 right-0 z-50 w-64 rounded-xl border border-border bg-popover shadow-2xl">
                      <div className="flex items-center justify-between border-b border-border px-3 py-2">
                        <span className="text-xs font-semibold text-foreground">Schedule message</span>
                        <button onClick={() => setShowSchedulePicker(false)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* Quick presets */}
                      <div className="flex flex-col gap-0.5 p-2">
                        {SCHEDULE_PRESETS.map((p) => {
                          const target = p.getDate();
                          const targetStr = toLocalDatetimeInput(target);
                          return (
                            <button
                              key={p.label}
                              onClick={() => setScheduleDateTime(targetStr)}
                              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                                scheduleDateTime === targetStr
                                  ? "bg-indigo-500/10 text-indigo-700 font-semibold"
                                  : "hover:bg-muted text-muted-foreground"
                              }`}
                            >
                              <CalendarClock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              {p.label}
                              <span className="ml-auto text-[10px] text-muted-foreground">
                                {target.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {/* Custom datetime */}
                      <div className="border-t border-border px-3 py-2">
                        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Custom</p>
                        <input
                          type="datetime-local"
                          value={scheduleDateTime}
                          min={toLocalDatetimeInput(new Date(Date.now() + 60_000))}
                          onChange={(e) => setScheduleDateTime(e.target.value)}
                          className="w-full rounded-lg border border-border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>
                      <div className="border-t border-border px-3 py-3">
                        <button
                          onClick={handleScheduleSend}
                          disabled={!scheduleDateTime || schedulingMsg}
                          className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          {schedulingMsg ? "Scheduling…" : "Schedule Send"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleSend}
                  disabled={uploading || (!input.trim() && pendingFiles.length === 0)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white transition-colors hover:bg-indigo-600 disabled:opacity-30"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                <kbd className="rounded border border-border px-1 font-mono">Enter</kbd> send ·
                <kbd className="ml-1 rounded border border-border px-1 font-mono">Shift+Enter</kbd> newline ·
                <strong className="font-semibold">B</strong> bold · <em>I</em> italic · <code className="rounded bg-muted px-0.5 font-mono">code</code>
              </p>
            </div>
          </div>

          {/* ── THREAD PANEL ──────────────────────────────────── */}
          {threadMsg && (
            <div className="flex w-80 shrink-0 flex-col border-l border-border bg-background">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <CornerDownRight className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm font-semibold text-foreground">Thread</span>
                </div>
                <button onClick={() => { setThreadMsg(null); setReplies([]); }} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Original message */}
              <div className="border-b border-border bg-indigo-500/5 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={av(threadMsg.user.avatarUrl)} />
                    <AvatarFallback className="text-[9px]">{threadMsg.user.firstName[0]}{threadMsg.user.lastName[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-semibold text-foreground">{threadMsg.user.firstName} {threadMsg.user.lastName}</span>
                  <span className="text-[10px] text-muted-foreground">{formatTime(threadMsg.createdAt)}</span>
                </div>
                {threadMsg.attachmentUrl && threadMsg.attachmentType === "image" ? (
                  <a href={resolveUrl(threadMsg.attachmentUrl)} target="_blank" rel="noreferrer">
                    <img src={resolveUrl(threadMsg.attachmentUrl)} className="mb-1 max-h-32 rounded-lg border border-border object-contain" alt={threadMsg.content} />
                  </a>
                ) : threadMsg.attachmentUrl ? (
                  <a href={resolveUrl(threadMsg.attachmentUrl)} className="flex items-center gap-1 text-xs text-indigo-600 underline" target="_blank" rel="noreferrer" download>{threadMsg.content}</a>
                ) : null}
                {(!threadMsg.attachmentUrl || threadMsg.content !== threadMsg.attachmentUrl) && (
                  <div className="text-sm text-foreground"><RichContent content={threadMsg.content} allUsers={allUsers} onMentionClick={setMentionProfileUserId} /></div>
                )}
              </div>

              {/* Replies */}
              <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
                {replies.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">No replies yet. Be the first!</p>
                )}
                {replies.map((r) => (
                  <div key={r.id} className="flex gap-2">
                    <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                      <AvatarImage src={av(r.user.avatarUrl)} />
                      <AvatarFallback className="text-[9px]">{r.user.firstName[0]}{r.user.lastName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-foreground">{r.user.firstName} {r.user.lastName}</span>
                        <span className="text-[10px] text-muted-foreground">{formatTime(r.createdAt)}</span>
                      </div>
                      {r.attachmentUrl && r.attachmentType === "image" ? (
                        <a href={resolveUrl(r.attachmentUrl)} target="_blank" rel="noreferrer">
                          <img src={resolveUrl(r.attachmentUrl)} className="mt-1 max-h-40 max-w-xs rounded-lg border border-border object-contain" alt={r.content} />
                        </a>
                      ) : r.attachmentUrl ? (
                        <a href={resolveUrl(r.attachmentUrl)} className="flex items-center gap-1 text-xs text-indigo-600 underline" target="_blank" rel="noreferrer" download>
                          <Download className="h-3 w-3" />{r.content}
                        </a>
                      ) : (
                        <div className="text-sm text-foreground break-words"><RichContent content={r.content} allUsers={allUsers} onMentionClick={setMentionProfileUserId} /></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply input */}
              <div className="border-t border-border p-3">
                <div className="flex items-end gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 focus-within:border-indigo-300 focus-within:ring-1 focus-within:ring-indigo-200">
                  <input
                    type="file"
                    ref={replyFileRef}
                    className="hidden"
                    onChange={handleReplyFileSelect}
                  />
                  <button
                    onClick={() => replyFileRef.current?.click()}
                    disabled={replyUploading}
                    className="shrink-0 text-muted-foreground hover:text-indigo-500"
                    title="Attach file"
                  >
                    {replyUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  </button>
                  {/* Emoji picker for reply */}
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setShowReplyEmojiPicker((v) => !v)}
                      className="text-muted-foreground hover:text-yellow-500 transition-colors"
                      title="Emoji"
                    >
                      <SmilePlus className="h-4 w-4" />
                    </button>
                    {showReplyEmojiPicker && (
                      <div className="absolute bottom-8 left-0 z-50">
                        <EmojiPicker
                          onSelect={(emoji) => { setReplyInput((p) => p + emoji); setShowReplyEmojiPicker(false); }}
                          onClose={() => setShowReplyEmojiPicker(false)}
                        />
                      </div>
                    )}
                  </div>
                  <textarea
                    rows={1}
                    placeholder="Reply..."
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); }
                    }}
                    className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={!replyInput.trim()}
                    className="shrink-0 rounded-md bg-indigo-500 p-1.5 text-white hover:bg-indigo-600 disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── DM PROFILE PANEL ──────────────────────────────── */}
          {isDM && showDMProfile && otherMember && (() => {
            const dmUser = (otherMember as any).user;
            const isOnline = onlineUserIds.has(dmUser?.id);
            const fullUser = allUsers.find((u) => u.userId === dmUser?.id)?.user;
            const isMe = dmUser?.id === user?.id;
            const liveStatus = userStatuses[dmUser?.id];
            return (
              <div className="flex w-64 shrink-0 flex-col border-l border-border bg-background overflow-y-auto">
                <UserProfilePanel
                  user={dmUser}
                  fullUser={fullUser}
                  isOnline={isOnline}
                  isCurrentUser={isMe}
                  workspaceId={workspaceId}
                  statusEmoji={liveStatus?.emoji ?? dmUser?.chatStatusEmoji ?? null}
                  statusText={liveStatus?.text ?? dmUser?.chatStatusText ?? null}
                  onClose={() => setShowDMProfile(false)}
                  onSetStatus={isMe ? async (emoji, text) => {
                    await apiSetUserStatus(emoji, text, null);
                    storeSetUserStatus(user!.id, emoji, text);
                  } : undefined}
                />
              </div>
            );
          })()}

          {/* ── MENTION PROFILE PANEL ─────────────────────────── */}
          {mentionProfileUserId !== null && (() => {
            const mu = allUsers.find((u) => u.userId === mentionProfileUserId);
            if (!mu) return null;
            const isOnline = onlineUserIds.has(mu.userId);
            const liveStatus = userStatuses[mu.userId];
            const isCurrentUser = mu.userId === user?.id;
            return (
              <div className="flex w-64 shrink-0 flex-col border-l border-border bg-background overflow-y-auto">
                <UserProfilePanel
                  user={mu.user}
                  fullUser={mu.user}
                  isOnline={isOnline}
                  isCurrentUser={isCurrentUser}
                  workspaceId={workspaceId}
                  statusEmoji={liveStatus?.emoji ?? (mu.user as any).chatStatusEmoji ?? null}
                  statusText={liveStatus?.text ?? (mu.user as any).chatStatusText ?? null}
                  onClose={() => setMentionProfileUserId(null)}
                  onBack={() => setMentionProfileUserId(null)}
                  onSendMessage={async () => {
                    const dm = await getOrCreateDM(workspaceId, mu.userId);
                    handleSelectChannel(dm);
                    setMentionProfileUserId(null);
                  }}
                  onSetStatus={isCurrentUser ? async (emoji, text) => {
                    await apiSetUserStatus(emoji, text, null);
                    storeSetUserStatus(user!.id, emoji, text);
                  } : undefined}
                />
              </div>
            );
          })()}

          {/* ── MEMBERS PANEL (channels only) ─────────────────── */}
          {!isDM && showMembersPanel && (
            <div className="flex w-64 shrink-0 flex-col border-l border-border bg-background">
              {profileMember ? (
                /* ── Profile view ────────────────────────────────────── */
                (() => {
                  const isOnline = onlineUserIds.has(profileMember.userId);
                  const fullUser = allUsers.find((u) => u.userId === profileMember.userId)?.user;
                  const isCurrentUser = profileMember.userId === user?.id;
                  const isGeneral = activeChannel?.name === "general";
                  const liveStatus = userStatuses[profileMember.userId];
                  return (
                    <UserProfilePanel
                      user={profileMember.user}
                      fullUser={fullUser}
                      isOnline={isOnline}
                      isCurrentUser={isCurrentUser}
                      workspaceId={workspaceId}
                      statusEmoji={liveStatus?.emoji ?? (profileMember.user as any).chatStatusEmoji ?? null}
                      statusText={liveStatus?.text ?? (profileMember.user as any).chatStatusText ?? null}
                      onBack={() => setProfileMember(null)}
                      onClose={() => setShowMembersPanel(false)}
                      onSendMessage={async () => {
                        const dm = await getOrCreateDM(workspaceId, profileMember.userId);
                        handleSelectChannel(dm);
                        setShowMembersPanel(false);
                      }}
                      onRemove={!isCurrentUser && !isGeneral ? () => handleRemoveMember(profileMember.userId) : undefined}
                      onSetStatus={isCurrentUser ? async (emoji, text) => {
                        await apiSetUserStatus(emoji, text, null);
                        storeSetUserStatus(user!.id, emoji, text);
                      } : undefined}
                    />
                  );
                })()
              ) : (
                /* ── Members list ─────────────────────────────────── */
                <>
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="text-xs font-semibold text-foreground">Channel Members</span>
                    <button onClick={() => setShowMembersPanel(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Members ({channelMembers.length})
                    </p>
                    {channelMembers.map((m) => {
                      const isOnline = onlineUserIds.has(m.userId);
                      const isCurrentUser = m.userId === user?.id;
                      const isGeneral = activeChannel?.name === "general";
                      return (
                        <div
                          key={m.userId}
                          className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted cursor-pointer"
                          onClick={() => setProfileMember(m as any)}
                        >
                          <div className="relative shrink-0">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={av(m.user.avatarUrl)} />
                              <AvatarFallback className="text-[9px]">
                                {m.user.firstName[0]}{m.user.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background ${isOnline ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-xs font-medium text-foreground">
                              {m.user.firstName} {m.user.lastName}
                              {isCurrentUser && <span className="ml-1 text-[10px] text-muted-foreground">(you)</span>}
                            </p>
                            <p className={`text-[10px] ${isOnline ? "text-green-500" : "text-muted-foreground"}`}>
                              {isOnline ? "Online" : "Offline"}
                            </p>
                          </div>
                          {!isCurrentUser && !isGeneral && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveMember(m.userId); }}
                              title="Remove from channel"
                              className="hidden group-hover:flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-red-500/10 hover:text-red-500 dark:hover:bg-red-950/30 transition-colors"
                            >
                              <UserX className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Add member section */}
                    <div className="mt-4">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Add Members
                      </p>
                      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5">
                        <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <input
                          placeholder="Search users…"
                          value={addMemberSearch}
                          onChange={(e) => setAddMemberSearch(e.target.value)}
                          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                        />
                      </div>
                      <div className="mt-1 max-h-40 overflow-y-auto">
                        {nonMemberUsers.slice(0, 10).map((u) => (
                          <button
                            key={u.userId}
                            onClick={() => handleAddMember(u.userId)}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted"
                          >
                            <Avatar className="h-5 w-5 shrink-0">
                              <AvatarImage src={av(u.user.avatarUrl)} />
                              <AvatarFallback className="text-[9px]">{u.user.firstName[0]}{u.user.lastName[0]}</AvatarFallback>
                            </Avatar>
                            <span className="flex-1 truncate">{u.user.firstName} {u.user.lastName}</span>
                            <Plus className="h-3 w-3 text-indigo-400" />
                          </button>
                        ))}
                        {nonMemberUsers.length === 0 && addMemberSearch && (
                          <p className="px-2 py-1 text-[11px] text-muted-foreground">No users found</p>
                        )}
                        {nonMemberUsers.length === 0 && !addMemberSearch && (
                          <p className="px-2 py-1 text-[11px] text-muted-foreground">All users are already members</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center border-b border-border px-4 py-3 sm:hidden">
            <button
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10">
                <MessageSquare className="h-8 w-8 text-indigo-400" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Select a channel or conversation</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick a channel from the sidebar or start a new DM
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
