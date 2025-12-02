/**
 * Core business logic for date utility operations.
 * Platform-agnostic implementation for date calculations, conversions, and information retrieval.
 */

import type { IToolResult } from "../types/ToolContext";
import type {
	ICalculateRelativeDateParameters,
	IGetDateInfoParameters,
	IGetWeekDatesParameters,
} from "../types/DateParameters";
import type { DateService } from "../../services/DateService";

/**
 * Date information result structure.
 */
interface DateInfoResult {
	success: boolean;
	date?: string;
	dayOfWeek?: string;
	dayOfMonth?: number;
	month?: string;
	year?: number;
	isoWeek?: number;
	isoYear?: number;
	dayOfYear?: number;
	relativeToToday?: string;
	daysFromToday?: number;
	today?: string;
	error?: string;
}

/**
 * Relative date calculation result structure.
 */
interface RelativeDateResult {
	success: boolean;
	inputDescription?: string;
	referenceDate?: string;
	referenceDayOfWeek?: string;
	calculatedDate?: string;
	calculatedDayOfWeek?: string;
	daysFromReference?: number;
	isoWeek?: number;
	isoYear?: number;
	error?: string;
	hint?: string;
}

/**
 * Week date entry structure.
 */
interface WeekDateEntry {
	date: string;
	dayOfWeek: string;
	dayNumber: number;
	isToday: boolean;
}

/**
 * Week dates result structure.
 */
interface WeekDatesResult {
	success: boolean;
	isoWeek?: number;
	isoYear?: number;
	weekDescription?: string;
	dates?: WeekDateEntry[];
}

/**
 * Core implementation for date utility operations.
 * Provides platform-agnostic date calculations and information retrieval.
 */
export class DateUtilityToolCore {
	/**
	 * Creates a new DateUtilityToolCore instance.
	 * 
	 * @param dateService - Service for date operations and calculations
	 */
	constructor(private readonly dateService: DateService) {}

	/**
	 * Calculates a date based on a natural language relative description.
	 * 
	 * @param params - Parameters containing relative date description and optional reference date
	 * @returns Result with calculated date information or error
	 * 
	 * @remarks
	 * Supported formats:
	 * - Keywords: "today", "yesterday", "tomorrow"
	 * - Day of week: "last Wednesday", "next Monday", "previous Friday"
	 * - Numeric: "2 days ago", "3 weeks ago", "1 day ago"
	 * 
	 * All calculations use local time zone and set hours to midnight for consistency.
	 * 
	 * @example
	 * ```typescript
	 * const result = await core.calculateRelativeDate({
	 *   relativeDateDescription: "last Wednesday",
	 *   referenceDate: "2025-11-26"
	 * });
	 * // Returns calculated date with ISO week and day of week information
	 * ```
	 */
	async calculateRelativeDate(params: ICalculateRelativeDateParameters): Promise<IToolResult> {
		let reference = new Date();
		reference.setHours(0, 0, 0, 0);

		if (params.referenceDate) {
			const parsed = this.dateService.parseLocalDate(params.referenceDate);
			if (parsed) {
				reference = parsed;
			}
		}

		const description = params.relativeDateDescription.toLowerCase().trim();
		let calculatedDate: Date | null = null;

		try {
			// Handle specific keywords
			if (description === "today") {
				calculatedDate = reference;
			} else if (description === "yesterday") {
				calculatedDate = new Date(reference);
				calculatedDate.setDate(calculatedDate.getDate() - 1);
			} else if (description === "tomorrow") {
				calculatedDate = new Date(reference);
				calculatedDate.setDate(calculatedDate.getDate() + 1);
			}
			// Handle "last/previous [day of week]"
			else if (description.startsWith("last ") || description.startsWith("previous ")) {
				const dayName = description.replace("last ", "").replace("previous ", "").trim();
				calculatedDate = this.dateService.getLastDayOfWeek(reference, dayName);
			}
			// Handle "next [day of week]"
			else if (description.startsWith("next ")) {
				const dayName = description.replace("next ", "").trim();
				calculatedDate = this.dateService.getNextDayOfWeek(reference, dayName);
			}
			// Handle "X days ago"
			else if (description.includes("days ago") || description.includes("day ago")) {
				const match = description.match(/(\d+)\s+days?\s+ago/);
				if (match) {
					const days = parseInt(match[1]);
					calculatedDate = new Date(reference);
					calculatedDate.setDate(calculatedDate.getDate() - days);
				}
			}
			// Handle "X weeks ago"
			else if (description.includes("weeks ago") || description.includes("week ago")) {
				const match = description.match(/(\d+)\s+weeks?\s+ago/);
				if (match) {
					const weeks = parseInt(match[1]);
					calculatedDate = new Date(reference);
					calculatedDate.setDate(calculatedDate.getDate() - weeks * 7);
				}
			}

			if (calculatedDate) {
				const isoWeek = this.dateService.getISOWeek(calculatedDate);
				const daysFromReference = Math.floor(
					(calculatedDate.getTime() - reference.getTime()) / (1000 * 60 * 60 * 24)
				);

				const result: RelativeDateResult = {
					success: true,
					inputDescription: params.relativeDateDescription,
					referenceDate: this.dateService.formatDate(reference),
					referenceDayOfWeek: reference.toLocaleDateString("en-US", { weekday: "long" }),
					calculatedDate: this.dateService.formatDate(calculatedDate),
					calculatedDayOfWeek: calculatedDate.toLocaleDateString("en-US", { weekday: "long" }),
					daysFromReference,
					isoWeek: isoWeek.week,
					isoYear: isoWeek.year,
				};

				return {
					success: true,
					message: JSON.stringify(result, null, 2),
				};
			}

			const errorResult: RelativeDateResult = {
				success: false,
				error: `Could not parse relative date description: '${params.relativeDateDescription}'`,
				hint: "Try formats like 'last Wednesday', 'next Monday', 'yesterday', '2 days ago', 'three weeks ago'",
			};

			return {
				success: false,
				message: JSON.stringify(errorResult, null, 2),
				error: errorResult.error,
			};
		} catch (err) {
			const errorResult: RelativeDateResult = {
				success: false,
				error: `Error calculating date: ${err}`,
			};

			return {
				success: false,
				message: JSON.stringify(errorResult, null, 2),
				error: String(err),
			};
		}
	}

