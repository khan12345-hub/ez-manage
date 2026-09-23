"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

const TOUR_KEY = "ezmanage_tour_v1";

type Placement = "center" | "right" | "bottom" | "top" | "left";

interface Step {
  selector?: string;
  title: string;
  body: string;
  tip?: string;
  placement?: Placement;
}

const STEPS: Step[] = [
  {
    title: "👋 Welcome to EzManage!",
    body: "Let's take a quick tour so you know exactly where everything is. You can skip at any time.",
    placement: "center",
  },
  {
    selector: "[data-tour='workspace-switcher']",
    title: "🏠 Your Workspace",
    body: "This shows your current workspace. Click it to switch between workspaces you belong to.",
    tip: "Each workspace has its own boards and team members.",
    placement: "right",
  },
  {
    selector: "[data-tour='create-btn']",
    title: "➕ Create Workspace or Board",
    body: "Click + to create a new Workspace, or add a new Board inside your current workspace.",
    placement: "right",
  },
  {
    selector: "[data-tour='boards-list']",
    title: "📋 Your Boards",
    body: "All boards inside this workspace appear here. Click any board name to open it.",
    tip: "A board organizes your tasks in groups — like To Do, In Progress, Done.",
    placement: "right",
  },
  {
    selector: "[data-tour='new-item-btn']",
    title: "✅ Create Your First Task",
    body: "Click 'New item' to add a task inside any group. Give it a name and press Enter.",
    tip: "Click any task name to open its full detail — assign, set priority, add comments, attach files.",
    placement: "bottom",
  },
  {
    selector: "[data-tour='help-link']",
    title: "📖 Help & Guide",
    body: "You can always come back here to replay this tour or explore everything you can do in EzManage.",
    placement: "right",
  },
  {
    title: "🎉 You're all set!",
    body: "You know the basics. Explore the app and reach out to your workspace admin if you need help.",
    placement: "center",
  },
];

interface Rect { top: number; left: number; width: number; height: number; }

const PAD = 8;
const TIP_W = 288;

function getRect(selector: string): Rect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function computeTooltipStyle(placement: Placement, rect: Rect | null): React.CSSProperties {
  if (placement === "center" || !rect) {
    return {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: 320,
      zIndex: 10000,
    };
  }

  const { top, left, width, height } = rect;
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  const tipH = 220;
  const gap = 14;

  if (placement === "right") {
    return {
      position: "fixed",
      top: Math.max(8, Math.min(top + height / 2 - tipH / 2, winH - tipH - 8)),
      left: left + width + gap,
      width: TIP_W,
      zIndex: 10000,
    };
  }
  if (placement === "bottom") {
    return {
      position: "fixed",
      top: top + height + gap,
      left: Math.max(8, Math.min(left + width / 2 - TIP_W / 2, winW - TIP_W - 8)),
      width: TIP_W,
      zIndex: 10000,
    };
  }
  if (placement === "top") {
    return {
      position: "fixed",
      top: top - tipH - gap,
      left: Math.max(8, Math.min(left + width / 2 - TIP_W / 2, winW - TIP_W - 8)),
      width: TIP_W,
      zIndex: 10000,
    };
  }
  if (placement === "left") {
    return {
      position: "fixed",
      top: Math.max(8, Math.min(top + height / 2 - tipH / 2, winH - tipH - 8)),
      left: left - TIP_W - gap,
      width: TIP_W,
      zIndex: 10000,
    };
  }
  return { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 320, zIndex: 10000 };
}

function TooltipCard({
  step, index, total, onNext, onPrev, onSkip, rect,
}: {
  step: Step; index: number; total: number;
  onNext: () => void; onPrev: () => void; onSkip: () => void;
  rect: Rect | null;
}) {
  const placement = rect ? (step.placement ?? "center") : "center";
  const style = computeTooltipStyle(placement, rect);
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <div style={style} className="rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden select-none">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-indigo-600 px-4 py-3">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === index ? "w-5 h-1.5 bg-white" : i < index ? "w-1.5 h-1.5 bg-white/50" : "w-1.5 h-1.5 bg-white/20"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] text-white/60 font-medium">{index + 1} / {total}</span>
          <button onClick={onSkip} className="text-white/50 hover:text-white transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        <p className="font-bold text-gray-900 text-sm leading-tight">{step.title}</p>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">{step.body}</p>
        {step.tip && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
            <span className="text-sm flex-shrink-0 mt-px">💡</span>
            <p className="text-xs text-amber-800 leading-snug">{step.tip}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 pb-4">
        <button
          onClick={isFirst ? onSkip : onPrev}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          {isFirst ? (
            "Skip tour"
          ) : (
            <>
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </>
          )}
        </button>

        <button
          onClick={onNext}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          {isLast ? "Finish 🎉" : (
            <>
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function OnboardingTour() {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Recompute spotlight position for current step
  const updateRect = useCallback((stepIdx: number) => {
    const s = STEPS[stepIdx];
    if (s.selector) {
      setRect(getRect(s.selector));
    } else {
      setRect(null);
    }
  }, []);

  useEffect(() => {
    setMounted(true);

    const done = localStorage.getItem(TOUR_KEY);
    if (!done) {
      const t = setTimeout(() => { setActive(true); updateRect(0); }, 900);
      return () => clearTimeout(t);
    }

    const onStart = () => {
      setStep(0);
      updateRect(0);
      setActive(true);
    };
    window.addEventListener("start-onboarding-tour", onStart);
    return () => window.removeEventListener("start-onboarding-tour", onStart);
  }, [updateRect]);

  // Also listen for re-trigger after first mount
  useEffect(() => {
    if (!mounted) return;
    const onStart = () => {
      setStep(0);
      updateRect(0);
      setActive(true);
    };
    window.addEventListener("start-onboarding-tour", onStart);
    return () => window.removeEventListener("start-onboarding-tour", onStart);
  }, [mounted, updateRect]);

  const close = useCallback(() => {
    localStorage.setItem(TOUR_KEY, "1");
    setActive(false);
  }, []);

  const next = useCallback(() => {
    const nextIdx = step + 1;
    if (nextIdx >= STEPS.length) {
      close();
    } else {
      setStep(nextIdx);
      updateRect(nextIdx);
    }
  }, [step, close, updateRect]);

  const prev = useCallback(() => {
    const prevIdx = step - 1;
    if (prevIdx < 0) return;
    setStep(prevIdx);
    updateRect(prevIdx);
  }, [step, updateRect]);

  if (!mounted || !active) return null;

  return createPortal(
    <>
      {/* Backdrop or spotlight */}
      {rect ? (
        // Spotlight — box-shadow creates the dimmed backdrop around the element
        <div
          style={{
            position: "fixed",
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            borderRadius: 10,
            zIndex: 9998,
            pointerEvents: "none",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
            outline: "2.5px solid rgb(99,102,241)",
            outlineOffset: "0px",
          }}
        />
      ) : (
        // Plain backdrop for center steps
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9997, backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={close}
        />
      )}

      {/* Tooltip */}
      <TooltipCard
        step={STEPS[step]}
        index={step}
        total={STEPS.length}
        onNext={next}
        onPrev={prev}
        onSkip={close}
        rect={rect}
      />
    </>,
    document.body,
  );
}
