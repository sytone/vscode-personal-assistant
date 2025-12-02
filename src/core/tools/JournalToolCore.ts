import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";
import type { IToolContext, IToolResult } from "../types/ToolContext";
import type {
	IAddJournalEntryParameters,
	IReadJournalEntriesParameters,
	IAddJournalTaskParameters,
	ICompleteJournalTaskParameters,
	IReadJournalTasksParameters,
} from "../types/JournalParameters";

// Re-export parameter interfaces for convenience
export type {
	IAddJournalEntryParameters,
	IReadJournalEntriesParameters,
	IAddJournalTaskParameters,
	ICompleteJournalTaskParameters,
	IReadJournalTasksParameters,
};

// Constants
const EOL = os.EOL;

// Regex patterns
const DAY_SECTION_HEADER_REGEX = /^##\s+\d{1,2}\s+\w+\s*$/;
const DAY_SECTION_HEADER_WITH_CAPTURE_REGEX = /^##\s+(\d{1,2})\s+\w+\s*$/;
const LEVEL2_HEADING_REGEX = /^##\s+/;
const TITLE_HEADING_REGEX = /^#\s+/;

/**
 * Parsed task information extracted from markdown content.
 */
interface ParsedTask {
	line: string;
	description: string;
	completed: boolean;
	indent: number;
	lineIndex: number;
}

/**
 * Platform-agnostic journal tool operations.
 * This class contains the core business logic for journal management,
 * independent of VS Code or MCP server implementations.
 *
 * @remarks
 * All methods are async and return IToolResult for consistent error handling.
 * Requires external dependencies (dateService, templateService) to be injected.
 */
export class JournalToolCore {
	private dateService: any;
	private templateService: any;

	constructor(dateService: any, templateService: any) {
		this.dateService = dateService;
		this.templateService = templateService;
	}

	/**
	 * Adds an entry to a journal file for the specified date.
	 * 
	 * @param context - Tool execution context with vault root and configuration
	 * @param params - Entry parameters including content and optional date
	 * @returns Result indicating success or failure with descriptive message
	 * 
	 * @remarks
	 * - Creates journal file if it doesn't exist
	 * - Strips leading dashes and timestamps from content
	 * - Adds automatic timestamp prefix
	 * - Maintains sequential day order
	 * - Applies markdown formatting
	 */
	async addEntry(
		context: IToolContext,
		params: IAddJournalEntryParameters
	): Promise<IToolResult> {
		if (!params.entryContent || !params.entryContent.trim()) {
			return {
				success: false,
				message: "No content provided.",
				error: "entryContent is required",
			};
		}

		if (!context.vaultRoot) {
			return {
				success: false,
				message: "No vault root configured.",
				error: "vaultRoot is required in context",
			};
		}

		try {
			const journalPath = params.journalPath || context.journalPath;
			const targetDate = params.date
				? this.dateService.parseLocalDate(params.date) || new Date()
				: new Date();
			const { year: isoYear, week: isoWeek } = this.dateService.getISOWeek(targetDate);


		const weeklyFilePath = await this.resolveWeeklyFilePath(
			journalPath,
			isoYear,
			isoWeek,
			context.vaultRoot
		);
		const content = await this.loadOrCreateWeeklyContent(
			context,
			weeklyFilePath,
			isoYear,
			isoWeek,
			context.journalTemplateName
		);			const heading = `## ${targetDate.getDate()} ${targetDate.toLocaleDateString("en-US", { weekday: "long" })}`;
			const lines = content.split(/\r?\n/);
			const headingIndex = lines.findIndex((l) => l.trim() === heading);

			const timePrefix = this.dateService.formatTime(new Date());

			// Clean up the entry content
			let entryToInsert = this.cleanEntryContent(params.entryContent);

			if (headingIndex >= 0) {
				// Heading exists: Insert after the last line of this section
				let insertIndex = headingIndex + 1;

				// Skip the blank line after the heading (if present)
				if (insertIndex < lines.length && !lines[insertIndex].trim()) {
					insertIndex++;
				}

				// Find the end of this day's section
				let sectionEndIndex = insertIndex;
				while (
					sectionEndIndex < lines.length &&
					!DAY_SECTION_HEADER_REGEX.test(lines[sectionEndIndex])
				) {
					sectionEndIndex++;
				}

				// Insert the new entry at the end of this section
				lines.splice(sectionEndIndex, 0, `- ${timePrefix} - ${entryToInsert}`);
			} else {
				// Heading not found: find correct insertion point
				const targetDay = targetDate.getDate();
				let insertBeforeIndex = -1;

				for (let i = 0; i < lines.length; i++) {
					const match = DAY_SECTION_HEADER_WITH_CAPTURE_REGEX.exec(lines[i]);
					if (match) {
						const dayNum = parseInt(match[1]);
						if (dayNum > targetDay) {
							insertBeforeIndex = i;
							break;
						}
					}
				}

				if (insertBeforeIndex >= 0) {
					// Insert before found heading
					if (insertBeforeIndex > 0 && lines[insertBeforeIndex - 1].trim()) {
						lines.splice(insertBeforeIndex, 0, "");
						insertBeforeIndex++;
					}
					lines.splice(insertBeforeIndex, 0, heading, "", `- ${timePrefix} - ${entryToInsert}`);
				} else {
					// Append at end
					if (lines.length > 0 && lines[lines.length - 1].trim()) {
						lines.push("");
					}
					lines.push(heading, "", `- ${timePrefix} - ${entryToInsert}`);
				}
			}

			const updatedContent = lines.join(EOL);
			const formattedContent = await this.formatMarkdownContent(updatedContent);
			await this.writeJournalContent(weeklyFilePath, formattedContent);

			const relativePath = path.relative(context.vaultRoot, weeklyFilePath);
			return {
				success: true,
				message: `Added entry to ${relativePath} under '${heading}'.`,
				data: { filePath: relativePath, heading },
			};
		} catch (err) {
			return {
				success: false,
				message: `Error adding journal entry: ${err}`,
				error: String(err),
			};
		}
	}

