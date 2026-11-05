import type { Query } from "@tanstack/react-query";

/**
 * Filter that matches the board-detail query for a board, whether the caller
 * has its numeric id or its uid.
 *
 * The board page caches the board under ["board", <uid from the URL>], but many
 * mutations only know the numeric board id. Invalidating ["board", <id>] never
 * matched, so changes (new column, bulk move counts, group reorder, …) did not
 * show until a page reload. Use this instead:
 *
 *   queryClient.invalidateQueries(boardQueryFilter(boardId));
 *   queryClient.cancelQueries(boardQueryFilter(boardId));
 */
export function boardQueryFilter(idOrUid: number | string | null | undefined) {
  const want = idOrUid == null ? null : String(idOrUid);
  return {
    predicate: (q: Query) => {
      if (q.queryKey[0] !== "board" || want === null) return false;
      if (String(q.queryKey[1]) === want) return true;
      const data = q.state.data as { id?: number | string; uid?: string } | undefined;
      return String(data?.id) === want || String(data?.uid) === want;
    },
  };
}
