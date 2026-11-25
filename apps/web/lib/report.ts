/**
 * Small, dependency-free report helpers used by Tracker and Vault:
 *  - downloadCsv: a UTF-8 CSV (with BOM, so Excel opens it cleanly) saved to the browser.
 *  - printReport: a clean printable table in a new window — the browser's print dialog can "Save as PDF".
 * Both take plain string/number rows, so each caller builds exactly the columns it wants.
 */

type Cell = string | number;

export function downloadCsv(filename: string, headers: string[], rows: Cell[][]) {
  const esc = (v: Cell) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printReport(opts: { title: string; subtitle?: string; headers: string[]; rows: Cell[][]; footer?: string }) {
  const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const w = window.open("", "_blank", "width=980,height=720");
  if (!w) return; // popup blocked — the CSV export still works
  const head = opts.headers.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = opts.rows.map((r) => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="l"' : ""}>${esc(c)}</td>`).join("")}</tr>`).join("");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(opts.title)}</title>
<style>
  *{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;box-sizing:border-box}
  body{margin:28px;color:#111827}
  h1{font-size:20px;margin:0 0 2px}
  .sub{color:#6b7280;font-size:13px;margin:0 0 18px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{padding:7px 10px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap}
  th{background:#f9fafb;text-transform:uppercase;font-size:10px;letter-spacing:.04em;color:#6b7280;border-bottom:2px solid #e5e7eb}
  th:first-child,td.l{text-align:left}
  tr:nth-child(even) td{background:#fcfcfd}
  .foot{margin-top:16px;color:#9ca3af;font-size:11px}
  @media print{body{margin:12mm}}
</style></head><body>
  <h1>${esc(opts.title)}</h1>${opts.subtitle ? `<p class="sub">${esc(opts.subtitle)}</p>` : ""}
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  ${opts.footer ? `<p class="foot">${esc(opts.footer)}</p>` : ""}
  <script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script>
</body></html>`);
  w.document.close();
}
