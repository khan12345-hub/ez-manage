"use client";

import { useParams } from "next/navigation";
import { ContactRecord } from "../../../_components/Records";

export default function CrmContactPage() {
  const { id } = useParams<{ id: string }>();
  return <ContactRecord id={Number(id)} />;
}
