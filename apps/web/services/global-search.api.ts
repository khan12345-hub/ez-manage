    
import { api } from "@/lib/api";
import { SearchResponse } from "@/app/(dashboard)/workspace/[workspaceId]/board/[boardId]/BoardHeader/GlobalSearch/global-search.types";

export async function globalSearch(
  workspaceId: number,
  q: string,
) {
  const { data } = await api.get<SearchResponse>("/search", {
    params: {
      workspaceId,
      q,
    },
  });

  return data;
}