/**
 * Platform-agnostic core implementation for note management operations.
 * This class contains all business logic for CRUD operations on markdown notes,
 * including file system operations, content parsing, and frontmatter management.
 *
 * All methods return IToolResult for consistent error handling across platforms.
 */

import * as path from "path";
import * as fs from "fs/promises";
import type { IToolContext, IToolResult } from "../types/ToolContext";
import type { TemplateService } from "../../services/TemplateService";
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
} from "../types/NoteParameters";

// TODO: Extract markdown utilities to core layer
// Prompt: "Create a MarkdownParserService in src/services/ with the following interface:
// - parseMarkdown(content: string): Promise<{ data: Record<string, any> | null; content: string }>
// - stringifyMarkdown(content: string, frontmatter?: Record<string, any>): Promise<string>
// Move the implementation from src/tools/MarkdownUtils.ts to this new service.
// Update NoteManagementToolCore to inject MarkdownParserService as a dependency.
// This decouples markdown parsing from tool logic and makes it reusable."

/**
 * Parsed markdown structure with optional frontmatter.
 */
interface IParsedMarkdown {
	data: Record<string, any> | null;
	content: string;
}

/**
 * Helper result type for file list/search operations.
 */
interface IFileMatch {
	path: string;
	content?: string;
}

/**
 * Core implementation of note management tools.
 * Provides platform-agnostic business logic for all note operations.
 */
export class NoteManagementToolCore {
	constructor(private templateService: TemplateService) {}

	/**
	 * Lists all markdown files in the vault, optionally filtered by folder.
	 *
	 * @param context - Tool execution context with vault root and configuration
	 * @param params - List parameters (folder path, content inclusion)
	 * @returns Tool result with file list or error message
	 *
	 * @remarks
	 * - Recursively scans directories starting from vault root or specified folder
	 * - Skips system folders (.obsidian, .git, node_modules) for security and performance
	 * - Optionally includes content previews (truncated to configured length)
	 * - Returns relative paths from vault root for portability
	 */
	async listFiles(
		context: IToolContext,
		params: IListFilesParameters
	): Promise<IToolResult> {
		try {
			const files = await this.findMarkdownFiles(
				context.vaultRoot,
				params.folderPath
			);

			if (files.length === 0) {
				return {
					success: true,
					message: `No markdown files found${params.folderPath ? ` in folder "${params.folderPath}"` : ""}.`,
				};
			}

			const includeContent = params.includeContent ?? false;
			const results: string[] = [];

			for (const file of files) {
				let result = `- ${file}`;

				if (includeContent) {
					const fullPath = path.join(context.vaultRoot, file);
					const content = await fs.readFile(fullPath, "utf-8");
					const preview = this.generateContentPreview(content);
					result += `\n  ${preview}`;
				}

				results.push(result);
			}

			return {
				success: true,
				message: `Found ${files.length} markdown file(s):\n\n${results.join("\n")}`,
			};
		} catch (err) {
			return {
				success: false,
				message: `Error listing files: ${err}`,
				error: String(err),
			};
		}
	}

	/**
	 * Searches for markdown files by filename pattern (case-insensitive substring match).
	 *
	 * @param context - Tool execution context
	 * @param params - Search parameters (pattern, content inclusion)
	 * @returns Tool result with matching files or error
	 *
	 * @remarks
	 * - Performs case-insensitive substring match on basenames
	 * - Searches all markdown files in vault
	 * - Optionally includes content previews for matches
	 */
	async searchFilesByName(
		context: IToolContext,
		params: ISearchFilesByNameParameters
	): Promise<IToolResult> {
		if (!params.namePattern) {
			return {
				success: false,
				message: "Error: namePattern is required.",
				error: "Missing required parameter: namePattern",
			};
		}

		try {
			const allFiles = await this.findMarkdownFiles(context.vaultRoot);
			const pattern = params.namePattern.toLowerCase();
			const matchingFiles = allFiles.filter((file) =>
				path.basename(file).toLowerCase().includes(pattern)
			);

			if (matchingFiles.length === 0) {
				return {
					success: true,
					message: `No files found matching pattern "${params.namePattern}".`,
				};
			}

			const includeContent = params.includeContent ?? false;
			const results: string[] = [];

			for (const file of matchingFiles) {
				let result = `- ${file}`;

				if (includeContent) {
					const fullPath = path.join(context.vaultRoot, file);
					const content = await fs.readFile(fullPath, "utf-8");
					const preview = this.generateContentPreview(content);
					result += `\n  ${preview}`;
				}

				results.push(result);
			}

			return {
				success: true,
				message: `Found ${matchingFiles.length} file(s) matching "${params.namePattern}":\n\n${results.join("\n")}`,
			};
		} catch (err) {
			return {
				success: false,
				message: `Error searching files by name: ${err}`,
				error: String(err),
			};
		}
	}

