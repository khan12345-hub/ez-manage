/**
 * Status groups (ClickUp-style). The single source of truth for "is this task
 * done?" — used by member tasks (dashboard/home), time tracking and the CEO
 * analyzer, so every screen agrees on what is overdue.
 *
 * A task's STATUS cell stores { label, color[, id] }; the category lives on the
 * matching StatusOption. When no option matches (legacy/imported labels) we fall
 * back to suggestStatusCategory(label), the same rule the migration used.
 */
export type StatusCategory = 'NOT_STARTED' | 'ACTIVE' | 'DONE';

const NEGATED =
  /\b(not|un|in|non)[\s-]?(done|complete[d]?|finished|paid|approved|resolved|closed)\b|\b(pending|partial|partially|awaiting|unpaid)\b/i;
const DONE_WORDS = /\b(done|complete[d]?|finished|closed|resolved|deployed|shipped|paid|cancell?ed)\b/i;
const NOT_STARTED_WORDS =
  /^\s*(not started|to[\s-]?do|new|open|backlog|planned|queued|pending|on hold|waiting)\b|\bnot started\b/i;

/** Best guess from the label text — used for new options and as a fallback. */
export function suggestStatusCategory(label?: string | null): StatusCategory {
  if (!label) return 'ACTIVE';
  if (DONE_WORDS.test(label) && !NEGATED.test(label)) return 'DONE';
  if (NOT_STARTED_WORDS.test(label)) return 'NOT_STARTED';
  return 'ACTIVE';
}

type OptionLike = { id: number; label: string; category?: StatusCategory | string | null };

/**
 * Category of a STATUS cell value given the column's options.
 * Returns null when the cell has no status at all.
 */
export function resolveStatusCategory(
  value: unknown,
  options: OptionLike[] | null | undefined,
): StatusCategory | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as { id?: number; statusOptionId?: number; label?: string };
  const opts = options ?? [];
  const byId = v.id ?? v.statusOptionId;
  const opt =
    (byId != null ? opts.find((o) => o.id === byId) : undefined) ??
    (v.label ? opts.find((o) => o.label === v.label) : undefined);
  if (opt?.category) return opt.category as StatusCategory;
  if (opt) return suggestStatusCategory(opt.label);
  return v.label ? suggestStatusCategory(v.label) : null;
}

export const isDoneCategory = (c: StatusCategory | null | undefined) => c === 'DONE';
