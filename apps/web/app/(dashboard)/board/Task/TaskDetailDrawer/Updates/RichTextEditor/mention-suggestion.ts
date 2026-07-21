import {
  ReactRenderer,
} from "@tiptap/react";

import tippy, {
  type Instance,
} from "tippy.js";

import {
  getBoardMembers,
} from "@/services/boards.api";

import {
  MentionList,
  type MentionListRef,
  type MentionItem,
} from "./MentionList";

interface MentionSuggestionOptions {
  boardId: number | undefined;
}

export function createMentionSuggestion({
  boardId,
}: MentionSuggestionOptions) {
  return {
    char: "@",

    allowSpaces: false,

    items: async ({
      query,
    }: {
      query: string;
    }): Promise<MentionItem[]> => {
      if (!boardId) {
        return [];
      }

      try {
        const users =
          await getBoardMembers(
            boardId,
            query,
          );

        return users
          .slice(0, 10)
          .map((user) => ({
            id: user.id,

            label:
              `${user.firstName ?? ""} ${
                user.lastName ?? ""
              }`.trim(),

            email: user.email,

            avatar:
              user.avatar ?? null,
          }));
      } catch (error) {
        console.error(
          "Failed to fetch mention users:",
          error,
        );

        return [];
      }
    },

    render: () => {
      let component:
        | ReactRenderer<MentionListRef>
        | null = null;

      let popup:
        | Instance[]
        | null = null;

      return {
        onStart: (props: any) => {
          component =
            new ReactRenderer(
              MentionList,
              {
                props,
                editor:
                  props.editor,
              },
            );

          if (
            !props.clientRect
          ) {
            return;
          }

          popup = tippy("body", {
            getReferenceClientRect:
              props.clientRect,

            appendTo: () =>
              document.body,

            content:
              component.element,

            showOnCreate: true,

            interactive: true,

            trigger: "manual",

            placement:
              "bottom-start",
          });
        },

        onUpdate: (
          props: any,
        ) => {
          if (!component) {
            return;
          }

          component.updateProps(
            props,
          );

          if (
            !props.clientRect
          ) {
            return;
          }

          popup?.[0]?.setProps({
            getReferenceClientRect:
              props.clientRect,
          });
        },

        onKeyDown: ({
          event,
        }: {
          event: KeyboardEvent;
        }) => {
          if (
            event.key === "Escape"
          ) {
            popup?.[0]?.hide();

            return true;
          }

          if (!component) {
            return false;
          }

          return (
            component.ref?.onKeyDown({
              event,
            }) ?? false
          );
        },

        onExit: () => {
          popup?.[0]?.destroy();

          component?.destroy();

          popup = null;

          component = null;
        },
      };
    },
  };
}