	/**
	 * Retrieves detailed information about a specific date.
	 * 
	 * @param params - Parameters containing the target date
	 * @returns Result with comprehensive date information or error
	 * 
	 * @remarks
	 * Returns:
	 * - Day of week, month, year
	 * - ISO week number and year
	 * - Day of year
	 * - Relative description compared to today
	 * - Days difference from today
	 * 
	 * @example
	 * ```typescript
	 * const result = await core.getDateInfo({ date: "2025-11-26" });
	 * // Returns detailed information about the date
	 * ```
	 */
	async getDateInfo(params: IGetDateInfoParameters): Promise<IToolResult> {
		const targetDate = this.dateService.parseLocalDate(params.date);
		if (!targetDate) {
			const errorResult: DateInfoResult = {
				success: false,
				error: `Invalid date format: '${params.date}'. Use YYYY-MM-DD format.`,
			};

			return {
				success: false,
				message: JSON.stringify(errorResult, null, 2),
				error: errorResult.error,
			};
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const daysDifference = Math.floor(
			(targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
		);

		let relativeDescription: string;
		if (daysDifference === 0) {
			relativeDescription = "today";
		} else if (daysDifference === 1) {
			relativeDescription = "tomorrow";
		} else if (daysDifference === -1) {
			relativeDescription = "yesterday";
		} else if (daysDifference > 0) {
			relativeDescription = `in ${daysDifference} days`;
		} else {
			relativeDescription = `${Math.abs(daysDifference)} days ago`;
		}

		const isoWeek = this.dateService.getISOWeek(targetDate);
		const dayOfYear = Math.floor(
			(targetDate.getTime() - new Date(targetDate.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
		);

		const result: DateInfoResult = {
			success: true,
			date: this.dateService.formatDate(targetDate),
			dayOfWeek: targetDate.toLocaleDateString("en-US", { weekday: "long" }),
			dayOfMonth: targetDate.getDate(),
			month: targetDate.toLocaleDateString("en-US", { month: "long" }),
			year: targetDate.getFullYear(),
			isoWeek: isoWeek.week,
			isoYear: isoWeek.year,
			dayOfYear,
			relativeToToday: relativeDescription,
			daysFromToday: daysDifference,
			today: this.dateService.formatDate(today),
		};

		return {
			success: true,
			message: JSON.stringify(result, null, 2),
		};
	}

	/**
	 * Retrieves all dates in the ISO week containing the target date.
	 * 
	 * @param params - Parameters with optional target date (defaults to current week)
	 * @returns Result with week information and array of dates or error
	 * 
	 * @remarks
	 * Returns Monday through Sunday dates for the ISO week.
	 * Each date includes:
	 * - Formatted date string (YYYY-MM-DD)
	 * - Day of week name
	 * - Day number
	 * - Flag indicating if it's today
	 * 
	 * @example
	 * ```typescript
	 * const result = await core.getWeekDates({ date: "2025-11-26" });
	 * // Returns all 7 dates in week 48 of 2025
	 * ```
	 */
	async getWeekDates(params: IGetWeekDatesParameters): Promise<IToolResult> {
		let targetDate = new Date();
		targetDate.setHours(0, 0, 0, 0);

		if (params.date) {
			const parsed = this.dateService.parseLocalDate(params.date);
			if (parsed) {
				targetDate = parsed;
			}
		}

		const isoWeek = this.dateService.getISOWeek(targetDate);

		// Get Monday of the ISO week
		const simple = new Date(isoWeek.year, 0, 1 + (isoWeek.week - 1) * 7);
		const dow = simple.getDay();
		const monday = new Date(simple);
		if (dow <= 4) {
			monday.setDate(simple.getDate() - simple.getDay() + 1);
		} else {
			monday.setDate(simple.getDate() + 8 - simple.getDay());
		}

		const weekDates: WeekDateEntry[] = [];
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		for (let i = 0; i < 7; i++) {
			const day = new Date(monday);
			day.setDate(day.getDate() + i);

			weekDates.push({
				date: this.dateService.formatDate(day),
				dayOfWeek: day.toLocaleDateString("en-US", { weekday: "long" }),
				dayNumber: day.getDate(),
				isToday: day.getTime() === today.getTime(),
			});
		}

		const result: WeekDatesResult = {
			success: true,
			isoWeek: isoWeek.week,
			isoYear: isoWeek.year,
			weekDescription: `Week ${isoWeek.week} of ${isoWeek.year}`,
			dates: weekDates,
		};

		return {
			success: true,
			message: JSON.stringify(result, null, 2),
		};
	}
}
