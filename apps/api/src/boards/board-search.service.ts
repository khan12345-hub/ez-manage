import { Injectable } from '@nestjs/common';
import { BoardColumnType } from 'generated/prisma/enums';


@Injectable()
export class BoardSearchService {
  /**
   * Search a task and all of its subtasks recursively.
   */
  taskMatchesSearch(
    task: any,
    search: string,
  ): boolean {
    const normalizedSearch =
      search.trim().toLowerCase();

    if (!normalizedSearch) {
      return true;
    }

    // Search current task
    if (
      this.taskFieldsMatchSearch(
        task,
        normalizedSearch,
      )
    ) {
      return true;
    }

    // Search subtasks recursively
    return (
      task.subtasks ?? []
    ).some((subtask: any) =>
      this.taskMatchesSearch(
        subtask,
        normalizedSearch,
      ),
    );
  }

  /**
   * Search task fields.
   *
   * Supports:
   * - Task name
   * - Status
   * - Person
   * - Date
   * - Timeline
   * - Uploaded file name
   */
  private taskFieldsMatchSearch(
    task: any,
    search: string,
  ): boolean {
    /*
     * Task name
     */
    const taskName =
      task.name
        ?.trim()
        .toLowerCase();

    if (
      taskName?.includes(search)
    ) {
      return true;
    }

    /*
     * Cells
     */
    return (
      task.cells ?? []
    ).some((cell: any) =>
      this.cellMatchesSearch(
        cell,
        search,
      ),
    );
  }

  /**
   * Search an individual cell.
   */
  private cellMatchesSearch(
    cell: any,
    search: string,
  ): boolean {
    /*
     * Uploaded files
     */
    if (
      this.fileMatchesSearch(
        cell,
        search,
      )
    ) {
      return true;
    }

    const columnType =
      cell.column?.type;

    /*
     * Status
     */
    if (
      columnType ===
      BoardColumnType.STATUS
    ) {
      return this.statusMatchesSearch(
        cell,
        search,
      );
    }

    /*
     * Person
     */
    if (
      columnType ===
      BoardColumnType.PERSON
    ) {
      return this.personCellMatchesSearch(
        cell,
        search,
      );
    }

    /*
     * Date
     */
    if (
      columnType ===
      BoardColumnType.DATE
    ) {
      return this.dateCellMatchesSearch(
        cell,
        search,
      );
    }

    /*
     * Timeline
     */
    if (
      columnType ===
      BoardColumnType.TIMELINE
    ) {
      return this.timelineCellMatchesSearch(
        cell,
        search,
      );
    }

    return false;
  }