	/**
	 * Searches for markdown files containing specific text (case-insensitive full-text search).
	 *
	 * @param context - Tool execution context
	 * @param params - Search parameters (search text, content inclusion)
	 * @returns Tool result with matching files or error
	 *
	 * @remarks
	 * - Reads all markdown files and searches content
	 * - Case-insensitive substring matching
	 * - Performance consideration: May be slow for large vaults
	 * - Optionally includes content previews for matches
	 */
	async searchFilesByContent(
		context: IToolContext,
		params: ISearchFilesByContentParameters
	): Promise<IToolResult> {
		if (!params.searchText) {
			return {
				success: false,
				message: "Error: searchText is required.",
				error: "Missing required parameter: searchText",
			};
		}

		try {
			const allFiles = await this.findMarkdownFiles(context.vaultRoot);
			const searchText = params.searchText.toLowerCase();
			const matchingFiles: IFileMatch[] = [];

			for (const file of allFiles) {
				const fullPath = path.join(context.vaultRoot, file);
				const content = await fs.readFile(fullPath, "utf-8");

				if (content.toLowerCase().includes(searchText)) {
					matchingFiles.push({ path: file, content });
				}
			}

			if (matchingFiles.length === 0) {
				return {
					success: true,
					message: `No files found containing "${params.searchText}".`,
				};
			}

			const includeContent = params.includeContent ?? false;
			const results: string[] = [];

			for (const match of matchingFiles) {
				let result = `- ${match.path}`;

				if (includeContent && match.content) {
					const preview = this.generateContentPreview(match.content);
					result += `\n  ${preview}`;
				}

				results.push(result);
			}

			return {
				success: true,
				message: `Found ${matchingFiles.length} file(s) containing "${params.searchText}":\n\n${results.join("\n")}`,
			};
		} catch (err) {
			return {
				success: false,
				message: `Error searching files by content: ${err}`,
				error: String(err),
			};
		}
	}

	/**
	 * Searches for notes by YAML frontmatter key/value.
	 *
	 * @param context - Tool execution context
	 * @param params - Search parameters (key, optional value, content inclusion)
	 * @returns Tool result with matching notes or error
	 *
	 * @remarks
	 * - If value is provided, performs exact match on frontmatter[key]
	 * - If value is omitted, matches any note with the key present
	 * - Parses frontmatter from all markdown files
	 * - Optionally includes content previews
	 */
	async searchNotesByFrontmatter(
		context: IToolContext,
		params: ISearchNotesByFrontmatterParameters
	): Promise<IToolResult> {
		if (!params.key) {
			return {
				success: false,
				message: "Error: key is required.",
				error: "Missing required parameter: key",
			};
		}

		try {
			const allFiles = await this.findMarkdownFiles(context.vaultRoot);
			const matchingFiles: IFileMatch[] = [];

			for (const file of allFiles) {
				const fullPath = path.join(context.vaultRoot, file);
				const fileContent = await fs.readFile(fullPath, "utf-8");
				const parsed = await this.parseMarkdown(fileContent);

				// Check if key exists
				if (parsed.data && params.key in parsed.data) {
					// If value is specified, check for exact match
					if (params.value !== undefined) {
						if (parsed.data[params.key] === params.value) {
							matchingFiles.push({ path: file, content: fileContent });
						}
					} else {
						// Just key existence check
						matchingFiles.push({ path: file, content: fileContent });
					}
				}
			}

			if (matchingFiles.length === 0) {
				const valueMsg = params.value !== undefined ? ` = "${params.value}"` : "";
				return {
					success: true,
					message: `No files found with frontmatter "${params.key}"${valueMsg}.`,
				};
			}

			const includeContent = params.includeContent ?? false;
			const results: string[] = [];

			for (const match of matchingFiles) {
				let result = `- ${match.path}`;

				if (includeContent && match.content) {
					const preview = this.generateContentPreview(match.content);
					result += `\n  ${preview}`;
				}

				results.push(result);
			}

			const valueMsg = params.value !== undefined ? ` = "${params.value}"` : "";
			return {
				success: true,
				message: `Found ${matchingFiles.length} file(s) with frontmatter "${params.key}"${valueMsg}:\n\n${results.join("\n")}`,
			};
		} catch (err) {
			return {
				success: false,
				message: `Error searching by frontmatter: ${err}`,
				error: String(err),
			};
		}
	}

