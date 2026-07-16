import { BoardColumnType } from "generated/prisma/enums";

export const DEFAULT_COLUMNS = [
  {
    name: "Task",
    type: BoardColumnType.TEXT,
    isPrimary: true,
  },
  {
    name: "Person",
    type: BoardColumnType.PERSON,
    isPrimary: false,
  },
  {
    name: "Status",
    type: BoardColumnType.STATUS,
    isPrimary: false,
  },
  {
    name: "Date",
    type: BoardColumnType.DATE,
    isPrimary: false,
  },
];

export const DEFAULT_GROUPS = [
  {
    name: "Group Title",
    color: "#579BFC",
    order: 1,
    tasks: [
      {
        title: "Item 1",
        status: { label: "Working on it", color: "orange" },
        date: { date: new Date("2025-09-17") },
      },
      {
        title: "Item 2",
        status: { label: "Done", color: "green" },
        date: { date: new Date("2025-09-17") },
      },
      {
        title: "Item 3",
        status: { label: "Not Started", color: "gray" },
        date: { date: new Date("2025-09-15") },
      },
    ],
  },
  {
    name: "Group Title 2",
    color: "#A25DDC",
    order: 2,
    tasks: [
      {
        title: "Item 4",
        status: { label: "Not Started", color: "gray" },
        date: { date: new Date("2025-09-17") },
      },
      {
        title: "Item 5",
        status: { label: "Not Started", color: "gray" },
        date: { date: new Date("2025-09-15") },
      },
    ],
  },
];