import * as vscode from "vscode";
import type { IRunInTerminalParameters } from "../../../core/types/RunInTerminalParameters.js";
import { VSCodeConfigProvider } from "../VSCodeConfigProvider.js";

/**
 * Wait for shell integration to be available on a terminal.
 *
 * @param terminal - Terminal to wait for shell integration
 * @param timeout - Timeout in milliseconds
 * @throws Error if shell integration is not enabled within timeout
 */
async function waitForShellIntegration(
	terminal: vscode.Terminal,
	timeout: number
): Promise<void> {
	let resolve: () => void;
	let reject: (e: Error) => void;
	const p = new Promise<void>((_resolve, _reject) => {
		resolve = _resolve;
		reject = _reject;
	});

	const timer = setTimeout(
		() =>
			reject(
				new Error(
					"Could not run terminal command: shell integration is not enabled"
				)
			),
		timeout
	);

	const listener = vscode.window.onDidChangeTerminalShellIntegration((e) => {
		if (e.terminal === terminal) {
			clearTimeout(timer);
			listener.dispose();
			resolve();
		}
	});

	await p;
}

/**
 * VS Code Language Model Tool adapter for running terminal commands.
 * Uses VS Code's terminal shell integration for better user experience.
 *
 * @remarks
 * This adapter provides VS Code-specific terminal integration.
 * Commands are executed in a visible terminal with shell integration.
 * Output is streamed and captured for return to the language model.
 */
export class RunInTerminalToolAdapter
	implements vscode.LanguageModelTool<IRunInTerminalParameters>
{
	private configProvider: VSCodeConfigProvider;

	constructor() {
		this.configProvider = new VSCodeConfigProvider();
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IRunInTerminalParameters>,
		_token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		const params = options.input;

		const terminal = vscode.window.createTerminal("Language Model Tool User");
		terminal.show();
		try {
			await waitForShellIntegration(terminal, 5000);
		} catch (e) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart((e as Error).message),
			]);
		}

		const execution = terminal.shellIntegration!.executeCommand(params.command);
		const terminalStream = execution.read();

		let terminalResult = "";
		for await (const chunk of terminalStream) {
			terminalResult += chunk;
		}

		return new vscode.LanguageModelToolResult([
			new vscode.LanguageModelTextPart(terminalResult),
		]);
	}

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<IRunInTerminalParameters>,
		_token: vscode.CancellationToken
	) {
		const confirmationMessages = {
			title: "Run command in terminal",
			message: new vscode.MarkdownString(
				`Run this command in a terminal?` +
					`\n\n\`\`\`\n${options.input.command}\n\`\`\`\n`
			),
		};

		return {
			invocationMessage: `Running command in terminal`,
			confirmationMessages,
		};
	}
}