  /**
   * Status search.
   */
  private statusMatchesSearch(
    cell: any,
    search: string,
  ): boolean {
    const statusValue =
      cell.value as {
        label?: string;
        color?: string;
      } | null;

    return (
      statusValue?.label
        ?.trim()
        .toLowerCase()
        .includes(search) ??
      false
    );
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
  private personCellMatchesSearch(
    cell: any,
    search: string,
  ): boolean {
    const personValue =
      cell.value as {
        users?: {
          id?: number;
          role?: string;
          email?: string;
          firstName?: string;
          lastName?: string;
          avatarUrl?: string | null;
        }[];
      } | null;

    if (
      !personValue?.users?.length
    ) {
      return false;
    }

    return personValue.users.some(
      (person) => {
        const firstName =
          person.firstName
            ?.trim()
            .toLowerCase() ?? '';

        const lastName =
          person.lastName
            ?.trim()
            .toLowerCase() ?? '';

        const email =
          person.email
            ?.trim()
            .toLowerCase() ?? '';

        const fullName =
          `${firstName} ${lastName}`.trim();

        return (
          firstName.includes(search) ||
          lastName.includes(search) ||
          fullName.includes(search) ||
          email.includes(search)
        );
      },
    );
  }

  /**
   * Uploaded file search.
   */
  private fileMatchesSearch(
    cell: any,
    search: string,
  ): boolean {
    return (
      cell.files ?? []
    ).some((fileRelation: any) => {
      const file =
        fileRelation?.file ??
        fileRelation;

      const fileName =
        file?.fileName
          ?.trim()
          .toLowerCase();

      return (
        fileName?.includes(search) ??
        false
      );
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
  private dateCellMatchesSearch(
    cell: any,
    search: string,
  ): boolean {
    return this.dateValueMatchesSearch(
      cell.value?.date,
      search,
    );
  }

  /**
   * Timeline search.
   *
   * Supports:
   * - startDate / endDate
   * - start / end
   * - from / to
   */
  private timelineCellMatchesSearch(
    cell: any,
    search: string,
  ): boolean {
    const timelineValue =
      cell.value;

    if (!timelineValue) {
      return false;
    }

    const startDate =
      timelineValue.startDate ??
      timelineValue.start ??
      timelineValue.from;

    const endDate =
      timelineValue.endDate ??
      timelineValue.end ??
      timelineValue.to;

    return (
      this.dateValueMatchesSearch(
        startDate,
        search,
      ) ||
      this.dateValueMatchesSearch(
        endDate,
        search,
      )
    );
  }

  /**
   * Generic date search.
   */
  private dateValueMatchesSearch(
    dateValue: any,
    search: string,
  ): boolean {
    if (!dateValue) {
      return false;
    }

    const normalizedSearch =
      search
        .trim()
        .toLowerCase()
        .replace(/,/g, '')
        .replace(/\s+/g, ' ');

    const date =
      new Date(dateValue);

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return false;
    }

    const year =
      date.getUTCFullYear();

    const month =
      date.getUTCMonth() + 1;

    const day =
      date.getUTCDate();

    const paddedMonth =
      String(month).padStart(
        2,
        '0',
      );

    const paddedDay =
      String(day).padStart(
        2,
        '0',
      );

    const monthName =
      new Intl.DateTimeFormat(
        'en-US',
        {
          month: 'long',
          timeZone: 'UTC',
        },
      )
        .format(date)
        .toLowerCase();

    const shortMonthName =
      new Intl.DateTimeFormat(
        'en-US',
        {
          month: 'short',
          timeZone: 'UTC',
        },
      )
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

    return dateFormats.some(
      (value) => {
        const normalizedValue =
          value
            .toLowerCase()
            .replace(/,/g, '')
            .replace(
              /\s+/g,
              ' ',
            )
            .trim();

        return normalizedValue.includes(
          normalizedSearch,
        );
      },
    );
  }

  /**
   * Search a task for a specific person.
   *
   * This also searches subtasks recursively.
   */
  taskMatchesPerson(
    task: any,
    person: string,
  ): boolean {
    const normalizedPerson =
      person
        .trim()
        .toLowerCase();

    if (!normalizedPerson) {
      return true;
    }

    /*
     * Search current task
     */
    const currentTaskMatches =
      (
        task.cells ?? []
      ).some(
        (cell: any) => {
          if (
            cell.column?.type !==
            BoardColumnType.PERSON
          ) {
            return false;
          }

          return this.personCellMatchesSearch(
            cell,
            normalizedPerson,
          );
        },
      );

    if (currentTaskMatches) {
      return true;
    }

    /*
     * Search subtasks
     */
    return (
      task.subtasks ?? []
    ).some((subtask: any) =>
      this.taskMatchesPerson(
        subtask,
        normalizedPerson,
      ),
    );
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
    const search =
      options.search
        ?.trim()
        .toLowerCase() ?? '';

    const person =
      options.person
        ?.trim()
        .toLowerCase() ?? '';

    return tasks.filter(
      (task) => {
        const matchesSearch =
          !search ||
          this.taskMatchesSearch(
            task,
            search,
          );

        const matchesPerson =
          !person ||
          this.taskMatchesPerson(
            task,
            person,
          );

        return (
          matchesSearch &&
          matchesPerson
        );
      },
    );
  }
}