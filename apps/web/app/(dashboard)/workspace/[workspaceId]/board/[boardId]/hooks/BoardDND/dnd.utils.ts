import { Group, Task } from "./types";

export function cloneGroups(groups: Group[]): Group[] {
  return structuredClone(groups);
}

export function findGroup(groups: Group[], groupId: number): Group | null {
  return groups.find((group) => group.id === groupId) ?? null;
}

export function findGroupIndex(groups: Group[], groupId: number): number {
  return groups.findIndex((group) => group.id === groupId);
}

export function findTaskLocation(
  groups: Group[],
  taskId: number,
): { group: Group; task: Task; taskIndex: number } | null {
  for (const group of groups) {
    const tasks = group.tasks ?? [];
    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
      continue;
    }
    const task = tasks[taskIndex];
    if (!task) {
      continue;
    }
    return { group, task, taskIndex };
  }
  return null;
}

export function removeTask(groups: Group[], taskId: number): Task | null {
  const location = findTaskLocation(groups, taskId);

  if (!location) {
    return null;
  }

  const tasks = location.group.tasks ?? [];

  const [removedTask] = tasks.splice(location.taskIndex, 1);

  return removedTask ?? null;
}

export function appendTask(group: Group, task: Task): void {
  const tasks = group.tasks ?? [];

  tasks.push(task);

  group.tasks = tasks;
}

export function insertTask(group: Group, task: Task, index: number): void {
  const tasks = group.tasks ?? [];

  tasks.splice(index, 0, task);

  group.tasks = tasks;
}

export function moveTask(
  source: Group,
  destination: Group,
  sourceIndex: number,
  destinationIndex: number,
): void {
  const sourceTasks = source.tasks ?? [];
  const destinationTasks = destination.tasks ?? [];

  const [task] = sourceTasks.splice(sourceIndex, 1);

  if (!task) {
    return;
  }

  destinationTasks.splice(destinationIndex, 0, task);

  source.tasks = sourceTasks;
  destination.tasks = destinationTasks;
}