	/**
	 * Reads the complete content and frontmatter of a specific note.
	 *
	 * @param context - Tool execution context
	 * @param params - Read parameters (note path)
	 * @returns Tool result with formatted note content or error
	 *
	 * @remarks
	 * - Validates path to prevent traversal attacks
	 * - Returns structured format with frontmatter (if present) and content sections
	 * - Frontmatter displayed as YAML code block
	 * - Returns error if file doesn't exist
	 */
	async readNote(
		context: IToolContext,
		params: IReadNoteParameters
	): Promise<IToolResult> {
		if (!params.notePath) {
			return {
				success: false,
				message: "Error: notePath is required.",
				error: "Missing required parameter: notePath",
			};
		}

		const resolvedPath = this.resolveNotePath(context.vaultRoot, params.notePath);
		if (!resolvedPath) {
			return {
				success: false,
				message: "Invalid note path. Path traversal is not allowed.",
				error: "Path traversal detected",
			};
		}

		try {
			const content = await fs.readFile(resolvedPath, "utf-8");
			const parsed = await this.parseMarkdown(content);

			let output = `# Note: ${params.notePath}\n\n`;

			if (parsed.data && Object.keys(parsed.data).length > 0) {
				output += "## Frontmatter\n```yaml\n";
				for (const [key, value] of Object.entries(parsed.data)) {
					output += `${key}: ${value}\n`;
				}
				output += "```\n\n";
			}

			output += "## Content\n";
			output += parsed.content;

			return {
				success: true,
				message: output,
			};
		} catch (err: any) {
			if (err.code === "ENOENT") {
				return {
					success: false,
					message: `Error: Note "${params.notePath}" not found.`,
					error: "File not found",
				};
			}
			return {
				success: false,
				message: `Error reading note: ${err}`,
				error: String(err),
			};
		}
	}

