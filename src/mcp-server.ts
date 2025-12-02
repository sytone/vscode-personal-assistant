#!/usr/bin/env node

/**
 * MCP (Model Context Protocol) server for Personal Assistant.
 * Exposes journal, note management, and date utility tools as MCP tools.
 *
 * @remarks
 * This server runs as a standalone process and communicates via stdio.
 * Configuration is provided through environment variables.
 *
 * Environment Variables:
 * - VAULT_ROOT: Required. Absolute path to the Obsidian vault/workspace root.
 * - JOURNAL_PATH: Optional. Path to journal folder relative to vault root (default: "1 Journal").
 * - TASKS_HEADING: Optional. Heading for tasks section (default: "## Tasks This Week").
 * - TEMPLATES_FOLDER: Optional. Templates folder name (default: "Templates").
 * - JOURNAL_TEMPLATE: Optional. Journal template name (default: "journal-weekly").
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
	JournalToolCore,
	type IAddJournalEntryParameters,
	type IReadJournalEntriesParameters,
	type IAddJournalTaskParameters,
	type ICompleteJournalTaskParameters,
	type IReadJournalTasksParameters,
} from "./core/tools/JournalToolCore.js";
import { DateUtilityToolCore } from "./core/tools/DateUtilityToolCore.js";
import { NoteManagementToolCore } from "./core/tools/NoteManagementToolCore.js";
import { FindFilesToolCore } from "./core/tools/FindFilesToolCore.js";
import { RunInTerminalToolCore } from "./core/tools/RunInTerminalToolCore.js";
import type {
	ICalculateRelativeDateParameters,
	IGetDateInfoParameters,
	IGetWeekDatesParameters,
} from "./core/types/DateParameters.js";
import type {
	IListFilesParameters,
	ISearchFilesByNameParameters,
	ISearchFilesByContentParameters,
	ISearchNotesByFrontmatterParameters,
	IReadNoteParameters,
	ICreateNoteParameters,
	IUpdateNoteParameters,
	IUpdateNoteFrontmatterParameters,
	IDeleteNoteParameters,
} from "./core/types/NoteParameters.js";
import type { IFindFilesParameters } from "./core/types/FindFilesParameters.js";
import type { IRunInTerminalParameters } from "./core/types/RunInTerminalParameters.js";
import type { IToolContext } from "./core/types/ToolContext.js";
import { dateService } from "./services/DateService.js";
import { templateService } from "./services/TemplateService.js";

/**
 * Gets tool context from environment variables.
 * @throws Error if required environment variables are missing
 */
function getContextFromEnv(): IToolContext {
	const vaultRoot = process.env.VAULT_ROOT;
	if (!vaultRoot) {
		throw new Error(
			"VAULT_ROOT environment variable is required. Set it to the absolute path of your Obsidian vault."
		);
	}

	return {
		vaultRoot,
		journalPath: process.env.JOURNAL_PATH || "1 Journal",
		tasksHeading: process.env.TASKS_HEADING || "## Tasks This Week",
		templatesFolderName: process.env.TEMPLATES_FOLDER || "Templates",
		journalTemplateName: process.env.JOURNAL_TEMPLATE || "journal-weekly",
	};
}

/**
 * Main server setup and initialization.
 */