	/**
	 * Cleans entry content by removing leading dashes and timestamps.
	 * 
	 * @param content - Raw entry content from user
	 * @returns Cleaned content ready for insertion
	 * 
	 * @remarks
	 * Removes:
	 * - Leading dashes ("- " or "-")
	 * - Leading timestamps ("HH:mm - ")
	 */
	private cleanEntryContent(content: string): string {
		let cleaned = content.trimEnd();

		// Strip leading dash
		if (cleaned.startsWith("- ")) {
			cleaned = cleaned.substring(2);
		} else if (cleaned.startsWith("-")) {
			cleaned = cleaned.substring(1).trimStart();
		}

		// Strip leading timestamp pattern (HH:mm - )
		const timestampPattern = /^\d{1,2}:\d{2}\s*-\s*/;
		if (timestampPattern.test(cleaned)) {
			cleaned = cleaned.replace(timestampPattern, "");
		}

		return cleaned;
	}

	/**
	 * Resolves the file path for a weekly journal file.
	 * Checks common locations and returns path for creation if not found.
	 */
	private async resolveWeeklyFilePath(
		journalPath: string,
		isoYear: number,
		isoWeek: number,
		workspaceRoot: string
	): Promise<string> {
		const weeklyFileName = `${isoYear}-W${isoWeek.toString().padStart(2, "0")}.md`;

		const candidatePaths = [
			path.join(workspaceRoot, journalPath, isoYear.toString(), weeklyFileName),
			path.join(workspaceRoot, journalPath, weeklyFileName),
		];

		for (const filePath of candidatePaths) {
			try {
				await fs.access(filePath);
				return filePath;
			} catch {
				// Continue to next candidate
			}
		}

		return path.join(workspaceRoot, journalPath, isoYear.toString(), weeklyFileName);
	}

	/**
	 * Loads weekly journal content or creates new content from template.
	 */
	private async loadOrCreateWeeklyContent(
		context: IToolContext,
		weeklyFilePath: string,
		isoYear: number,
		isoWeek: number,
		templateName: string
	): Promise<string> {
		try {
			return await fs.readFile(weeklyFilePath, "utf-8");
		} catch {
			const templated = await this.renderWeeklyTemplate(context, isoYear, isoWeek, templateName);
			if (templated) {
				return templated;
			}
			return this.createWeeklyStub(isoYear, isoWeek);
		}
	}

