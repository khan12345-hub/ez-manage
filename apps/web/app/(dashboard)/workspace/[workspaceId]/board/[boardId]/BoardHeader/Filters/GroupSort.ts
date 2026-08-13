export type GroupSortOption =
  | "default"
  | "newest"
  | "oldest"
  | "recentlyUpdated"
  | "nameAsc"
  | "nameDesc"
  | "mostTasks"
  | "leastTasks";

export const GROUP_SORT_OPTIONS: {
  value: GroupSortOption;
  label: string;
}[] = [
  {
    value: "default",
    label: "Manual",
  },
  {
    value: "newest",
    label: "Newest",
  },
  {
    value: "oldest",
    label: "Oldest",
  },
  {
    value: "recentlyUpdated",
    label: "Recently updated",
  },
  {
    value: "nameAsc",
    label: "Name A → Z",
  },
  {
    value: "nameDesc",
    label: "Name Z → A",
  },
  {
    value: "mostTasks",
    label: "Most tasks",
  },
  {
    value: "leastTasks",
    label: "Least tasks",
  },
];

const getCreatedAt = (group: any) => {
  if (!group.createdAt) return 0;

  const value = new Date(group.createdAt).getTime();

  return Number.isNaN(value) ? 0 : value;
};

const getUpdatedAt = (group: any) => {
  if (!group.updatedAt) return 0;

  const value = new Date(group.updatedAt).getTime();

  return Number.isNaN(value) ? 0 : value;
};

const getTaskCount = (group: any) => {
  if (Array.isArray(group.tasks)) {
    return group.tasks.length;
  }

  if (typeof group.taskCount === "number") {
    return group.taskCount;
  }

  return 0;
};

const getGroupName = (group: any) =>
  String(group.name ?? "").toLowerCase();

export function sortGroups(
  groups: any[],
  sortOption: GroupSortOption,
) {
  const sorted = [...groups];

  switch (sortOption) {
    case "newest":
      return sorted.sort(
        (a, b) => getCreatedAt(b) - getCreatedAt(a),
      );

    case "oldest":
      return sorted.sort(
        (a, b) => getCreatedAt(a) - getCreatedAt(b),
      );

    case "recentlyUpdated":
      return sorted.sort(
        (a, b) => getUpdatedAt(b) - getUpdatedAt(a),
      );

    case "nameAsc":
      return sorted.sort((a, b) =>
        getGroupName(a).localeCompare(getGroupName(b)),
      );

    case "nameDesc":
      return sorted.sort((a, b) =>
        getGroupName(b).localeCompare(getGroupName(a)),
      );

    case "mostTasks":
      return sorted.sort(
        (a, b) => getTaskCount(b) - getTaskCount(a),
      );

    case "leastTasks":
      return sorted.sort(
        (a, b) => getTaskCount(a) - getTaskCount(b),
      );

    case "default":
    default:
      return sorted;
  }
}