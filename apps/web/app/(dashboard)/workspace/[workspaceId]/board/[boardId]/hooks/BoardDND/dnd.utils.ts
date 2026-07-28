import { Group, Task } from "./types";

export function cloneGroups(groups: Group[]) {
  return structuredClone(groups);
}

export function findGroup(
  groups: Group[],
  groupId: number
) {
  return groups.find((g) => g.id === groupId) ?? null;
}

export function findGroupIndex(
  groups: Group[],
  groupId: number
) {
  return groups.findIndex((g) => g.id === groupId);
}

export function findTaskLocation(
  groups: Group[],
  taskId: number
) {
  for (const group of groups) {
    const taskIndex = group.tasks.findIndex(
      (task) => task.id === taskId
    );

    if (taskIndex !== -1) {
      return {
        group,
        task: group.tasks[taskIndex],
        taskIndex,
      };
    }
  }

  return null;
}
export function removeTask(
  groups: Group[],
  taskId: number
): Task | undefined | null {

  const location = findTaskLocation(groups, taskId);

  if (!location) {
    return null;
  }

  location.group.tasks.splice(location.taskIndex, 1);

  return location.task;
}
export function appendTask(
  group: Group,
  task: Task
) {
  group.tasks.push(task);
}
export function insertTask(
  group: Group,
  task: Task,
  index: number
) {
  group.tasks.splice(index, 0, task);
}
export function moveTask(
  source: Group,
  destination: Group,
  sourceIndex: number,
  destinationIndex: number
) {

  const [task] = source.tasks.splice(sourceIndex, 1);

  destination.tasks.splice(destinationIndex, 0, task);
}
