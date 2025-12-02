import { exec } from "child_process";
import { promisify } from "util";
import type { IRunInTerminalParameters } from "../types/RunInTerminalParameters.js";
import type { IToolContext, IToolResult } from "../types/ToolContext.js";

const execAsync = promisify(exec);

/**
 * Core implementation for running terminal commands.
 * Platform-agnostic implementation that can be used by both VS Code extension and MCP server.
 *
 * @remarks
 * - VS Code adapter uses terminal shell integration for better UX
 * - MCP server uses Node.js child_process for command execution
 * - Commands are executed in the vault root directory
 * - Output is captured and returned in the result
 */
export class RunInTerminalToolCore {
	/**
	 * Execute a command in a shell.
	 *
	 * @param context - Tool execution context containing vault configuration
	 * @param params - Parameters containing the command to execute
	 * @returns Tool result with command output
	 *
	 * @remarks
	 * This method executes commands using Node.js child_process.
	 * Commands run in the vault root directory.
	 * Both stdout and stderr are captured and returned.
	 *
	 * @security
	 * This method executes arbitrary shell commands. Use with caution.
	 * Always validate and sanitize commands before execution.
	 */
	async runInTerminal(
		context: IToolContext,
		params: IRunInTerminalParameters
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

			// Validate command
			if (!params.command || params.command.trim() === "") {
				return {
					success: false,
					message: "Command is required.",
					error: "Command is required.",
				};
			}

			// Execute command in vault root
			const { stdout, stderr } = await execAsync(params.command, {
				cwd: vaultRoot,
				maxBuffer: 1024 * 1024 * 10, // 10MB buffer
			});

			// Combine stdout and stderr
			let output = "";
			if (stdout) {
				output += stdout;
			}
			if (stderr) {
				if (output) {
					output += "\n";
				}
				output += stderr;
			}

			return {
				success: true,
				message: output || "(no output)",
			};
		} catch (err: any) {
			// exec throws on non-zero exit codes
			let errorOutput = "";
			if (err.stdout) {
				errorOutput += err.stdout;
			}
			if (err.stderr) {
				if (errorOutput) {
					errorOutput += "\n";
				}
				errorOutput += err.stderr;
			}

			return {
				success: false,
				message: errorOutput || `Command failed: ${err.message}`,
				error: `Command execution failed: ${err.message}`,
			};
		}
	}
}
