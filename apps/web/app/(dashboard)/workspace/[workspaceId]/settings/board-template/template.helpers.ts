import {
  BoardTemplate,
  TemplateColumn,
  TemplateColumnOptions,
  TemplateGroup,
  TemplateStatusOption,
} from "./template.types";

import {
  GROUP_COLORS,
  STATUS_COLORS,
} from "@/constants/colors";

const DEFAULT_STATUS_LABELS = [
  "Not Started",
  "Working",
  "Done",
  "Stuck",
];

function getRandomGroupColor(): string {
  const colors = GROUP_COLORS;

  if (colors.length === 0) {
    return "gray";
  }

  return (
    colors[
      Math.floor(Math.random() * colors.length)
    ] ?? "gray"
  );
}

function getStatusColor(index: number): string {
  return (
    STATUS_COLORS[index % STATUS_COLORS.length] ??
    "gray"
  );
}

export function createDefaultStatusOptions(): TemplateColumnOptions {
  return {
    statusOptions: DEFAULT_STATUS_LABELS.map(
      (label, index) => ({
        id: crypto.randomUUID(),
        label,
        color: getStatusColor(index),
        order: (index + 1) * 1000,
      }),
    ),
  };
}

function normalizeColumnOptions(
  type: string,
  options?: TemplateColumn["options"],
): TemplateColumnOptions | undefined {
  if (type !== "STATUS") {
    return undefined;
  }

  if (
    options?.statusOptions &&
    options.statusOptions.length > 0
  ) {
    return options;
  }

  return createDefaultStatusOptions();
}

export function createTemplateColumn(
  position: number,
  isPrimary = false,
): TemplateColumn {
  return {
    id: crypto.randomUUID(),
    name: isPrimary ? "Task Name" : "New column",
    type: "TEXT",
    position,
    isPrimary,
  };
}

export function createTemplateGroup(
  position: number,
): TemplateGroup {
  return {
    id: crypto.randomUUID(),
    name: "New group",
    color: getRandomGroupColor(),
    position,
    columns: [
      createTemplateColumn(0, true),
      createTemplateColumn(1),
    ],
  };
}

export function createInitialGroups(): TemplateGroup[] {
  return [createTemplateGroup(0)];
}

export function addTemplateGroup(
  groups: TemplateGroup[],
): TemplateGroup[] {
  return [
    ...groups,
    createTemplateGroup(groups.length),
  ];
}

export function removeTemplateGroup(
  groups: TemplateGroup[],
  groupId: string,
): TemplateGroup[] {
  return groups
    .filter((group) => group.id !== groupId)
    .map((group, index) => ({
      ...group,
      position: index,
    }));
}

export function renameTemplateGroup(
  groups: TemplateGroup[],
  groupId: string,
  name: string,
): TemplateGroup[] {
  return groups.map((group) =>
    group.id === groupId
      ? {
          ...group,
          name,
        }
      : group,
  );
}

export function updateTemplateGroup(
  groups: TemplateGroup[],
  groupId: string,
  changes: Partial<TemplateGroup>,
): TemplateGroup[] {
  return groups.map((group) =>
    group.id === groupId
      ? {
          ...group,
          ...changes,
        }
      : group,
  );
}

export function addTemplateColumn(
  groups: TemplateGroup[],
  groupId: string,
): TemplateGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) {
      return group;
    }

    return {
      ...group,
      columns: [
        ...group.columns,
        createTemplateColumn(
          group.columns.length,
        ),
      ],
    };
  });
}

export function removeTemplateColumn(
  groups: TemplateGroup[],
  groupId: string,
  columnId: string,
): TemplateGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) {
      return group;
    }

    return {
      ...group,
      columns: group.columns
        .filter(
          (column) => column.id !== columnId,
        )
        .map((column, index) => ({
          ...column,
          position: index,
        })),
    };
  });
}

export function updateTemplateColumn(
  groups: TemplateGroup[],
  groupId: string,
  columnId: string,
  changes: Partial<TemplateColumn>,
): TemplateGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) {
      return group;
    }

    return {
      ...group,
      columns: group.columns.map(
        (column) => {
          if (column.id !== columnId) {
            return column;
          }

          const nextColumn = {
            ...column,
            ...changes,
          };

          if (
            changes.type === "STATUS" &&
            !nextColumn.options?.statusOptions
              ?.length
          ) {
            return {
              ...nextColumn,
              options:
                createDefaultStatusOptions(),
            };
          }

          if (
            changes.type &&
            changes.type !== "STATUS"
          ) {
            return {
              ...nextColumn,
              options: undefined,
            };
          }

          return nextColumn;
        },
      ),
    };
  });
}

function mapTemplateColumnOptions(
  options:
    | TemplateColumnOptions
    | TemplateStatusOption[]
    | null
    | undefined,
): TemplateColumnOptions | undefined {
  if (!options) {
    return undefined;
  }

  if (Array.isArray(options)) {
    return {
      statusOptions: options,
    };
  }

  return options;
}

export function mapBoardTemplateToGroups(
  template: BoardTemplate,
): TemplateGroup[] {
  const groups = template.groups ?? [];

  if (groups.length === 0) {
    return createInitialGroups();
  }

  return groups.map((group, groupIndex) => ({
    id: String(group.id),
    name: group.name,
    color: group.color,
    position: group.position ?? groupIndex,
    columns: (group.columns ?? []).map(
      (column, columnIndex) => ({
        id: String(column.id),
        name: column.name,
        type: column.type,
        position:
          column.position ?? columnIndex,
        isPrimary:
          column.isPrimary ?? false,
        options: normalizeColumnOptions(
          column.type,
          mapTemplateColumnOptions(
            column.options,
          ),
        ),
      }),
    ),
  }));
}

export function buildCreateTemplatePayload({
  name,
  description,
  groups,
}: {
  name: string;
  description: string;
  groups: TemplateGroup[];
}) {
  return {
    name: name.trim(),

    description:
      description.trim() || undefined,

    groups: groups.map(
      (group, groupIndex) => ({
        name:
          group.name.trim() ||
          `Group ${groupIndex + 1}`,

        color: group.color,

        position: groupIndex,

        columns: group.columns.map(
          (column, columnIndex) => ({
            name:
              column.name.trim() ||
              `Column ${columnIndex + 1}`,

            type: column.type,

            position: columnIndex,

            isPrimary:
              column.isPrimary ?? false,

            options: normalizeColumnOptions(
              column.type,
              column.options,
            ),
          }),
        ),
      }),
    ),
  };
}