	/**
	 * Renders a weekly journal template with date information.
	 */
	private async renderWeeklyTemplate(
		context: IToolContext,
		isoYear: number,
		isoWeek: number,
		templateName: string
	): Promise<string | null> {
		try {
			const monday = this.dateService.getMonday(isoYear, isoWeek);
			const days = Array.from({ length: 7 }, (_, index) => {
				const date = new Date(monday);
			date.setDate(monday.getDate() + index);
			return {
				dayNumber: date.getDate(),
				dayName: date.toLocaleDateString("en-US", { weekday: "long" }),
				isoDate: this.dateService.formatDate(date),
			};
		});

		return await this.templateService.renderTemplate(
			templateName,
			context.vaultRoot,
			context.templatesFolderName,
			{
				year: isoYear,
				weekNumber: isoWeek,
				days,
			}
		);
	} catch {
		return null;
	}
}	/**
	 * Creates a basic weekly journal stub with day headings.
	 */
	private createWeeklyStub(isoYear: number, isoWeek: number): string {
		const monday = this.dateService.getMonday(isoYear, isoWeek);
		const lines: string[] = [];

		lines.push(`# Week ${isoWeek} in ${isoYear}`);
		lines.push("");

		for (let i = 0; i < 7; i++) {
			const day = new Date(monday);
			day.setDate(day.getDate() + i);
			lines.push(`## ${day.getDate()} ${day.toLocaleDateString("en-US", { weekday: "long" })}`);
			lines.push("");
		}

		return lines.join(EOL);
	}

	/**
	 * Writes journal content to file, creating directories as needed.
	 */
	private async writeJournalContent(filePath: string, content: string): Promise<void> {
		await fs.mkdir(path.dirname(filePath), { recursive: true });
		await fs.writeFile(filePath, content, "utf-8");
	}

	/**
	 * Formats markdown content using markdownlint.
	 * Placeholder for now - will need to be extracted similarly.
	 */
	// TODO: Extract markdown formatting logic to core layer
	// Prompt: "Create a MarkdownFormatterService with formatContent(content: string): Promise<string>
	// that applies markdownlint rules (no-blank-lines-in-lists, etc.). Inject as dependency in
	// JournalToolCore constructor. Update formatMarkdownContent to use the injected service.
	// Move markdownlint rules from src/tools/markdownlint-rules/ to src/services/markdownlint-rules/."
	private async formatMarkdownContent(content: string): Promise<string> {
		try {
			// Dynamically import markdownlint modules and custom rule
			const [{ lint }, { applyFixes }, customRuleModule] = await Promise.all([
				import("markdownlint/async"),
				import("markdownlint"),
				import("../../tools/markdownlint-rules/no-blank-lines-in-lists.js"),
			]);

			const noBlankLinesInLists = customRuleModule.noBlankLinesInLists;

			const options = {
				strings: {
					content: content,
				},
				customRules: [noBlankLinesInLists],
				config: {
					// Disable all rules by default
					default: false,
					// Enable only spacing-related rules
					MD012: true, // no-multiple-blanks: No multiple consecutive blank lines
					MD022: { lines_above: 1, lines_below: 1 }, // blanks-around-headings: One blank line before/after headings
					// MD032 is disabled because it adds blank lines around lists, conflicting with our custom rule
					MD047: true, // single-trailing-newline: Files should end with a single newline
					// Enable custom rule
					"no-blank-lines-in-lists": true,
				},
			};

			return new Promise((resolve) => {
				lint(options, (err: unknown, results?: any) => {
					if (err || !results) {
						console.error("Error linting markdown:", err);
						resolve(content);
						return;
					}

					const errors = results.content || [];

					if (errors.length > 0) {
						// Apply all fixes
						const fixed = applyFixes(content, errors);
						resolve(fixed);
					} else {
						resolve(content);
					}
				});
			});
		} catch (err) {
			// If import or linting fails, return original content
			console.error("Error formatting markdown:", err);
			return content;
		}
	}

