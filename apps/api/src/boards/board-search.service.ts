import { Injectable } from '@nestjs/common';
import { BoardColumnType } from 'generated/prisma/enums';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class BoardSearchService {

  constructor(private readonly prisma: PrismaService) {}

  taskMatchesSearch(task: any, search: string): boolean {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return true;
    }

    // Search current task
    if (this.taskFieldsMatchSearch(task, normalizedSearch)) {
      return true;
    }

    // Search subtasks recursively
    return (task.subtasks ?? []).some((subtask: any) =>
      this.taskMatchesSearch(subtask, normalizedSearch),
    );
  }

  async findBoardsWithTasks(boardIds: number[]) {
  return this.prisma.board.findMany({
    where: {
      id: {
        in: boardIds,
      },
    },

    include: {
      columns: {
        include: {
          statusOptions: {
            where: {
              isArchived: false,
            },
          },
        },

        orderBy: {
          order: 'asc',
        },
      },

      groups: {
        orderBy: {
          order: 'asc',
        },

        include: {
          tasks: {
            where: {
              parentId: null,
            },

            orderBy: {
              order: 'asc',
            },

            include: {
              cells: {
                include: {
                  column: {
                    include: {
                      statusOptions: {
                        where: {
                          isArchived: false,
                        },
                      },
                    },
                  },

                  files: {
                    include: {
                      file: true,
                    },
                  },
                },
              },

              subtasks: {
                orderBy: {
                  order: 'asc',
                },

                include: {
                  cells: {
                    include: {
                      column: {
                        include: {
                          statusOptions: {
                            where: {
                              isArchived: false,
                            },
                          },
                        },
                      },

                      files: {
                        include: {
                          file: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}
 
  private taskFieldsMatchSearch(task: any, search: string): boolean {
    /*
     * Task name
     */
    const taskName = task.name?.trim().toLowerCase();

    if (taskName?.includes(search)) {
      return true;
    }

    /*
     * Cells
     */
    return (task.cells ?? []).some((cell: any) =>
      this.cellMatchesSearch(cell, search),
    );
  }

  /**
   * Search an individual cell.
   */
  private cellMatchesSearch(cell: any, search: string): boolean {
    /*
     * Uploaded files
     */
    if (this.fileMatchesSearch(cell, search)) {
      return true;
    }

    const columnType = cell.column?.type;

    /*
     * Status
     */
    if (columnType === BoardColumnType.STATUS) {
      return this.statusMatchesSearch(cell, search);
    }

    /*
     * Person
     */
    if (columnType === BoardColumnType.PERSON) {
      return this.personCellMatchesSearch(cell, search);
    }

    /*
     * Date
     */
    if (columnType === BoardColumnType.DATE) {
      return this.dateCellMatchesSearch(cell, search);
    }

    /*
     * Timeline
     */
    if (columnType === BoardColumnType.TIMELINE) {
      return this.timelineCellMatchesSearch(cell, search);
    }

    return false;
  }

  /**
   * Status search.
   */
  private statusMatchesSearch(cell: any, search: string): boolean {
    const statusValue = cell.value as {
      label?: string;
      color?: string;
    } | null;

    return statusValue?.label?.trim().toLowerCase().includes(search) ?? false;
  }

  /**
   * Person cell search.
   *
   * Searches:
   * - First name
   * - Last name
   * - Full name
   * - Email
   */
  private personCellMatchesSearch(cell: any, search: string): boolean {
    const personValue = cell.value as {
      users?: {
        id?: number;
        role?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        avatarUrl?: string | null;
      }[];
    } | null;

    if (!personValue?.users?.length) {
      return false;
    }

    return personValue.users.some((person) => {
      const firstName = person.firstName?.trim().toLowerCase() ?? '';

      const lastName = person.lastName?.trim().toLowerCase() ?? '';

      const email = person.email?.trim().toLowerCase() ?? '';

      const fullName = `${firstName} ${lastName}`.trim();

      return (
        firstName.includes(search) ||
        lastName.includes(search) ||
        fullName.includes(search) ||
        email.includes(search)
      );
    });
  }

  /**
   * Uploaded file search.
   */
  private fileMatchesSearch(cell: any, search: string): boolean {
    return (cell.files ?? []).some((fileRelation: any) => {
      const file = fileRelation?.file ?? fileRelation;

      const fileName = file?.fileName?.trim().toLowerCase();

      return fileName?.includes(search) ?? false;
    });
  }

  /**
   * Date column search.
   *
   * Expected value:
   *
   * {
   *   date: "2025-09-17T00:00:00.000Z"
   * }
   */
  private dateCellMatchesSearch(cell: any, search: string): boolean {
    return this.dateValueMatchesSearch(cell.value?.date, search);
  }

  /**
   * Timeline search.
   *
   * Supports:
   * - startDate / endDate
   * - start / end
   * - from / to
   */
  private timelineCellMatchesSearch(cell: any, search: string): boolean {
    const timelineValue = cell.value;

    if (!timelineValue) {
      return false;
    }

    const startDate =
      timelineValue.startDate ?? timelineValue.start ?? timelineValue.from;

    const endDate =
      timelineValue.endDate ?? timelineValue.end ?? timelineValue.to;

    return (
      this.dateValueMatchesSearch(startDate, search) ||
      this.dateValueMatchesSearch(endDate, search)
    );
  }

  /**
   * Generic date search.
   */
  private dateValueMatchesSearch(dateValue: any, search: string): boolean {
    if (!dateValue) {
      return false;
    }

    const normalizedSearch = search
      .trim()
      .toLowerCase()
      .replace(/,/g, '')
      .replace(/\s+/g, ' ');

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    const year = date.getUTCFullYear();

    const month = date.getUTCMonth() + 1;

    const day = date.getUTCDate();

    const paddedMonth = String(month).padStart(2, '0');

    const paddedDay = String(day).padStart(2, '0');

    const monthName = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      timeZone: 'UTC',
    })
      .format(date)
      .toLowerCase();

    const shortMonthName = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      timeZone: 'UTC',
    })
      .format(date)
      .toLowerCase();

    const dateFormats = [
      // 2025-07-01
      `${year}-${paddedMonth}-${paddedDay}`,

      // 07/01/2025
      `${paddedMonth}/${paddedDay}/${year}`,

      // 7/1/2025
      `${month}/${day}/${year}`,

      // 1 Jul 2025
      `${day} ${shortMonthName} ${year}`,

      // 01 Jul 2025
      `${paddedDay} ${shortMonthName} ${year}`,

      // 1 July 2025
      `${day} ${monthName} ${year}`,

      // 01 July 2025
      `${paddedDay} ${monthName} ${year}`,

      // Jul 1 2025
      `${shortMonthName} ${day} ${year}`,

      // July 1 2025
      `${monthName} ${day} ${year}`,

      // Jul 1, 2025
      `${shortMonthName} ${day}, ${year}`,

      // July 1, 2025
      `${monthName} ${day}, ${year}`,

      // 1 Jul, 2025
      `${day} ${shortMonthName}, ${year}`,

      // 1 July, 2025
      `${day} ${monthName}, ${year}`,

      // 2025
      String(year),

      // 07
      paddedMonth,

      // July
      monthName,

      // Jul
      shortMonthName,

      // 01
      paddedDay,

      // 1
      String(day),
    ];

    return dateFormats.some((value) => {
      const normalizedValue = value
        .toLowerCase()
        .replace(/,/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      return normalizedValue.includes(normalizedSearch);
    });
  }

  /**
   * Search a task for a specific person.
   *
   * Accepts either comma-separated user IDs ("1,3") or a text string.
   * This also searches subtasks recursively.
   */
  taskMatchesPerson(task: any, person: string): boolean {
    const trimmed = person.trim();

    if (!trimmed) {
      return true;
    }

    // Detect comma-separated user IDs (e.g. "1,3,7")
    const isIdList = /^[\d,]+$/.test(trimmed);
    const userIds = isIdList
      ? trimmed.split(',').map(Number).filter(Boolean)
      : [];

    const cellMatches = (cell: any): boolean => {
      if (cell.column?.type !== BoardColumnType.PERSON) return false;

      if (isIdList) {
        return this.personCellMatchesIds(cell, userIds);
      }
      return this.personCellMatchesSearch(cell, trimmed.toLowerCase());
    };

    const currentTaskMatches = (task.cells ?? []).some(cellMatches);
    if (currentTaskMatches) return true;

    return (task.subtasks ?? []).some((subtask: any) =>
      this.taskMatchesPerson(subtask, person),
    );
  }

  private personCellMatchesIds(cell: any, userIds: number[]): boolean {
    const personValue = cell.value as { users?: { id?: number }[] } | null;
    if (!personValue?.users?.length) return false;
    return personValue.users.some((u) => u.id !== undefined && userIds.includes(u.id));
  }

  /**
   * Apply all board filters.
   *
   * Search and person filters
   * are combined using AND.
   */
  filterTasks(
    tasks: any[],
    options: {
      search?: string;
      person?: string;
    },
  ): any[] {
    const search = options.search?.trim().toLowerCase() ?? '';

    const person = options.person?.trim().toLowerCase() ?? '';

    return tasks.filter((task) => {
      const matchesSearch = !search || this.taskMatchesSearch(task, search);

      const matchesPerson = !person || this.taskMatchesPerson(task, person);

      return matchesSearch && matchesPerson;
    });
  }
}
