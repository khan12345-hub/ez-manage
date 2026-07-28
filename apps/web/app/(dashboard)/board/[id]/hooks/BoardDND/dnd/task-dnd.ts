import { arrayMove } from "@dnd-kit/sortable";

import {
  cloneGroups,
  findGroup,
  findTaskLocation,
  moveTask,
} from "../dnd.utils";

import { Group } from "../types";

function reorderWithinGroup(
  groups: Group[],
  groupId: number,
  activeIndex: number,
  overIndex: number
) {
  const next = cloneGroups(groups);

  const group = findGroup(next, groupId);

  if (!group) return groups;

  group.tasks = arrayMove(
    group.tasks,
    activeIndex,
    overIndex
  );

  return next;
}

function moveBetweenGroups(
  groups: Group[],
  sourceGroupId: number,
  destinationGroupId: number,
  sourceIndex: number,
  destinationIndex: number
) {
  const next = cloneGroups(groups);

  const source = findGroup(next, sourceGroupId);
  const destination = findGroup(next, destinationGroupId);

  if (!source || !destination) {
    return groups;
  }

  moveTask(
    source,
    destination,
    sourceIndex,
    destinationIndex
  );

  return next;
}

function moveToEmptyGroup(
  groups: Group[],
  sourceGroupId: number,
  destinationGroupId: number,
  sourceIndex: number
) {
  const next = cloneGroups(groups);

  const source = findGroup(next, sourceGroupId);
  const destination = findGroup(next, destinationGroupId);

  if (!source || !destination) {
    return groups;
  }

  moveTask(
    source,
    destination,
    sourceIndex,
    0
  );

  return next;
}

interface Props {
  groups: Group[];

  activeTaskId: number;

  overTaskId?: number;

  overGroupId?: number;

  overType: "task" | "group-drop";
}
export function handleTaskDragOver({
  groups,
  activeTaskId,
  overTaskId,
  overGroupId,
  overType,
}: Props) {

  const active = findTaskLocation(
    groups,
    activeTaskId
  );

  if (!active) {
    return groups;
  }

  /**
   * Dropped onto another task
   */

  if (overType === "task") {

    if (!overTaskId) {
      return groups;
    }

    const over = findTaskLocation(
      groups,
      overTaskId
    );

    if (!over) {
      return groups;
    }

    /**
     * Same group
     */

    if (
      active.group.id === over.group.id
    ) {

      if (
        active.taskIndex ===
        over.taskIndex
      ) {
        return groups;
      }

      return reorderWithinGroup(
        groups,
        active.group.id,
        active.taskIndex,
        over.taskIndex
      );
    }

    /**
     * Different groups
     */

    return moveBetweenGroups(
      groups,
      active.group.id,
      over.group.id,
      active.taskIndex,
      over.taskIndex
    );
  }

  /**
   * Dropped onto empty group
   */

  if (overType === "group-drop") {

    if (!overGroupId) {
      return groups;
    }

    return moveToEmptyGroup(
      groups,
      active.group.id,
      overGroupId,
      active.taskIndex
    );
  }

  return groups;
}