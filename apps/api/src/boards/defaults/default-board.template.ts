import { BoardColumnType } from 'generated/prisma/enums';

export const DEFAULT_COLUMNS = [
  {
    name: 'Task',
    type: BoardColumnType.TEXT,
    isPrimary: true,
  },
  {
    name: 'Person',
    type: BoardColumnType.PERSON,
    isPrimary: false,
  },
  {
    name: 'Status',
    type: BoardColumnType.STATUS,
    isPrimary: false,
  },
  {
    name: 'Date',
    type: BoardColumnType.DATE,
    isPrimary: false,
  },
];

export const DEFAULT_GROUPS = [
  {
    name: 'Group Title',
    color: '#579BFC',
    order: 1,
    tasks: [
      {
        title: 'Item 1',
        status: 'Working',
        date: new Date('2025-09-17'),
      },
      {
        title: 'Item 2',
        status: 'Done',
        date: new Date('2025-09-17'),
      },
      {
        title: 'Item 3',
        status: 'Not Started',
        date: new Date('2025-09-15'),
      },
    ],
  },
  {
    name: 'Group Title 2',
    color: '#A25DDC',
    order: 2,
    tasks: [
      {
        title: 'Item 4',
        status: 'Not Started',
        date: new Date('2025-09-17'),
      },
      {
        title: 'Item 5',
        status: 'Not Started',
        date: new Date('2025-09-15'),
      },
    ],
  },
];
export const DEFAULT_STATUS_OPTIONS = [
  {
    label: 'Not Started',
    color: '#9CA3AF',
    order: 1000,
  },
  {
    label: 'Working',
    color: '#F59E0B',
    order: 2000,
  },
  {
    label: 'Done',
    color: '#22C55E',
    order: 3000,
  },
  {
    label: 'Stuck',
    color: '#EF4444',
    order: 4000,
  },
];
