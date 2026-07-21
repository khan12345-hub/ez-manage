import type { JSONContent } from "@tiptap/react";

export function extractMentionedUserIds(
  document: JSONContent,
): number[] {
  const ids = new Set<number>();

  const traverse = (node: JSONContent) => {
    if (
      node.type === "mention" &&
      node.attrs?.id
    ) {
      ids.add(Number(node.attrs.id));
    }

    node.content?.forEach(traverse);
  };

  traverse(document);

  return Array.from(ids);
}