	/**
	 * Creates a new markdown note with optional frontmatter and template support.
	 *
	 * @param context - Tool execution context
	 * @param params - Create parameters (path, content, frontmatter, template)
	 * @returns Tool result with success/error message
	 *
	 * @remarks
	 * - Automatically creates parent directories (recursive)
	 * - Returns error if file already exists
	 * - Supports YAML frontmatter
	 * - Supports template rendering via templateService
	 * - Validates path to prevent traversal attacks
	 */
	async createNote(
		context: IToolContext,
		params: ICreateNoteParameters
	): Promise<IToolResult> {
		if (!params.notePath) {
			return {
				success: false,
				message: "Error: notePath is required.",
				error: "Missing required parameter: notePath",
			};
		}

		if (!params.content) {
			return {
				success: false,
				message: "Error: content is required.",
				error: "Missing required parameter: content",
			};
		}

		const resolvedPath = this.resolveNotePath(context.vaultRoot, params.notePath);
		if (!resolvedPath) {
			return {
				success: false,
				message: "Invalid note path. Path traversal is not allowed.",
				error: "Path traversal detected",
			};
		}

		try {
			// Check if file already exists
			try {
				await fs.access(resolvedPath);
				return {
					success: false,
					message: `Error: Note "${params.notePath}" already exists. Use updateNote to modify it.`,
					error: "File already exists",
				};
			} catch {
				// File doesn't exist, proceed with creation
			}

			// Create directories if needed
			await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

			// Create file content
			const templatedContent = await this.renderFromTemplate(context, params);
			let fileContent: string;
			if (templatedContent) {
				fileContent = templatedContent;
			} else if (params.frontmatter && Object.keys(params.frontmatter).length > 0) {
				fileContent = await this.stringifyMarkdown(params.content, params.frontmatter);
			} else {
				fileContent = params.content;
			}

			await fs.writeFile(resolvedPath, fileContent, "utf-8");

			return {
				success: true,
				message: `Note "${params.notePath}" created successfully.`,
			};
		} catch (err) {
			return {
				success: false,
				message: `Error creating note: ${err}`,
				error: String(err),
			};
		}
	}

	/**
	 * Updates the content of an existing note while preserving frontmatter.
	 *
	 * @param context - Tool execution context
	 * @param params - Update parameters (path, new content)
	 * @returns Tool result with success/error message
	 *
	 * @remarks
	 * - Preserves existing frontmatter automatically
	 * - Replaces markdown content only
	 * - Returns error if file doesn't exist
	 * - Validates path to prevent traversal attacks
	 */
	async updateNote(
		context: IToolContext,
		params: IUpdateNoteParameters
	): Promise<IToolResult> {
		if (!params.notePath) {
			return {
				success: false,
				message: "Error: notePath is required.",
				error: "Missing required parameter: notePath",
			};
		}

		if (!params.content) {
			return {
				success: false,
				message: "Error: content is required.",
				error: "Missing required parameter: content",
			};
		}

		const resolvedPath = this.resolveNotePath(context.vaultRoot, params.notePath);
		if (!resolvedPath) {
			return {
				success: false,
				message: "Invalid note path. Path traversal is not allowed.",
				error: "Path traversal detected",
			};
		}

		try {
			// Read existing file to preserve frontmatter
			const existingContent = await fs.readFile(resolvedPath, "utf-8");
			const parsed = await this.parseMarkdown(existingContent);

			// Create new content with preserved frontmatter
			const newContent = await this.stringifyMarkdown(params.content, parsed.data ?? undefined);
			await fs.writeFile(resolvedPath, newContent, "utf-8");

			return {
				success: true,
				message: `Note "${params.notePath}" updated successfully.`,
			};
		} catch (err: any) {
			if (err.code === "ENOENT") {
				return {
					success: false,
					message: `Error: Note "${params.notePath}" not found. Use createNote to create it.`,
					error: "File not found",
				};
			}
			return {
				success: false,
				message: `Error updating note: ${err}`,
				error: String(err),
			};
		}
	}

