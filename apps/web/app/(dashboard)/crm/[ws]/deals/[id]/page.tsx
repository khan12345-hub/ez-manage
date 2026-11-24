"use client";

import { useParams } from "next/navigation";
import { DealRecord } from "../../../_components/Records";

export default function CrmDealPage() {
  const { id } = useParams<{ id: string }>();
  return <DealRecord id={Number(id)} />;
}
