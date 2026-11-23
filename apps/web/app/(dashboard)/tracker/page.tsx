"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Timer } from "lucide-react";
import { trackerApi } from "@/services/tracker.api";
import { PRODUCT_NAME } from "@/lib/products";

/** /tracker → the first company you belong to (Company Work or Accounts & Invoices) */
export default function TrackerIndex() {
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ["tracker", "workspaces"], queryFn: trackerApi.workspaces });
  useEffect(() => { if (data?.[0]) router.replace(`/tracker/${data[0].key}`); }, [data, router]);
  if (isLoading || data?.length) return <div className="flex h-full items-center justify-center p-10 text-[13px] text-muted-foreground">Opening EZ Tracker…</div>;
  return (
    <div className="flex h-full flex-col items-center justify-center p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0369a1]/10 text-[#0369a1]"><Timer className="h-6 w-6" /></span>
      <h1 className="mt-3 text-[22px] font-semibold">EZ Tracker</h1>
      <p className="mt-1 max-w-md text-[13.5px] text-muted-foreground">EZ Tracker records work time, screenshots and activity for your {PRODUCT_NAME.work} or {PRODUCT_NAME.boards} companies. You aren&apos;t a member of one yet. Ask your manager to invite you.</p>
      <Link href="/home" className="mt-4 text-[13px] font-semibold text-primary hover:underline">Back to home</Link>
    </div>
  );
}
