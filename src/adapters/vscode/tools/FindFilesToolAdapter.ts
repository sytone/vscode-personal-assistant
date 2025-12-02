import * as vscode from "vscode";
import { FindFilesToolCore } from "../../../core/tools/FindFilesToolCore.js";
import type { IFindFilesParameters } from "../../../core/types/FindFilesParameters.js";
import { VSCodeConfigProvider } from "../VSCodeConfigProvider.js";

/**
 * VS Code Language Model Tool adapter for finding files in the vault.
 * Wraps the platform-agnostic FindFilesToolCore with VS Code-specific interfaces.
 */
export class FindFilesToolAdapter
	implements vscode.LanguageModelTool<IFindFilesParameters>
{
	private core: FindFilesToolCore;
	private configProvider: VSCodeConfigProvider;

	constructor() {
		this.core = new FindFilesToolCore();
		this.configProvider = new VSCodeConfigProvider();
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IFindFilesParameters>,
		_token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		const params = options.input;
		const context = this.configProvider.getContext();

		const result = await this.core.findFiles(context, params);

		return new vscode.LanguageModelToolResult([
			new vscode.LanguageModelTextPart(result.message),
		]);
	}

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<IFindFilesParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Searching workspace for "${options.input.pattern}"`,
		};
	}
}
