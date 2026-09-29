"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Sparkles, RotateCcw, ChevronDown } from "lucide-react";

function parseMarkdown(raw: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let t = esc(raw);

  // Tables
  t = t.replace(/(\|[^\n]+\|\n?)+/g, (block) => {
    const rows = block.trim().split("\n").filter((r) => r.trim());
    if (rows.length < 2 || !/^\|[\s\-:|]+\|$/.test(rows[1])) return block;
    const cells = (row: string) =>
      row.split("|").slice(1, -1).map((c) => c.trim());
    const heads = cells(rows[0]);
    const body = rows.slice(2);
    return (
      `<div class="md-table-wrap"><table><thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead>` +
      `<tbody>${body.map((r) => `<tr>${cells(r).map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
    );
  });

  // Inline code
  t = t.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  // Bold
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  t = t.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  // Headings
  t = t.replace(/^#{3}\s+(.+)$/gm, "<h4>$1</h4>");
  t = t.replace(/^#{2}\s+(.+)$/gm, "<h3>$1</h3>");
  t = t.replace(/^#\s+(.+)$/gm, "<h2>$1</h2>");

  // Unordered lists
  t = t.replace(/((?:^[-*]\s.+$\n?)+)/gm, (block) => {
    const items = block.trim().split("\n").map((l) => l.replace(/^[-*]\s/, ""));
    return `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
  });
  // Ordered lists
  t = t.replace(/((?:^\d+\.\s.+$\n?)+)/gm, (block) => {
    const items = block.trim().split("\n").map((l) => l.replace(/^\d+\.\s/, ""));
    return `<ol>${items.map((i) => `<li>${i}</li>`).join("")}</ol>`;
  });

  // Paragraphs
  t = t
    .split(/\n{2,}/)
    .map((p) => {
      p = p.trim();
      if (!p) return "";
      if (/^<(h[2-4]|ul|ol|div|table)/.test(p)) return p;
      return `<p>${p.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");

  return t;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "How do I invite a team member?",
  "How to create subtasks?",
  "What are board views?",
  "How do automations work?",
];

export function AskAiWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleOpen = () => {
    setIsOpen(true);
    setIsAnimatingIn(true);
    setTimeout(() => setIsAnimatingIn(false), 400);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleClose = () => {
    setIsOpen(false);
    abortRef.current?.abort();
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setIsLoading(false);
  };

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg = text.trim();
      if (!userMsg || isLoading) return;

      const newMessages: Message[] = [
        ...messages,
        { role: "user", content: userMsg },
      ];
      setMessages(newMessages);
      setInput("");
      setIsLoading(true);

      // Placeholder for streaming assistant response
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "" },
      ]);

      abortRef.current = new AbortController();

      try {
        const response = await fetch("/api/ask-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          let errMsg = "Something went wrong. Please try again.";
          try {
            const err = await response.json();
            errMsg = err.error ?? errMsg;
          } catch {
            errMsg = `Error ${response.status}. Please try again.`;
          }
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { role: "assistant", content: errMsg },
          ]);
          return;
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) return;

        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                accumulated += delta;
                setMessages((prev) => [
                  ...prev.slice(0, -1),
                  { role: "assistant", content: accumulated },
                ]);
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setMessages((prev) => [
            ...prev.slice(0, -1),
            {
              role: "assistant",
              content: "Connection error. Please try again.",
            },
          ]);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isOpen && (
          <button
            onClick={handleOpen}
            aria-label="Ask AI"
            style={{
              background: "linear-gradient(135deg, #2563EB 0%, #6366F1 100%)",
              boxShadow:
                "0 4px 24px rgba(99,102,241,0.45), 0 1px 4px rgba(0,0,0,0.12)",
            }}
            className="group relative flex h-14 w-14 items-center justify-center rounded-full text-white transition-transform duration-200 hover:scale-110 active:scale-95 ask-ai-pulse"
          >
            <Sparkles className="h-6 w-6 transition-transform duration-300 group-hover:rotate-12" />
            <span
              className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center"
              aria-hidden="true"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-60"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-300"></span>
            </span>
          </button>
        )}
      </div>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col overflow-hidden rounded-2xl bg-white"
          style={{
            width: "380px",
            height: "560px",
            boxShadow:
              "0 8px 48px rgba(37,99,235,0.18), 0 2px 12px rgba(0,0,0,0.10)",
            border: "1px solid rgba(226,232,240,0.8)",
            animation: isAnimatingIn
              ? "askAiSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both"
              : "none",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "linear-gradient(135deg, #2563EB 0%, #6366F1 100%)",
            }}
            className="relative flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-none">
                  Ask AI
                </p>
                <p className="mt-0.5 text-[10px] text-white/70 leading-none">
                  Powered by EzManage
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={handleReset}
                  title="New conversation"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-white/70 hover:bg-white/15 hover:text-white transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={handleClose}
                title="Close"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white/70 hover:bg-white/15 hover:text-white transition-colors"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#F8FAFC]">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-5 select-none">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{
                    background:
                      "linear-gradient(135deg, #EFF6FF 0%, #EEF2FF 100%)",
                  }}
                >
                  <Sparkles className="h-7 w-7 text-indigo-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    How can I help?
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Ask anything about EzManage
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-150"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2.5 ${
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5"
                      style={{
                        background:
                          "linear-gradient(135deg, #2563EB 0%, #6366F1 100%)",
                      }}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}

                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "rounded-tr-sm bg-blue-600 text-white"
                        : "rounded-tl-sm bg-white text-slate-700 shadow-sm border border-slate-100"
                    }`}
                    style={{ wordBreak: "break-word" }}
                  >
                    {msg.content === "" && msg.role === "assistant" ? (
                      <span className="flex gap-1 items-center py-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    ) : msg.role === "assistant" ? (
                      <div
                        className="md-content"
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
                      />
                    ) : (
                      <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-100 bg-white px-3 py-3">
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about EzManage…"
                rows={1}
                disabled={isLoading}
                className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
                style={{ maxHeight: "100px", minHeight: "40px" }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                style={{
                  background:
                    !input.trim() || isLoading
                      ? undefined
                      : "linear-gradient(135deg, #2563EB 0%, #6366F1 100%)",
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-400 transition-all duration-200 disabled:opacity-50 enabled:hover:scale-105 enabled:active:scale-95 enabled:text-white"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-2 text-center text-[10px] text-slate-300">
              Powered by EzManage AI
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes askAiSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .ask-ai-pulse { animation: askAiPulse 3s ease-in-out infinite; }
        @keyframes askAiPulse {
          0%, 100% { box-shadow: 0 4px 24px rgba(99,102,241,0.45), 0 1px 4px rgba(0,0,0,0.12); }
          50%       { box-shadow: 0 4px 32px rgba(99,102,241,0.65), 0 1px 4px rgba(0,0,0,0.12); }
        }
        .md-content { font-size: 13px; line-height: 1.55; color: #374151; }
        .md-content p { margin: 0 0 7px; }
        .md-content p:last-child { margin-bottom: 0; }
        .md-content strong { font-weight: 600; color: #1e293b; }
        .md-content em { font-style: italic; }
        .md-content code { font-family: 'SF Mono','Fira Code',monospace; font-size: 11px; background: #f1f5f9; padding: 1px 5px; border-radius: 3px; color: #2563eb; }
        .md-content h2 { font-size: 13px; font-weight: 700; color: #0f172a; margin: 10px 0 4px; }
        .md-content h3 { font-size: 12px; font-weight: 700; color: #0f172a; margin: 8px 0 3px; }
        .md-content h4 { font-size: 12px; font-weight: 600; color: #334155; margin: 6px 0 2px; }
        .md-content ul, .md-content ol { margin: 4px 0 7px; padding-left: 18px; }
        .md-content li { margin-bottom: 3px; }
        .md-content li:last-child { margin-bottom: 0; }
        .md-table-wrap { overflow-x: auto; margin: 6px 0; }
        .md-content table { border-collapse: collapse; font-size: 11.5px; width: 100%; min-width: 280px; }
        .md-content th, .md-content td { border: 1px solid #e2e8f0; padding: 5px 8px; text-align: left; vertical-align: top; }
        .md-content th { background: #f8fafc; font-weight: 600; color: #0f172a; }
        .md-content tr:hover td { background: #f8fafc; }
      `}</style>
    </>
  );
}
