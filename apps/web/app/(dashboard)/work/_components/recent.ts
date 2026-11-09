/** "Recent" places (lists / folders) for the Overview cards; per browser. */
export type RecentPlace = { kind: "list" | "folder"; uid: string; name: string; parent: string; spaceUid: string; folderUid?: string | null; at: number };
const KEY = "ez:work:recentPlaces";

export function recentPlaces(): RecentPlace[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function trackPlace(p: Omit<RecentPlace, "at">) {
  try {
    const next = [{ ...p, at: Date.now() }, ...recentPlaces().filter((x) => !(x.kind === p.kind && x.uid === p.uid))].slice(0, 30);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

/** Bookmarks saved on an Overview (per location, per browser). */
export type Bookmark = { id: string; title: string; url: string };
const bmKey = (loc: string) => `ez:work:bookmarks:${loc}`;
export function loadBookmarks(loc: string): Bookmark[] {
  try {
    const v = JSON.parse(localStorage.getItem(bmKey(loc)) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
export function saveBookmarks(loc: string, list: Bookmark[]) {
  try {
    localStorage.setItem(bmKey(loc), JSON.stringify(list));
  } catch {}
}
