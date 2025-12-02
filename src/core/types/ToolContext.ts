/**
 * Platform-agnostic context required for tool execution.
 * This interface decouples tool logic from specific runtime environments.
 */
export interface IToolContext {
	/**
	 * Root directory of the vault/workspace containing notes and journals.
	 * Should be an absolute path.
	 */
	vaultRoot: string;

	/**
	 * Path to the journal folder relative to vault root.
	 * @default "1 Journal"
	 */
	journalPath: string;

	/**
	 * Heading used for the tasks section in journal files.
	 * @default "## Tasks This Week"
	 */
	tasksHeading: string;

	/**
	 * Folder containing markdown templates relative to vault root.
	 * @default "Templates"
	 */
	templatesFolderName: string;

	/**
	 * Template file name (without extension) for weekly journals.
	 * @default "journal-weekly"
	 */
	journalTemplateName: string;
}

/**
 * Result returned by core tool operations.
 * Provides a consistent interface for both success and error cases.
 */
export interface IToolResult {
	/**
	 * Whether the operation completed successfully.
	 */
	success: boolean;

	/**
	 * Human-readable message describing the result.
	 */
	message: string;

	/**
	 * Optional structured data returned by the operation.
	 */
	data?: any;

	/**
	 * Error details if the operation failed.
	 */
	error?: string;
}

/**
 * Configuration provider interface for platform-specific settings.
 * Implementations provide configuration from VS Code settings, environment variables, or other sources.
 */
export interface IConfigProvider {
	/**
	 * Retrieves the current tool context configuration.
	 * @returns The tool context with all required settings
	 */
	getContext(): IToolContext;
}
