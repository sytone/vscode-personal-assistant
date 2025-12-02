/**
 * Parameters for adding a journal entry.
 */
export interface IAddJournalEntryParameters {
	/**
	 * The content of the journal entry.
	 */
	entryContent: string;

	/**
	 * Optional path to journal folder relative to vault root.
	 * If not provided, uses the default from context.
	 */
	journalPath?: string;

	/**
	 * Target date in YYYY-MM-DD format.
	 * If not provided, uses today's date.
	 */
	date?: string;
}

/**
 * Parameters for reading journal entries.
 */
export interface IReadJournalEntriesParameters {
	/**
	 * Optional path to journal folder relative to vault root.
	 */
	journalPath?: string;

	/**
	 * Start date in YYYY-MM-DD format (inclusive).
	 */
	fromDate?: string;

	/**
	 * End date in YYYY-MM-DD format (inclusive).
	 */
	toDate?: string;

	/**
	 * Maximum number of entries to return.
	 * @default 10
	 */
	maxEntries?: number;

	/**
	 * Whether to include the full content of each entry.
	 * @default true
	 */
	includeContent?: boolean;
}

/**
 * Parameters for adding a journal task.
 */
export interface IAddJournalTaskParameters {
	/**
	 * Description of the task to add.
	 */
	taskDescription: string;

	/**
	 * Optional path to journal folder relative to vault root.
	 */
	journalPath?: string;

	/**
	 * Target date in YYYY-MM-DD format to determine which week.
	 * If not provided, uses today's date.
	 */
	date?: string;

	/**
	 * Whether the task should be marked as completed.
	 * @default false
	 */
	completed?: boolean;

	/**
	 * Description of parent task to add this task as a child.
	 * If specified, this task will be added with proper indentation.
	 */
	parentTask?: string;

	/**
	 * Array of child task descriptions to add under this parent task.
	 */
	childTasks?: string[];
}

/**
 * Parameters for completing a journal task.
 */
export interface ICompleteJournalTaskParameters {
	/**
	 * Description of the task to complete (supports partial matching).
	 */
	taskDescription: string;

	/**
	 * Optional path to journal folder relative to vault root.
	 */
	journalPath?: string;

	/**
	 * Target date in YYYY-MM-DD format to determine which week.
	 * If not provided, uses today's date.
	 */
	date?: string;
}

/**
 * Parameters for reading journal tasks.
 */
export interface IReadJournalTasksParameters {
	/**
	 * Optional path to journal folder relative to vault root.
	 */
	journalPath?: string;

	/**
	 * Target date in YYYY-MM-DD format to determine which week.
	 * If not provided, uses today's date.
	 */
	date?: string;

	/**
	 * Whether to include completed tasks in results.
	 * @default true
	 */
	showCompleted?: boolean;

	/**
	 * Whether to include incomplete tasks in results.
	 * @default true
	 */
	showIncomplete?: boolean;
}
