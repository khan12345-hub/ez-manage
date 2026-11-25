"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Laptop, Loader2, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { trackerApi } from "@/services/tracker.api";
import { glass } from "../_components/bits";

type State = "confirm" | "working" | "done" | "error" | "nocode";

/**
 * EZ Tracker desktop auto-connect. The desktop app opens this page (signed in as the person) with a
 * one-time secret nonce in `?c=`; the person confirms and the browser registers that nonce for their
 * account, so the waiting app can finish connecting — no 8-character code to type.
 */
export default function TrackerConnectPage() {
  const params = useSearchParams();
  const nonce = (params.get("c") ?? "").trim();
  const { user } = useAuth();
  const [state, setState] = useState<State>(nonce.length >= 20 ? "confirm" : "nocode");
  const [msg, setMsg] = useState("");

  useEffect(() => { if (nonce.length < 20) setState("nocode"); }, [nonce]);

  const confirm = async () => {
    setState("working");
    try {
      await trackerApi.connect(nonce);
      setState("done");
    } catch (e: any) {
      setMsg(e?.response?.data?.message?.toString?.() ?? "Could not connect this computer. Try again from the app.");
      setState("error");
    }
  };

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "your account";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-10">
      <motion.section
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className={cn(glass, "w-full p-7 text-center")}
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#b45309] to-[#f59e0b] text-white shadow-lg">
          <Laptop className="h-7 w-7" />
        </div>

        {state === "nocode" && (
          <>
            <h1 className="text-[19px] font-semibold">Nothing to connect</h1>
            <p className="mt-2 text-[13.5px] text-muted-foreground">
              Open EZ Tracker on your computer and press <b>“Connect with my account”</b> — it will bring you back here with a secure link.
            </p>
          </>
        )}

        {state === "confirm" && (
          <>
            <h1 className="text-[19px] font-semibold">Connect this computer?</h1>
            <p className="mt-2 text-[13.5px] text-muted-foreground">
              EZ Tracker on this computer wants to link to <b>{name}</b>. Your tracked time and activity will show on your dashboard.
            </p>
            <button
              onClick={confirm}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#b45309] px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-[#92400e]"
            >
              <ShieldCheck className="h-4 w-4" /> Connect to my account
            </button>
            <p className="mt-3 text-[11.5px] text-muted-foreground">Only do this for a computer you are setting up. The link works once and expires in 10 minutes.</p>
          </>
        )}

        {state === "working" && (
          <>
            <h1 className="text-[19px] font-semibold">Connecting…</h1>
            <Loader2 className="mx-auto mt-4 h-6 w-6 animate-spin text-[#b45309]" />
          </>
        )}

        {state === "done" && (
          <>
            <div className="mx-auto -mt-1 mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-5 w-5" /></div>
            <h1 className="text-[19px] font-semibold">This computer is connected</h1>
            <p className="mt-2 text-[13.5px] text-muted-foreground">
              You can close this tab. EZ Tracker on your computer will finish on its own and start tracking.
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <div className="mx-auto -mt-1 mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white"><X className="h-5 w-5" /></div>
            <h1 className="text-[19px] font-semibold">Could not connect</h1>
            <p className="mt-2 text-[13.5px] text-muted-foreground">{msg}</p>
            <button onClick={confirm} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-5 py-3 text-[14px] font-semibold transition hover:bg-muted">
              Try again
            </button>
          </>
        )}
      </motion.section>
    </div>
  );
}
