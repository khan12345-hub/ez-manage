import { api } from "@/lib/api";

export interface TimeReportFilters {
  startDate?: string;
  endDate?: string;
  userId?: number;
}

export async function downloadTimeReport(
  boardId: number,
  boardName: string,
  filters: TimeReportFilters = {},
) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.userId) params.set("userId", String(filters.userId));

  const response = await api.get(
    `/boards/${boardId}/time-entries/export`,
    { params, responseType: "blob" },
  );

  const safeName = boardName.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
  const today = new Date().toISOString().split("T")[0];
  const filename = `time-report-${safeName}-${today}.csv`;

  const url = URL.createObjectURL(new Blob([response.data], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