async function main() {
	// Initialize core tools with services
	const journalTool = new JournalToolCore(dateService, templateService);
	const dateUtilityTool = new DateUtilityToolCore(dateService);
	const noteManagementTool = new NoteManagementToolCore(templateService);
	const findFilesTool = new FindFilesToolCore();
	const runInTerminalTool = new RunInTerminalToolCore();
	let context: IToolContext;

	try {
		context = getContextFromEnv();
		console.error(`Personal Assistant MCP Server initialized`);
		console.error(`Vault Root: ${context.vaultRoot}`);
		console.error(`Journal Path: ${context.journalPath}`);
	} catch (err) {
		console.error(`Configuration Error: ${err instanceof Error ? err.message : String(err)}`);
		process.exit(1);
	}

	// Create MCP server
	const server = new Server(
		{
			name: "personal-assistant-mcp",
			version: "1.0.0",
		},
		{
			capabilities: {
				tools: {},
			},
		}
	);

	// Register tool list handler
	server.setRequestHandler(ListToolsRequestSchema, async () => {
		return {
			tools: [
				{
					name: "addJournalEntry",
					description:
						"Add an entry to the weekly journal file for a given date (defaults to today). Creates timestamped entries in ISO week-formatted journal files (YYYY-Www.md).",
					inputSchema: {
						type: "object",
						properties: {
							entryContent: {
								type: "string",
								description: "The content of the journal entry.",
							},
							journalPath: {
								type: "string",
								description:
									"Optional path to journal folder relative to vault root. Defaults to configured journal path.",
							},
							date: {
								type: "string",
								description:
									"Target date in YYYY-MM-DD format. Optional; defaults to today.",
							},
						},
						required: ["entryContent"],
					},
				},
				{
					name: "readJournalEntries",
					description:
						"Read journal entries from the vault within an optional date range. Returns the most recent entries up to the specified maximum.",
					inputSchema: {
						type: "object",
						properties: {
							journalPath: {
								type: "string",
								description:
									"Optional path to journal folder relative to vault root.",
							},
							fromDate: {
								type: "string",
								description: "Start date in YYYY-MM-DD format (inclusive).",
							},
							toDate: {
								type: "string",
								description: "End date in YYYY-MM-DD format (inclusive).",
							},
							maxEntries: {
								type: "number",
								description: "Maximum number of entries to return. Default: 10",
							},
							includeContent: {
								type: "boolean",
								description: "Whether to include full content. Default: true",
							},
						},
						required: [],
					},
				},
				{
					name: "addJournalTask",
					description:
						"Add a task to the weekly journal's tasks section. Supports parent/child task relationships.",
					inputSchema: {
						type: "object",
						properties: {
							taskDescription: {
								type: "string",
								description: "Description of the task to add.",
							},
							journalPath: {
								type: "string",
								description:
									"Optional path to journal folder relative to vault root.",
							},
							date: {
								type: "string",
								description:
									"Target date in YYYY-MM-DD format to determine which week. Default: today",
							},
							completed: {
								type: "boolean",
								description: "Whether the task should be marked as completed. Default: false",
							},
							parentTask: {
								type: "string",
								description: "Description of parent task to add this as a child.",
							},
							childTasks: {
								type: "array",
								items: { type: "string" },
								description: "Array of child task descriptions.",
							},
						},
						required: ["taskDescription"],
					},
				},
				{
					name: "completeJournalTask",
					description:
						"Mark a task as completed in the weekly journal by matching its description.",
					inputSchema: {
						type: "object",
						properties: {
							taskDescription: {
								type: "string",
								description: "Description of the task to complete (supports partial matching).",
							},
							journalPath: {
								type: "string",
								description:
									"Optional path to journal folder relative to vault root.",
							},
							date: {
								type: "string",
								description:
									"Target date in YYYY-MM-DD format to determine which week. Default: today",
							},
						},
						required: ["taskDescription"],
					},
				},
				{
					name: "readJournalTasks",
					description:
						"Read tasks from the weekly journal. Can filter by completion status.",
					inputSchema: {
						type: "object",
						properties: {
							journalPath: {
								type: "string",
								description:
									"Optional path to journal folder relative to vault root.",
							},
							date: {
								type: "string",
								description:
									"Target date in YYYY-MM-DD format to determine which week. Default: today",
							},
							showCompleted: {
								type: "boolean",
								description: "Whether to include completed tasks. Default: true",
							},
							showIncomplete: {
								type: "boolean",
								description: "Whether to include incomplete tasks. Default: true",
							},
					},
					required: [],
				},
			},
			{
				name: "calculateRelativeDate",
				description:
					"Calculate a date based on a natural language relative description (e.g., 'yesterday', 'next Monday', '2 days ago').",
				inputSchema: {
					type: "object",
					properties: {
						relativeDateDescription: {
							type: "string",
							description:
								"Natural language description of the relative date.",
						},
						referenceDate: {
							type: "string",
							description:
								"Optional reference date in YYYY-MM-DD format. Defaults to today.",
						},
					},
					required: ["relativeDateDescription"],
				},
			},
			{
				name: "getDateInfo",
				description:
					"Get detailed information about a specific date including day of week, ISO week number, and relative description.",
				inputSchema: {
					type: "object",
					properties: {
						date: {
							type: "string",
							description: "Date in YYYY-MM-DD format.",
						},
					},
					required: ["date"],
				},
			},
			{
				name: "getWeekDates",
				description:
					"Get all dates (Monday through Sunday) in the ISO week containing the specified date.",
				inputSchema: {
					type: "object",
					properties: {
						date: {
							type: "string",
							description:
								"Optional date in YYYY-MM-DD format. Defaults to current week.",
						},
					},
					required: [],
				},
			},
		{
			name: "listFiles",
			description:
				"List all markdown files in the vault with optional folder filtering and content previews.",
			inputSchema: {
				type: "object",
				properties: {
					includeFolder: {
						type: "string",
						description: "Optional folder path to list files from (relative to vault root).",
					},
					generatePreviews: {
						type: "boolean",
						description: "Whether to generate content previews. Default: false",
					},
				},
				required: [],
			},
		},
		{
			name: "searchFilesByName",
			description:
				"Search for markdown files by name pattern (case-insensitive partial match).",
			inputSchema: {
				type: "object",
				properties: {
					searchPattern: {
						type: "string",
						description: "Search pattern to match against file names.",
					},
				},
				required: ["searchPattern"],
			},
		},
		{
			name: "searchFilesByContent",
			description:
				"Search for markdown files containing specific text in their content.",
			inputSchema: {
				type: "object",
				properties: {
					searchText: {
						type: "string",
						description: "Text to search for in file contents.",
					},
					caseSensitive: {
						type: "boolean",
						description: "Whether search should be case-sensitive. Default: false",
					},
				},
				required: ["searchText"],
			},
		},
		{
			name: "searchNotesByFrontmatter",
			description:
				"Search for notes by frontmatter metadata (YAML at top of file).",
			inputSchema: {
				type: "object",
				properties: {
					key: {
						type: "string",
						description: "Frontmatter key to search for.",
					},
					value: {
						type: "string",
						description: "Optional value to match. If not provided, matches any note with the key.",
					},
				},
				required: ["key"],
			},
		},
		{
			name: "readNote",
			description:
				"Read the complete contents of a note including frontmatter and body.",
			inputSchema: {
				type: "object",
				properties: {
					notePath: {
						type: "string",
						description: "Path to the note file (relative to vault root).",
					},
				},
				required: ["notePath"],
			},
		},
		{
			name: "createNote",
			description:
				"Create a new note with optional frontmatter and content. Can use templates.",
			inputSchema: {
				type: "object",
				properties: {
					notePath: {
						type: "string",
						description: "Path for the new note (relative to vault root).",
					},
					content: {
						type: "string",
						description: "Note content (markdown).",
					},
					frontmatter: {
						type: "object",
						description: "Optional frontmatter metadata as key-value pairs.",
					},
					templateName: {
						type: "string",
						description: "Optional template name to use.",
					},
					templateData: {
						type: "object",
						description: "Optional data for template rendering.",
					},
				},
				required: ["notePath"],
			},
		},
		{
			name: "updateNote",
			description:
				"Update the content of an existing note while preserving frontmatter.",
			inputSchema: {
				type: "object",
				properties: {
					notePath: {
						type: "string",
						description: "Path to the note file (relative to vault root).",
					},
					content: {
						type: "string",
						description: "New content for the note.",
					},
				},
				required: ["notePath", "content"],
			},
		},
		{
			name: "updateNoteFrontmatter",
			description:
				"Update or delete frontmatter fields in a note.",
			inputSchema: {
				type: "object",
				properties: {
					notePath: {
						type: "string",
						description: "Path to the note file (relative to vault root).",
					},
					operations: {
						type: "array",
						description: "Array of operations to perform (set or delete).",
						items: {
							type: "object",
							properties: {
								operation: {
									type: "string",
									enum: ["set", "delete"],
									description: "Operation type: 'set' to add/update, 'delete' to remove.",
								},
								key: {
									type: "string",
									description: "Frontmatter key to operate on.",
								},
								value: {
									description: "Value to set (required for 'set' operation).",
								},
							},
							required: ["operation", "key"],
						},
					},
				},
				required: ["notePath", "operations"],
			},
		},
		{
			name: "deleteNote",
			description:
				"Delete a note file from the vault.",
			inputSchema: {
				type: "object",
				properties: {
					notePath: {
						type: "string",
						description: "Path to the note file to delete (relative to vault root).",
					},
				},
				required: ["notePath"],
			},
		},
		{
			name: "findFiles",
			description:
				"Find files in the vault using glob patterns. Supports wildcards and patterns.",
			inputSchema: {
				type: "object",
				properties: {
					pattern: {
						type: "string",
						description: "Glob pattern to search for files (e.g., `**\\/*.md`, `src/**\\/*.ts`).",
					},
				},
				required: ["pattern"],
			},
		},
		{
			name: "runInTerminal",
			description:
				"Execute a shell command in the vault root directory. Returns command output.",
			inputSchema: {
				type: "object",
				properties: {
					command: {
						type: "string",
						description: "Shell command to execute.",
					},
				},
				required: ["command"],
			},
		},
		],
	};
});	// Register tool call handler
	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const { name, arguments: args } = request.params;

		try {
			let result;

			switch (name) {
				case "addJournalEntry":
					result = await journalTool.addEntry(
						context,
						args as unknown as IAddJournalEntryParameters
					);
					break;

				case "readJournalEntries":
					result = await journalTool.readEntries(
						context,
						args as unknown as IReadJournalEntriesParameters
					);
					break;

				case "addJournalTask":
					result = await journalTool.addTask(
						context,
						args as unknown as IAddJournalTaskParameters
					);
					break;

				case "completeJournalTask":
					result = await journalTool.completeTask(
						context,
						args as unknown as ICompleteJournalTaskParameters
					);
					break;

			case "readJournalTasks":
				result = await journalTool.readTasks(
					context,
					args as unknown as IReadJournalTasksParameters
				);
				break;

			case "calculateRelativeDate":
				result = await dateUtilityTool.calculateRelativeDate(
					args as unknown as ICalculateRelativeDateParameters
				);
				break;

			case "getDateInfo":
				result = await dateUtilityTool.getDateInfo(
					args as unknown as IGetDateInfoParameters
				);
				break;

			case "getWeekDates":
				result = await dateUtilityTool.getWeekDates(
					args as unknown as IGetWeekDatesParameters
				);
				break;

			case "listFiles":
				result = await noteManagementTool.listFiles(
					context,
					args as unknown as IListFilesParameters
				);
				break;

			case "searchFilesByName":
				result = await noteManagementTool.searchFilesByName(
					context,
					args as unknown as ISearchFilesByNameParameters
				);
				break;

			case "searchFilesByContent":
				result = await noteManagementTool.searchFilesByContent(
					context,
					args as unknown as ISearchFilesByContentParameters
				);
				break;

			case "searchNotesByFrontmatter":
				result = await noteManagementTool.searchNotesByFrontmatter(
					context,
					args as unknown as ISearchNotesByFrontmatterParameters
				);
				break;

			case "readNote":
				result = await noteManagementTool.readNote(
					context,
					args as unknown as IReadNoteParameters
				);
				break;

			case "createNote":
				result = await noteManagementTool.createNote(
					context,
					args as unknown as ICreateNoteParameters
				);
				break;

			case "updateNote":
				result = await noteManagementTool.updateNote(
					context,
					args as unknown as IUpdateNoteParameters
				);
				break;

			case "updateNoteFrontmatter":
				result = await noteManagementTool.updateNoteFrontmatter(
					context,
					args as unknown as IUpdateNoteFrontmatterParameters
				);
				break;

			case "deleteNote":
				result = await noteManagementTool.deleteNote(
					context,
					args as unknown as IDeleteNoteParameters
				);
				break;

			case "findFiles":
				result = await findFilesTool.findFiles(
					context,
					args as unknown as IFindFilesParameters
				);
				break;

			case "runInTerminal":
				result = await runInTerminalTool.runInTerminal(
					context,
					args as unknown as IRunInTerminalParameters
				);
				break;

			default:
				throw new Error(`Unknown tool: ${name}`);
			}			if (result.success) {
				return {
					content: [
						{
							type: "text",
							text: result.message,
						},
					],
				};
			} else {
				return {
					content: [
						{
							type: "text",
							text: `Error: ${result.error || result.message}`,
						},
					],
					isError: true,
				};
			}
		} catch (err) {
			return {
				content: [
					{
						type: "text",
						text: `Error executing tool: ${err instanceof Error ? err.message : String(err)}`,
					},
				],
				isError: true,
			};
		}
	});

	// Connect to stdio transport
	const transport = new StdioServerTransport();
	await server.connect(transport);

	console.error("Personal Assistant MCP Server running on stdio");
}

// Start the server
main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
