"use client";

import { useParams } from "next/navigation";
import { CompanyRecord } from "../../../_components/Records";

export default function CrmCompanyPage() {
  const { id } = useParams<{ id: string }>();
  return <CompanyRecord id={Number(id)} />;
}
