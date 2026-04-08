/**
 * DateTime Formatter Utility
 * Consistent date/time formatting across the application
 */

import dayjs, { Dayjs } from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);

export class DateTimeFormatter {
  private static readonly DEFAULT_DATE_FORMAT = "YYYY-MM-DD";
  private static readonly DEFAULT_TIME_FORMAT = "HH:mm:ss";
  private static readonly DEFAULT_DATETIME_FORMAT = "YYYY-MM-DD HH:mm:ss";
  private static readonly DEFAULT_TIMEZONE =
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  /**
   * Format a date
   */
  static formatDate(
    date: string | Date | Dayjs,
    format: string = this.DEFAULT_DATE_FORMAT,
  ): string {
    return dayjs(date).format(format);
  }

  /**
   * Format a time
   */
  static formatTime(
    date: string | Date | Dayjs,
    format: string = this.DEFAULT_TIME_FORMAT,
  ): string {
    return dayjs(date).format(format);
  }

  /**
   * Format a datetime
   */
  static formatDateTime(
    date: string | Date | Dayjs,
    format: string = this.DEFAULT_DATETIME_FORMAT,
  ): string {
    return dayjs(date).format(format);
  }

  /**
   * Format as relative time (e.g., "2 hours ago")
   */
  static fromNow(date: string | Date | Dayjs): string {
    return dayjs(date).fromNow();
  }

  /**
   * Format as relative time (e.g., "in 2 hours")
   */
  static toNow(date: string | Date | Dayjs): string {
    return dayjs(date).toNow();
  }

  /**
   * Format as calendar time (e.g., "Today at 2:00 PM")
   */
  static formatCalendar(date: string | Date | Dayjs): string {
    return dayjs(date).calendar();
  }

  /**
   * Get the difference between two dates
   */
  static getDifference(
    date1: string | Date | Dayjs,
    date2: string | Date | Dayjs,
    unit:
      | "second"
      | "minute"
      | "hour"
      | "day"
      | "month"
      | "year" = "millisecond",
  ): number {
    return dayjs(date1).diff(dayjs(date2), unit as any);
  }

  /**
   * Check if date is today
   */
  static isToday(date: string | Date | Dayjs): boolean {
    return dayjs(date).isSame(dayjs(), "day");
  }

  /**
   * Check if date is yesterday
   */
  static isYesterday(date: string | Date | Dayjs): boolean {
    return dayjs(date).isSame(dayjs().subtract(1, "day"), "day");
  }

  /**
   * Check if date is tomorrow
   */
  static isTomorrow(date: string | Date | Dayjs): boolean {
    return dayjs(date).isSame(dayjs().add(1, "day"), "day");
  }

  /**
   * Check if date is in the past
   */
  static isPast(date: string | Date | Dayjs): boolean {
    return dayjs(date).isBefore(dayjs());
  }

  /**
   * Check if date is in the future
   */
  static isFuture(date: string | Date | Dayjs): boolean {
    return dayjs(date).isAfter(dayjs());
  }

  /**
   * Convert to UTC
   */
  static toUTC(date: string | Date | Dayjs): Dayjs {
    return dayjs(date).utc();
  }

  /**
   * Convert from UTC
   */
  static fromUTC(date: string | Date | Dayjs): Dayjs {
    return dayjs.utc(date).tz(this.DEFAULT_TIMEZONE);
  }

  /**
   * Convert to timezone
   */
  static toTimezone(date: string | Date | Dayjs, timezone: string): Dayjs {
    return dayjs(date).tz(timezone);
  }

  /**
   * Get start of date (beginning of the day)
   */
  static startOfDay(date: string | Date | Dayjs): Dayjs {
    return dayjs(date).startOf("day");
  }

  /**
   * Get end of date (end of the day)
   */
  static endOfDay(date: string | Date | Dayjs): Dayjs {
    return dayjs(date).endOf("day");
  }

  /**
   * Get start of month
   */
  static startOfMonth(date: string | Date | Dayjs): Dayjs {
    return dayjs(date).startOf("month");
  }

  /**
   * Get end of month
   */
  static endOfMonth(date: string | Date | Dayjs): Dayjs {
    return dayjs(date).endOf("month");
  }

  /**
   * Add time
   */
  static add(
    date: string | Date | Dayjs,
    value: number,
    unit: "day" | "hour" | "minute" | "second" | "month" | "year",
  ): Dayjs {
    return dayjs(date).add(value, unit);
  }

  /**
   * Subtract time
   */
  static subtract(
    date: string | Date | Dayjs,
    value: number,
    unit: "day" | "hour" | "minute" | "second" | "month" | "year",
  ): Dayjs {
    return dayjs(date).subtract(value, unit);
  }

  /**
   * Format duration in human-readable format
   */
  static formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Get current date/time
   */
  static now(): Dayjs {
    return dayjs();
  }

  /**
   * Parse date string
   */
  static parse(dateString: string, format: string): Dayjs {
    return dayjs(dateString, format);
  }
}

// Export helpers
export const formatDate = DateTimeFormatter.formatDate;
export const formatTime = DateTimeFormatter.formatTime;
export const formatDateTime = DateTimeFormatter.formatDateTime;
export const fromNow = DateTimeFormatter.fromNow;
export const toNow = DateTimeFormatter.toNow;