	/**
	 * Reads journal entries within a date range.
	 * 
	 * @param context - Tool execution context
	 * @param params - Read parameters with optional date range and filtering
	 * @returns Result with journal entries or error
	 */
	async readEntries(
		context: IToolContext,
		params: IReadJournalEntriesParameters
	): Promise<IToolResult> {
		const journalPath = params.journalPath || context.journalPath;
		const maxEntries = params.maxEntries || 10;
		const includeContent = params.includeContent !== false;

		const fullJournalPath = path.join(context.vaultRoot, journalPath);

		try {
			// Check if directory exists
			try {
				await fs.access(fullJournalPath);
			} catch {
				return {
					success: true,
					message: "No journal entries found.",
				};
			}

			const fromDate = params.fromDate
				? this.dateService.parseLocalDate(params.fromDate) || undefined
				: undefined;
			const toDate = params.toDate
				? this.dateService.parseLocalDate(params.toDate) || undefined
				: undefined;

			// Enumerate all markdown files in the journal directory
			const entries: Array<{ relPath: string; date: Date }> = [];

			const enumerateMarkdownFiles = async (dir: string): Promise<void> => {
				const items = await fs.readdir(dir, { withFileTypes: true });
				for (const item of items) {
					const fullPath = path.join(dir, item.name);
					if (item.isDirectory()) {
						await enumerateMarkdownFiles(fullPath);
					} else if (item.isFile() && item.name.toLowerCase().endsWith(".md")) {
						const relativePath = path.relative(fullJournalPath, fullPath);
						const stat = await fs.stat(fullPath);
						const extractedDate = this.dateService.extractDateFromPath(relativePath);
						const date = extractedDate || stat.mtime;
						entries.push({ relPath: relativePath, date });
					}
				}
			};

			await enumerateMarkdownFiles(fullJournalPath);

			const filteredEntries = entries
				.filter((e) => this.dateService.isDateInRange(e.date, fromDate, toDate))
				.sort((a, b) => b.date.getTime() - a.date.getTime())
				.slice(0, Math.max(1, maxEntries));

			if (filteredEntries.length === 0) {
				return {
					success: true,
					message: "No journal entries found.",
				};
			}

			if (!includeContent) {
				const list = filteredEntries.map((e) => {
					const dateStr = e.date.toISOString().split("T")[0];
					return `${dateStr} | ${e.relPath}`;
				});
				return {
					success: true,
					message: list.join("\n"),
				};
			}

			const result: string[] = [];
			for (let i = 0; i < filteredEntries.length; i++) {
				const entry = filteredEntries[i];
				try {
					const filePath = path.join(fullJournalPath, entry.relPath);
					const content = await fs.readFile(filePath, "utf-8");
					if (i > 0) {
						result.push("\n---\n");
					}
					result.push(`Date: ${entry.date.toISOString().split("T")[0]}`);
					result.push(`File: ${entry.relPath}`);
					result.push("");
					result.push(content);
				} catch (err) {
					result.push(`<Error reading file: ${err}>`);
				}
			}

			return {
				success: true,
				message: result.join("\n"),
			};
		} catch (err) {
			return {
				success: false,
				message: `Error reading journal entries: ${err}`,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	/**
	 * Adds a task to the weekly journal's tasks section.
	 * 
	 * @param context - Tool execution context
	 * @param params - Task parameters including description and optional date
	 * @returns Result indicating success or failure
	 */
	async addTask(
		context: IToolContext,
		params: IAddJournalTaskParameters
	): Promise<IToolResult> {
		if (!params.taskDescription || !params.taskDescription.trim()) {
			return {
				success: false,
				message: "No task description provided.",
				error: "Task description is required",
			};
		}

		const journalPath = params.journalPath || context.journalPath;
		const tasksHeading = context.tasksHeading;

		try {
			const targetDate = params.date
				? this.dateService.parseLocalDate(params.date) || new Date()
				: new Date();
			const { year: isoYear, week: isoWeek } = this.dateService.getISOWeek(targetDate);

			const weeklyFilePath = await this.resolveWeeklyFilePath(
				journalPath,
				isoYear,
				isoWeek,
				context.vaultRoot
			);
			const content = await this.loadOrCreateWeeklyContent(
				context,
				weeklyFilePath,
				isoYear,
				isoWeek,
				context.journalTemplateName
			);

			const lines = content.split(/\r?\n/);
			const tasksIndex = lines.findIndex((l) => l.trim() === tasksHeading);

			const checkbox = params.completed ? "[x]" : "[ ]";

			// Handle parent task scenario
			if (params.parentTask) {
				if (tasksIndex < 0) {
					return {
						success: false,
						message: "No tasks section found to add child task.",
						error: "Tasks section not found",
					};
				}

				// Find the parent task
				const tasksSection = this.findTasksSection(content, tasksHeading);
				if (!tasksSection) {
					return {
						success: false,
						message: "No tasks section found to add child task.",
						error: "Tasks section not found",
					};
				}

				const tasksContent = lines
					.slice(tasksSection.startIndex, tasksSection.endIndex)
					.join("\n");
				const tasks = this.parseTasksFromContent(tasksContent);
				const parentTask = this.findTaskByDescription(tasks, params.parentTask);

				if (!parentTask) {
					return {
						success: false,
						message: `Parent task not found: "${params.parentTask}".`,
						error: "Parent task not found",
					};
				}

				// Add child task after the parent (with proper indentation)
				const parentLineIndex = tasksSection.startIndex + parentTask.lineIndex;
				const childTaskLine = `  - ${checkbox} ${params.taskDescription.trim()}`;

				// Find where to insert child (after parent and any existing children)
				let insertIndex = parentLineIndex + 1;
				while (
					insertIndex < tasksSection.endIndex &&
					lines[insertIndex].match(/^\s{2,}- \[[x ]\]/)
				) {
					insertIndex++;
				}

				lines.splice(insertIndex, 0, childTaskLine);
			} else {
				// Handle standalone task or parent with children
				const taskLine = `- ${checkbox} ${params.taskDescription.trim()}`;
				const childTasks = params.childTasks || [];

				const taskLines = [taskLine];
				childTasks.forEach((childTask) => {
					taskLines.push(`  - [ ] ${childTask.trim()}`);
				});

				if (tasksIndex >= 0) {
					// Tasks section exists: find where to insert the new task
					let insertIndex = tasksIndex + 1;

					// Skip the blank line after the heading (if present)
					if (insertIndex < lines.length && !lines[insertIndex].trim()) {
						insertIndex++;
					}

					// Insert all task lines (parent + children)
					lines.splice(insertIndex, 0, ...taskLines);
				} else {
					// Tasks section doesn't exist: create it after the title
					this.insertNewSection(lines, tasksHeading, taskLines[0]);

					// Add child tasks if any
					if (childTasks.length > 0) {
						const newTasksIndex = lines.findIndex((l) => l.trim() === tasksHeading);
						let insertIndex = newTasksIndex + 1;

						// Skip blank line after heading
						if (insertIndex < lines.length && !lines[insertIndex].trim()) {
							insertIndex++;
						}

						// Skip the parent task we just added
						if (
							insertIndex < lines.length &&
							lines[insertIndex].includes(params.taskDescription)
						) {
							insertIndex++;
						}

						// Add child tasks
						lines.splice(insertIndex, 0, ...taskLines.slice(1));
					}
				}
			}

			const updatedContent = lines.join(EOL);
			const formattedContent = await this.formatMarkdownContent(updatedContent);
			await this.writeJournalContent(weeklyFilePath, formattedContent);

			const relativePath = path.relative(context.vaultRoot, weeklyFilePath);

			let message = `Added task to ${relativePath} under '${tasksHeading}'.`;
			if (params.parentTask) {
				message = `Added child task to "${params.parentTask}" in ${relativePath}.`;
			} else if (params.childTasks && params.childTasks.length > 0) {
				message = `Added parent task with ${params.childTasks.length} child tasks to ${relativePath}.`;
			}

			return {
				success: true,
				message,
			};
		} catch (err) {
			return {
				success: false,
				message: `Error adding journal task: ${err}`,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	/**
	 * Marks a task as completed in the weekly journal.
	 * 
	 * @param context - Tool execution context
	 * @param params - Task completion parameters with description to match
	 * @returns Result indicating success or failure
	 */
	async completeTask(
		context: IToolContext,
		params: ICompleteJournalTaskParameters
	): Promise<IToolResult> {
		if (!params.taskDescription || !params.taskDescription.trim()) {
			return {
				success: false,
				message: "No task description provided.",
				error: "Task description is required",
			};
		}

		const journalPath = params.journalPath || context.journalPath;
		const tasksHeading = context.tasksHeading;

		try {
			const targetDate = params.date
				? this.dateService.parseLocalDate(params.date) || new Date()
				: new Date();
			const { year: isoYear, week: isoWeek } = this.dateService.getISOWeek(targetDate);

			const weeklyFilePath = await this.resolveWeeklyFilePath(
				journalPath,
				isoYear,
				isoWeek,
				context.vaultRoot
			);

			// Check if file exists
			try {
				await fs.access(weeklyFilePath);
			} catch {
				return {
					success: false,
					message: "Journal file not found. No tasks to complete.",
					error: "File not found",
				};
			}

			const content = await fs.readFile(weeklyFilePath, "utf-8");
			const tasksSection = this.findTasksSection(content, tasksHeading);

			if (!tasksSection) {
				return {
					success: false,
					message: "No tasks section found in journal file.",
					error: "Tasks section not found",
				};
			}

			const lines = content.split(/\r?\n/);
			const tasksContent = lines.slice(tasksSection.startIndex, tasksSection.endIndex).join("\n");
			const tasks = this.parseTasksFromContent(tasksContent);
			const task = this.findTaskByDescription(tasks, params.taskDescription);

			if (!task) {
				return {
					success: false,
					message: `Task not found: "${params.taskDescription}".`,
					error: "Task not found",
				};
			}

			if (task.completed) {
				return {
					success: true,
					message: `Task already completed: "${task.description}".`,
				};
			}

			// Update the task line to mark as completed
			const lineIndex = tasksSection.startIndex + task.lineIndex;
			const updatedLine = lines[lineIndex].replace(/- \[ \]/, "- [x]");
			lines[lineIndex] = updatedLine;

			const updatedContent = lines.join(EOL);
			const formattedContent = await this.formatMarkdownContent(updatedContent);
			await this.writeJournalContent(weeklyFilePath, formattedContent);

			const relativePath = path.relative(context.vaultRoot, weeklyFilePath);

			return {
				success: true,
				message: `Task "${task.description}" marked as completed in ${relativePath}.`,
			};
		} catch (err) {
			return {
				success: false,
				message: `Error completing journal task: ${err}`,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	/**
	 * Reads tasks from the weekly journal.
	 * 
	 * @param context - Tool execution context
	 * @param params - Read parameters with optional filters
	 * @returns Result with formatted task list or error
	 */
	async readTasks(
		context: IToolContext,
		params: IReadJournalTasksParameters
	): Promise<IToolResult> {
		const journalPath = params.journalPath || context.journalPath;
		const tasksHeading = context.tasksHeading;
		const showCompleted = params.showCompleted !== false;
		const showIncomplete = params.showIncomplete !== false;

		try {
			const targetDate = params.date
				? this.dateService.parseLocalDate(params.date) || new Date()
				: new Date();
			const { year: isoYear, week: isoWeek } = this.dateService.getISOWeek(targetDate);

			const weeklyFilePath = await this.resolveWeeklyFilePath(
				journalPath,
				isoYear,
				isoWeek,
				context.vaultRoot
			);

			// Check if file exists
			try {
				await fs.access(weeklyFilePath);
			} catch {
				return {
					success: true,
					message: "No journal file found for this week. No tasks.",
				};
			}

			const content = await fs.readFile(weeklyFilePath, "utf-8");
			const tasksSection = this.findTasksSection(content, tasksHeading);

			if (!tasksSection) {
				return {
					success: true,
					message: "No tasks found for this week.",
				};
			}

			const lines = content.split(/\r?\n/);
			const tasksContent = lines.slice(tasksSection.startIndex, tasksSection.endIndex).join("\n");
			const tasks = this.parseTasksFromContent(tasksContent);

			const formatted = this.formatTasksForDisplay(tasks, showCompleted, showIncomplete);

			if (!formatted) {
				return {
					success: true,
					message: "No tasks found matching the criteria.",
				};
			}

			return {
				success: true,
				message: formatted,
			};
		} catch (err) {
			return {
				success: false,
				message: `Error reading journal tasks: ${err}`,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	/**
	 * Parses task lines from content and extracts task information.
	 */
	private parseTasksFromContent(content: string): ParsedTask[] {
		const lines = content.split(/\r?\n/);
		const tasks: ParsedTask[] = [];

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const taskMatch = line.match(/^(\s*)- \[([ x])\] (.+)$/);
			if (taskMatch) {
				const [, indentStr, checkbox, description] = taskMatch;
				tasks.push({
					line: line,
					description: description.trim(),
					completed: checkbox === "x",
					indent: indentStr.length,
					lineIndex: i,
				});
			}
		}

		return tasks;
	}

	/**
	 * Finds a task by partial description match.
	 */
	private findTaskByDescription(tasks: ParsedTask[], searchDescription: string): ParsedTask | undefined {
		const searchLower = searchDescription.toLowerCase().trim();

		// First try exact match
		const exactMatch = tasks.find((task) => task.description.toLowerCase() === searchLower);
		if (exactMatch) {
			return exactMatch;
		}

		// Then try partial match
		return tasks.find((task) => task.description.toLowerCase().includes(searchLower));
	}

	/**
	 * Finds the tasks section in content and returns its boundaries.
	 */
	private findTasksSection(
		content: string,
		tasksHeading: string
	): { startIndex: number; endIndex: number } | null {
		const lines = content.split(/\r?\n/);
		const tasksIndex = lines.findIndex((l) => l.trim() === tasksHeading);

		if (tasksIndex < 0) {
			return null;
		}

		// Find the end of the tasks section (next level 2 heading or end of file)
		let endIndex = lines.length;
		for (let i = tasksIndex + 1; i < lines.length; i++) {
			if (LEVEL2_HEADING_REGEX.test(lines[i])) {
				endIndex = i;
				break;
			}
		}

		return { startIndex: tasksIndex, endIndex };
	}

	/**
	 * Formats tasks with proper hierarchy and completion status for display.
	 */
	private formatTasksForDisplay(
		tasks: ParsedTask[],
		showCompleted = true,
		showIncomplete = true
	): string {
		const filteredTasks = tasks.filter((task) => {
			if (task.completed && !showCompleted) {
				return false;
			}
			if (!task.completed && !showIncomplete) {
				return false;
			}
			return true;
		});

		if (filteredTasks.length === 0) {
			return "";
		}

		const taskLines = filteredTasks.map((task) => {
			const indent = " ".repeat(task.indent);
			const checkbox = task.completed ? "[x]" : "[ ]";
			return `${indent}- ${checkbox} ${task.description}`;
		});

		// Add summary statistics
		const total = filteredTasks.length;
		const completed = filteredTasks.filter((t) => t.completed).length;
		const incomplete = total - completed;

		const summary = `Summary: ${total} total, ${completed} completed, ${incomplete} incomplete`;

		return `${summary}\n\n${taskLines.join("\n")}`;
	}

	/**
	 * Inserts a new section with a heading and initial content line.
	 */
	private insertNewSection(lines: string[], sectionHeading: string, contentLine: string): void {
		// Find the title line (first line starting with #)
		let insertIndex = -1;
		for (let i = 0; i < lines.length; i++) {
			if (TITLE_HEADING_REGEX.test(lines[i])) {
				insertIndex = i + 1;
				break;
			}
		}

		// If no title found, insert at the beginning
		if (insertIndex < 0) {
			insertIndex = 0;
		}

		// Skip any blank lines after the title
		while (insertIndex < lines.length && !lines[insertIndex].trim()) {
			insertIndex++;
		}

		// Find the next level 2 heading or end of file
		let nextSectionIndex = lines.length;
		for (let i = insertIndex; i < lines.length; i++) {
			if (LEVEL2_HEADING_REGEX.test(lines[i])) {
				nextSectionIndex = i;
				break;
			}
		}

		// Insert the new section before the next section
		const sectionLines = [sectionHeading, "", contentLine, ""];
		lines.splice(nextSectionIndex, 0, ...sectionLines);
	}
}
