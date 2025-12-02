import { glob } from "glob";
import type { IFindFilesParameters } from "../types/FindFilesParameters.js";
import type { IToolContext, IToolResult } from "../types/ToolContext.js";

/**
 * Core implementation for finding files in the vault using glob patterns.
 * Platform-agnostic implementation that can be used by both VS Code extension and MCP server.
 */
export class FindFilesToolCore {
	/**
	 * Find files matching a glob pattern in the vault.
	 *
	 * @param context - Tool execution context containing vault configuration
	 * @param params - Parameters containing the search pattern
	 * @returns Tool result with list of matching files
	 *
	 * @remarks
	 * - Automatically excludes node_modules, .git, and .obsidian directories
	 * - Returns file paths relative to vault root
	 * - Supports standard glob patterns (*, **, ?, [])
	 */
	async findFiles(
		context: IToolContext,
		params: IFindFilesParameters
	): Promise<IToolResult> {
		try {
			const vaultRoot = context.vaultRoot;
			if (!vaultRoot) {
				return {
					success: false,
					message: "No vault root configured.",
					error: "No vault root configured. Please open a workspace or configure personalAssistant.vaultPath.",
				};
			}

			// Validate pattern
			if (!params.pattern || params.pattern.trim() === "") {
				return {
					success: false,
					message: "Search pattern is required.",
					error: "Search pattern is required.",
				};
			}

			// Use glob to find files, excluding node_modules
			const files = await glob(params.pattern, {
				cwd: vaultRoot,
				ignore: ["**/node_modules/**", "**/.git/**", "**/.obsidian/**"],
				nodir: true,
				absolute: false,
			});

			// Sort files for consistent output
			files.sort();

			// Format file paths for display
			const strFiles = files.length > 0 ? files.join("\n") : "(no files found)";

			return {
				success: true,
				message: `Found ${files.length} files matching "${params.pattern}":\n${strFiles}`,
			};
		} catch (err) {
			return {
				success: false,
				message: "Failed to search for files.",
				error: `Failed to search for files: ${err}`,
			};
		}
	}
}
