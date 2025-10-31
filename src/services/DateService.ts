import * as path from "path";

/**
 * Service class for all date-related operations.
 * Follows Single Responsibility Principle - handles only date calculations and conversions.
 * All date operations use local time, never UTC.
 */
export class DateService {
  // Regex patterns for date extraction
  private readonly DATE_REGEX = /(?<!\d)(\d{4})[-/](\d{2})[-/](\d{2})(?!\d)/;
  private readonly ISO_WEEK_REGEX = /(\d{4})-W(\d{2})/i;

  /**
   * Get ISO week information for a given date.
   * ISO weeks start on Monday and the first week contains the first Thursday of the year.
   * @param date The date to get week information for
   * @returns Object with year and week number
   */
  getISOWeek(date: Date): { year: number; week: number } {
    const target = new Date(date.valueOf());
    const dayNum = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNum + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    return { year: target.getFullYear(), week };
  }

  /**
   * Get the Monday (start) of a given ISO week.
   * @param year ISO year
   * @param week ISO week number
   * @returns Date object representing Monday of that week
   */
  getMonday(year: number, week: number): Date {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const isoWeekStart = simple;
    if (dow <= 4) {
      isoWeekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      isoWeekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    return isoWeekStart;
  }

  /**
   * Parse a date string in YYYY-MM-DD format as a local date (not UTC).
   * @param dateString Date string in YYYY-MM-DD format
   * @returns Date object or null if parsing fails
   */
  parseLocalDate(dateString: string): Date | null {
    const parts = dateString.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // Month is 0-indexed
      const day = parseInt(parts[2]);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(year, month, day);
      }
    }
    return null;
  }

  /**
   * Format a date as YYYY-MM-DD.
   * @param date Date to format
   * @returns Formatted date string
   */
  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Format a date's time as HH:mm.
   * @param date Date to format
   * @returns Formatted time string
   */
  formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }

  /**
   * Get the last occurrence of a specific day of the week before the reference date.
   * @param reference Reference date to search backwards from
   * @param dayName Name of the day (e.g., "monday", "tuesday")
   * @returns Date object or null if day name is invalid
   */
  getLastDayOfWeek(reference: Date, dayName: string): Date | null {
    const dayMap: { [key: string]: number } = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const targetDay = dayMap[dayName.toLowerCase()];
    if (targetDay === undefined) {
      return null;
    }

    // Start from yesterday and go backwards
    const date = new Date(reference);
    date.setDate(date.getDate() - 1);

    // Keep going back until we find the target day
    while (date.getDay() !== targetDay) {
      date.setDate(date.getDate() - 1);
    }

    return date;
  }

  /**
   * Get the next occurrence of a specific day of the week after the reference date.
   * @param reference Reference date to search forwards from
   * @param dayName Name of the day (e.g., "monday", "tuesday")
   * @returns Date object or null if day name is invalid
   */
  getNextDayOfWeek(reference: Date, dayName: string): Date | null {
    const dayMap: { [key: string]: number } = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const targetDay = dayMap[dayName.toLowerCase()];
    if (targetDay === undefined) {
      return null;
    }

    // Start from tomorrow and go forwards
    const date = new Date(reference);
    date.setDate(date.getDate() + 1);

    // Keep going forward until we find the target day
    while (date.getDay() !== targetDay) {
      date.setDate(date.getDate() + 1);
    }

    return date;
  }

  /**
   * Check if a date falls within a specified range.
   * For weekly files, checks if the week overlaps with the date range.
   * @param fileDate Date extracted from the file (could be a week start date)
   * @param from Optional start date of range
   * @param to Optional end date of range
   * @returns True if the date is within range
   */
  isDateInRange(fileDate: Date, from?: Date, to?: Date): boolean {
    const weekStart = new Date(fileDate);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const rangeStart = from ? new Date(from.getFullYear(), from.getMonth(), from.getDate()) : new Date(0);
    const rangeEnd = to ? new Date(to.getFullYear(), to.getMonth(), to.getDate()) : new Date(9999, 11, 31);

    return weekStart <= rangeEnd && weekEnd >= rangeStart;
  }

  /**
   * Extract a date from a file path or filename.
   * Supports YYYY-MM-DD and YYYY-Www (ISO week) formats.
   * @param relativePath File path to extract date from
   * @returns Date object or null if no date found
   */
  extractDateFromPath(relativePath: string): Date | null {
    const fileName = path.basename(relativePath, ".md");
    
    // Try YYYY-MM-DD format
    let match = this.DATE_REGEX.exec(fileName);
    if (!match) {
      match = this.DATE_REGEX.exec(relativePath);
    }
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        try {
          return new Date(year, month - 1, day);
        } catch {
          // ignore invalid dates
        }
      }
    }

    // Try ISO week format YYYY-Www
    match = this.ISO_WEEK_REGEX.exec(fileName);
    if (!match) {
      match = this.ISO_WEEK_REGEX.exec(relativePath);
    }
    if (match) {
      const year = parseInt(match[1]);
      const week = parseInt(match[2]);
      try {
        return this.getMonday(year, week);
      } catch {
        // ignore invalid week/year combos
      }
    }

    return null;
  }
}

// Export a singleton instance for convenience
export const dateService = new DateService();