	/**
	 * Updates frontmatter metadata in a note with multiple atomic operations.
	 *
	 * @param context - Tool execution context
	 * @param params - Update parameters (path, operations array)
	 * @returns Tool result with success/error message
	 *
	 * @remarks
	 * - Supports 'set' (add/update) and 'delete' (remove) operations
	 * - Operations applied in order
	 * - Creates frontmatter section if none exists
	 * - Preserves markdown content
	 * - Returns error if file doesn't exist
	 */
	async updateNoteFrontmatter(
		context: IToolContext,
		params: IUpdateNoteFrontmatterParameters
	): Promise<IToolResult> {
		if (!params.notePath) {
			return {
				success: false,
				message: "Error: notePath is required.",
				error: "Missing required parameter: notePath",
			};
		}

		if (!params.operations || params.operations.length === 0) {
			return {
				success: false,
				message: "Error: operations array is required and must not be empty.",
				error: "Missing or empty operations array",
			};
		}

		const resolvedPath = this.resolveNotePath(context.vaultRoot, params.notePath);
		if (!resolvedPath) {
			return {
				success: false,
				message: "Invalid note path. Path traversal is not allowed.",
				error: "Path traversal detected",
			};
		}

		try {
			// Read existing file
			const existingContent = await fs.readFile(resolvedPath, "utf-8");
			const parsed = await this.parseMarkdown(existingContent);

			// Start with existing frontmatter or empty object
			const frontmatter = parsed.data || {};

			// Apply operations
			for (const op of params.operations) {
				if (op.action === "set") {
					if (!op.key) {
						return {
							success: false,
							message: 'Error: "key" is required for set operation.',
							error: "Missing key in set operation",
						};
					}
					frontmatter[op.key] = op.value;
				} else if (op.action === "delete") {
					if (!op.key) {
						return {
							success: false,
							message: 'Error: "key" is required for delete operation.',
							error: "Missing key in delete operation",
						};
					}
					delete frontmatter[op.key];
				}
			}

			// Write updated file
			const newContent = await this.stringifyMarkdown(parsed.content, frontmatter);
			await fs.writeFile(resolvedPath, newContent, "utf-8");

			return {
				success: true,
				message: `Frontmatter for "${params.notePath}" updated successfully.`,
			};
		} catch (err: any) {
			if (err.code === "ENOENT") {
				return {
					success: false,
					message: `Error: Note "${params.notePath}" not found.`,
					error: "File not found",
				};
			}
			return {
				success: false,
				message: `Error updating frontmatter: ${err}`,
				error: String(err),
			};
		}
	}

	/**
	 * Deletes a note from the vault.
	 *
	 * @param context - Tool execution context (must have allowNoteDeletion enabled)
	 * @param params - Delete parameters (note path)
	 * @returns Tool result with success/error message
	 *
	 * @remarks
	 * - Permanently deletes the file (no undo)
	 * - Validates path to prevent traversal attacks
	 * - Returns error if file doesn't exist
	 *
	 * @security
	 * Deletion must be explicitly enabled in configuration.
	 * The platform adapter should check the allowNoteDeletion setting.
	 */
	async deleteNote(
		context: IToolContext,
		params: IDeleteNoteParameters
	): Promise<IToolResult> {
		if (!params.notePath) {
			return {
				success: false,
				message: "Error: notePath is required.",
				error: "Missing required parameter: notePath",
			};
		}

		const resolvedPath = this.resolveNotePath(context.vaultRoot, params.notePath);
		if (!resolvedPath) {
			return {
				success: false,
				message: "Invalid note path. Path traversal is not allowed.",
				error: "Path traversal detected",
			};
		}

		try {
			await fs.unlink(resolvedPath);

			return {
				success: true,
				message: `Note "${params.notePath}" deleted successfully.`,
			};
		} catch (err: any) {
			if (err.code === "ENOENT") {
				return {
					success: false,
					message: `Error: Note "${params.notePath}" not found.`,
					error: "File not found",
				};
			}
			return {
				success: false,
				message: `Error deleting note: ${err}`,
				error: String(err),
			};
		}
	}

	// ===== PRIVATE HELPER METHODS =====

	/**
	 * Recursively finds all markdown files in a directory tree.
	 *
	 * @param rootPath - Absolute path to vault root
	 * @param folderPath - Optional relative path to search within
	 * @returns Array of relative paths to markdown files
	 *
	 * @remarks
	 * - Skips system folders (.obsidian, .git, node_modules, hidden folders)
	 * - Returns paths relative to rootPath
	 * - Normalizes path separators to forward slashes
	 */
	private async findMarkdownFiles(
		rootPath: string,
		folderPath?: string
	): Promise<string[]> {
		const results: string[] = [];
		const searchPath = folderPath ? path.join(rootPath, folderPath) : rootPath;

		try {
			const entries = await fs.readdir(searchPath, { withFileTypes: true });

			for (const entry of entries) {
				if (this.shouldSkipSystemFolder(entry.name)) {
					continue;
				}

				const fullPath = path.join(searchPath, entry.name);
				const relativePath = path.relative(rootPath, fullPath);

				if (entry.isDirectory()) {
					const subFiles = await this.findMarkdownFiles(rootPath, relativePath);
					results.push(...subFiles);
				} else if (entry.isFile() && entry.name.endsWith(".md")) {
					// Normalize path separators to forward slashes
					results.push(relativePath.replace(/\\/g, "/"));
				}
			}
		} catch (err) {
			// Ignore errors reading directories (permissions, etc.)
		}

		return results;
	}

