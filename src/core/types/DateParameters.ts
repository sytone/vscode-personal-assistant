/**
 * Parameter interfaces for Date Utility Tools.
 * These define the input parameters for date calculation and information operations.
 */

/**
 * Parameters for calculating a relative date from a description.
 * 
 * @example
 * ```typescript
 * {
 *   relativeDateDescription: "last Wednesday",
 *   referenceDate: "2025-11-26"
 * }
 * ```
 */
export interface ICalculateRelativeDateParameters {
	/** Natural language description of the relative date (e.g., "yesterday", "next Monday", "2 days ago") */
	relativeDateDescription: string;
	/** Optional reference date in YYYY-MM-DD format. Defaults to today if not provided. */
	referenceDate?: string;
}

/**
 * Parameters for getting detailed information about a specific date.
 * 
 * @example
 * ```typescript
 * {
 *   date: "2025-11-26"
 * }
 * ```
 */
export interface IGetDateInfoParameters {
	/** Date in YYYY-MM-DD format for which to retrieve information */
	date: string;
}

/**
 * Parameters for getting all dates in a week.
 * 
 * @example
 * ```typescript
 * {
 *   date: "2025-11-26"  // Optional, defaults to current week
 * }
 * ```
 */
export interface IGetWeekDatesParameters {
	/** Optional date in YYYY-MM-DD format. Returns the week containing this date. Defaults to current week. */
	date?: string;
}
