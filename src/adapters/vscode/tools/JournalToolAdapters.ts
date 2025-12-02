import * as vscode from "vscode";
import {
	JournalToolCore,
	type IAddJournalEntryParameters,
	type IReadJournalEntriesParameters,
	type IAddJournalTaskParameters,
	type ICompleteJournalTaskParameters,
	type IReadJournalTasksParameters,
} from "../../../core/tools/JournalToolCore";
import { VSCodeConfigProvider } from "../VSCodeConfigProvider";
import { dateService } from "../../../services/DateService";
import { templateService } from "../../../services/TemplateService";

/**
 * VS Code Language Model Tool adapter for adding journal entries.
 * Wraps JournalToolCore to provide VS Code-specific integration.
 *
 * @remarks
 * This adapter:
 * - Implements vscode.LanguageModelTool interface
 * - Provides VS Code configuration through VSCodeConfigProvider
 * - Converts core IToolResult to VS Code LanguageModelToolResult
 * - Handles cancellation tokens (currently unused by core)
 */
export class AddJournalEntryToolAdapter
	implements vscode.LanguageModelTool<IAddJournalEntryParameters>
{
	private core: JournalToolCore;
	private configProvider: VSCodeConfigProvider;

	constructor() {
		this.core = new JournalToolCore(dateService, templateService);
		this.configProvider = new VSCodeConfigProvider();
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IAddJournalEntryParameters>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		try {
			const context = this.configProvider.getContext();
			const result = await this.core.addEntry(context, options.input);

			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(result.message),
			]);
		} catch (err) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(
					`Error: ${err instanceof Error ? err.message : String(err)}`
				),
			]);
		}
	}

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<IAddJournalEntryParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Adding journal entry`,
		};
	}
}

/**
 * VS Code Language Model Tool adapter for reading journal entries.
 */
export class ReadJournalEntriesToolAdapter
	implements vscode.LanguageModelTool<IReadJournalEntriesParameters>
{
	private core: JournalToolCore;
	private configProvider: VSCodeConfigProvider;

	constructor() {
		this.core = new JournalToolCore(dateService, templateService);
		this.configProvider = new VSCodeConfigProvider();
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IReadJournalEntriesParameters>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		try {
			const context = this.configProvider.getContext();
			const result = await this.core.readEntries(context, options.input);

			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(result.message),
			]);
		} catch (err) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(
					`Error: ${err instanceof Error ? err.message : String(err)}`
				),
			]);
		}
	}

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<IReadJournalEntriesParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Reading journal entries`,
		};
	}
}

/**
 * VS Code Language Model Tool adapter for adding journal tasks.
 */
export class AddJournalTaskToolAdapter
	implements vscode.LanguageModelTool<IAddJournalTaskParameters>
{
	private core: JournalToolCore;
	private configProvider: VSCodeConfigProvider;

	constructor() {
		this.core = new JournalToolCore(dateService, templateService);
		this.configProvider = new VSCodeConfigProvider();
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IAddJournalTaskParameters>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		try {
			const context = this.configProvider.getContext();
			const result = await this.core.addTask(context, options.input);

			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(result.message),
			]);
		} catch (err) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(
					`Error: ${err instanceof Error ? err.message : String(err)}`
				),
			]);
		}
	}

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<IAddJournalTaskParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Adding journal task`,
		};
	}
}

/**
 * VS Code Language Model Tool adapter for completing journal tasks.
 */
export class CompleteJournalTaskToolAdapter
	implements vscode.LanguageModelTool<ICompleteJournalTaskParameters>
{
	private core: JournalToolCore;
	private configProvider: VSCodeConfigProvider;

	constructor() {
		this.core = new JournalToolCore(dateService, templateService);
		this.configProvider = new VSCodeConfigProvider();
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ICompleteJournalTaskParameters>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		try {
			const context = this.configProvider.getContext();
			const result = await this.core.completeTask(context, options.input);

			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(result.message),
			]);
		} catch (err) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(
					`Error: ${err instanceof Error ? err.message : String(err)}`
				),
			]);
		}
	}

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<ICompleteJournalTaskParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Completing journal task`,
		};
	}
}

/**
 * VS Code Language Model Tool adapter for reading journal tasks.
 */
export class ReadJournalTasksToolAdapter
	implements vscode.LanguageModelTool<IReadJournalTasksParameters>
{
	private core: JournalToolCore;
	private configProvider: VSCodeConfigProvider;

	constructor() {
		this.core = new JournalToolCore(dateService, templateService);
		this.configProvider = new VSCodeConfigProvider();
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IReadJournalTasksParameters>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		try {
			const context = this.configProvider.getContext();
			const result = await this.core.readTasks(context, options.input);

			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(result.message),
			]);
		} catch (err) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(
					`Error: ${err instanceof Error ? err.message : String(err)}`
				),
			]);
		}
	}

	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<IReadJournalTasksParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Reading journal tasks`,
		};
	}
}