	/**
	 * Determines if a folder should be excluded from operations.
	 *
	 * @param folderName - Name of the folder
	 * @returns True if folder should be skipped
	 *
	 * @remarks
	 * Skips: hidden folders (starting with '.'), node_modules
	 */
	private shouldSkipSystemFolder(folderName: string): boolean {
		return folderName.startsWith(".") || folderName === "node_modules";
	}

	/**
	 * Generates a truncated content preview.
	 *
	 * @param content - Full content
	 * @param maxLength - Maximum preview length (default: 200)
	 * @returns Content preview with ellipsis if truncated
	 */
	private generateContentPreview(content: string, maxLength: number = 200): string {
		if (content.length <= maxLength) {
			return content;
		}
		return content.slice(0, maxLength) + "...";
	}

	/**
	 * Validates and resolves a note path to prevent traversal attacks.
	 *
	 * @param vaultRoot - Absolute path to vault root
	 * @param notePath - Relative path to validate
	 * @returns Absolute resolved path if valid, null if traversal detected
	 *
	 * @security
	 * Critical security function. Prevents path traversal attacks like:
	 * - ../../../etc/passwd
	 * - ..\..\Windows\System32
	 */
	private resolveNotePath(vaultRoot: string, notePath: string): string | null {
		const resolved = path.resolve(vaultRoot, notePath);
		const normalized = path.normalize(resolved);

		// Prevent path traversal attacks
		if (!normalized.startsWith(vaultRoot)) {
			return null;
		}

		return normalized;
	}

	/**
	 * Renders content from a template when template metadata is provided.
	 *
	 * @param context - Tool execution context
	 * @param params - Create note parameters
	 * @returns Rendered template or null if templating unavailable
	 */
	private async renderFromTemplate(
		context: IToolContext,
		params: ICreateNoteParameters
	): Promise<string | null> {
		if (!params.templateName) {
			return null;
		}

		const templatePayload = {
			...(params.templateData ?? {}),
			content: params.content,
			notePath: params.notePath,
			frontmatter: params.frontmatter ?? {},
		};

		try {
			return await this.templateService.renderTemplate(
				params.templateName,
				context.vaultRoot,
				context.templatesFolderName,
				templatePayload
			);
		} catch {
			return null;
		}
	}

	/**
	 * Parses markdown content to extract frontmatter and content.
	 *
	 * @param content - Raw markdown content
	 * @returns Parsed structure with optional frontmatter data and content
	 *
	 * TODO: Replace with injected MarkdownParserService
	 */
	private async parseMarkdown(content: string): Promise<IParsedMarkdown> {
		// Import dynamically to avoid circular dependencies
		const { parseMarkdown } = await import("../../tools/MarkdownUtils.js");
		return await parseMarkdown(content);
	}

	/**
	 * Stringifies content with optional frontmatter into markdown format.
	 *
	 * @param content - Markdown content
	 * @param frontmatter - Optional frontmatter object
	 * @returns Formatted markdown with YAML frontmatter header
	 *
	 * TODO: Replace with injected MarkdownParserService
	 */
	private async stringifyMarkdown(
		content: string,
		frontmatter?: Record<string, any>
	): Promise<string> {
		// Import dynamically to avoid circular dependencies
		const { stringifyMarkdown } = await import("../../tools/MarkdownUtils.js");
		return await stringifyMarkdown(content, frontmatter);
	}
}
