"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { getPublicBoardForm, type FormDesign } from "@/services/board-form.api";

const DEFAULT_DESIGN: FormDesign = {
  position: "center",
  bgColor: "#f5f6f8",
  accentColor: "#0070f3",
  cardBg: "#ffffff",
  textColor: "#111827",
};

export default function ThankYouPage() {
  const searchParams = useSearchParams();
  const boardId = Number(searchParams.get("boardId"));

  const { data: form } = useQuery({
    queryKey: ["public-board-form", boardId],
    queryFn: () => getPublicBoardForm(boardId),
    enabled: Boolean(boardId),
    retry: false,
    staleTime: Infinity,
  });

  const d: FormDesign = form?.design
    ? { ...DEFAULT_DESIGN, ...(form.design as Partial<FormDesign>) }
    : DEFAULT_DESIGN;

  return (
    <div className="min-h-screen" style={{ backgroundColor: d.bgColor, color: d.textColor }}>
      {/* Top bar */}
      <header className="sticky top-0 z-50 flex h-12 items-center border-b border-black/10 bg-white/90 px-6 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <div className="grid h-6 w-6 grid-cols-2 gap-[2px] rotate-45">
            <div className="rounded-[2px] bg-[#FF3D57]" />
            <div className="rounded-[2px] bg-[#00CFF4]" />
            <div className="rounded-[2px] bg-[#FFCB00]" />
            <div className="rounded-[2px] bg-[#00C875]" />
          </div>
          <span className="text-sm font-bold tracking-tight">EzManage</span>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-48px)] items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="rounded-2xl shadow-lg" style={{ backgroundColor: d.cardBg }}>
            <div className="h-2 rounded-t-2xl" style={{ backgroundColor: d.accentColor }} />
            <div className="p-10 text-center">
              <div
                className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
                style={{ backgroundColor: `${d.accentColor}18` }}
              >
                <CheckCircle2 className="h-10 w-10" style={{ color: d.accentColor }} />
              </div>

              <h1 className="text-2xl font-bold tracking-tight" style={{ color: d.textColor }}>
                Thank you!
              </h1>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: `${d.textColor}99` }}>
                Your response has been recorded. We appreciate you taking the time
                to fill out this form.
              </p>
            </div>
          </div>

          {/* Footer branding */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs" style={{ color: `${d.textColor}80` }}>
            <div className="grid h-4 w-4 grid-cols-2 gap-[1.5px] rotate-45">
              <div className="rounded-[1px] bg-[#FF3D57]" />
              <div className="rounded-[1px] bg-[#00CFF4]" />
              <div className="rounded-[1px] bg-[#FFCB00]" />
              <div className="rounded-[1px] bg-[#00C875]" />
            </div>
            <span>Powered by <strong>EzManage</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
