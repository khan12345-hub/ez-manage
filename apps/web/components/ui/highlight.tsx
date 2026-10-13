import React from "react";

/**
 * Wraps every occurrence of `search` inside `text` with a yellow <mark>.
 * Case-insensitive. Safe to use inside truncating containers — the mark
 * inherits inline flow so it never breaks layout.
 */
export function Highlight({
  text,
  search,
}: {
  text: string;
  search?: string;
}) {
  if (!search || !text) return <>{text}</>;

  const lowerText = text.toLowerCase();
  const lowerSearch = search.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const idx = lowerText.indexOf(lowerSearch, cursor);
    if (idx === -1) {
      parts.push(text.slice(cursor));
      break;
    }
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    parts.push(
      <mark
        key={idx}
        className="rounded-[2px] bg-yellow-300/80 px-0 text-yellow-900 dark:bg-yellow-600/60 dark:text-yellow-100"
        style={{ fontWeight: "inherit" }}
      >
        {text.slice(idx, idx + search.length)}
      </mark>,
    );
    cursor = idx + search.length;
  }

  return <>{parts}</>;
}
