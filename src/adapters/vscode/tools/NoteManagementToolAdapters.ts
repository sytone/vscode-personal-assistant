import * as vscode from "vscode";
import { NoteManagementToolCore } from "../../../core/tools/NoteManagementToolCore";
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
} from "../../../core/types/NoteParameters";
import { VSCodeConfigProvider } from "../VSCodeConfigProvider";
import { templateService } from "../../../services/TemplateService";

/**
 * VS Code Language Model Tool adapter for listing markdown files.
 * Wraps NoteManagementToolCore to provide VS Code-specific integration.
 */
export class ListFilesToolAdapter implements vscode.LanguageModelTool<IListFilesParameters> {
	private core: NoteManagementToolCore;
	private configProvider: VSCodeConfigProvider;

	constructor() {
		this.core = new NoteManagementToolCore(templateService);
		this.configProvider = new VSCodeConfigProvider();
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IListFilesParameters>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		try {
			const context = this.configProvider.getContext();
			const result = await this.core.listFiles(context, options.input);

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
		options: vscode.LanguageModelToolInvocationPrepareOptions<IListFilesParameters>,
		_token: vscode.CancellationToken
	) {
		const params = options.input;
		return {
			invocationMessage: `Listing markdown files${params.folderPath ? ` in "${params.folderPath}"` : " in vault"}`,
		};
	}
}

/**
 * VS Code Language Model Tool adapter for searching files by filename pattern.
 */
export class SearchFilesByNameToolAdapter
	implements vscode.LanguageModelTool<ISearchFilesByNameParameters>
{
	private core: NoteManagementToolCore;
	private configProvider: VSCodeConfigProvider;

	constructor() {
		this.core = new NoteManagementToolCore(templateService);
		this.configProvider = new VSCodeConfigProvider();
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ISearchFilesByNameParameters>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		try {
			const context = this.configProvider.getContext();
			const result = await this.core.searchFilesByName(context, options.input);

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
		options: vscode.LanguageModelToolInvocationPrepareOptions<ISearchFilesByNameParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Searching for files matching "${options.input.namePattern}"`,
		};
	}
}

/**
 * VS Code Language Model Tool adapter for searching files by content text.
 */
export class SearchFilesByContentToolAdapter
	implements vscode.LanguageModelTool<ISearchFilesByContentParameters>
{
	private core: NoteManagementToolCore;
	private configProvider: VSCodeConfigProvider;

	constructor() {
		this.core = new NoteManagementToolCore(templateService);
		this.configProvider = new VSCodeConfigProvider();
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ISearchFilesByContentParameters>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		try {
			const context = this.configProvider.getContext();
			const result = await this.core.searchFilesByContent(context, options.input);

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
		options: vscode.LanguageModelToolInvocationPrepareOptions<ISearchFilesByContentParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Searching for files containing "${options.input.searchText}"`,
		};
	}
}

/**
 * VS Code Language Model Tool adapter for searching notes by frontmatter.
 */
export class SearchNotesByFrontmatterToolAdapter
	implements vscode.LanguageModelTool<ISearchNotesByFrontmatterParameters>
{
	private core: NoteManagementToolCore;
	private configProvider: VSCodeConfigProvider;

	constructor() {
		this.core = new NoteManagementToolCore(templateService);
		this.configProvider = new VSCodeConfigProvider();
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ISearchNotesByFrontmatterParameters>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		try {
			const context = this.configProvider.getContext();
			const result = await this.core.searchNotesByFrontmatter(context, options.input);

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
		options: vscode.LanguageModelToolInvocationPrepareOptions<ISearchNotesByFrontmatterParameters>,
		_token: vscode.CancellationToken
	) {
		const valueMsg = options.input.value !== undefined ? ` = "${options.input.value}"` : "";
		return {
			invocationMessage: `Searching for notes with frontmatter "${options.input.key}"${valueMsg}`,
		};
	}
}

/**
 * VS Code Language Model Tool adapter for reading note content.
 */
export class ReadNoteToolAdapter implements vscode.LanguageModelTool<IReadNoteParameters> {
	private core: NoteManagementToolCore;
	private configProvider: VSCodeConfigProvider;

	constructor() {
		this.core = new NoteManagementToolCore(templateService);
		this.configProvider = new VSCodeConfigProvider();
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IReadNoteParameters>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		try {
			const context = this.configProvider.getContext();
			const result = await this.core.readNote(context, options.input);

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
		options: vscode.LanguageModelToolInvocationPrepareOptions<IReadNoteParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Reading note "${options.input.notePath}"`,
		};
	}
}

/**
 * VS Code Language Model Tool adapter for creating new notes.
 */
export class CreateNoteToolAdapter implements vscode.LanguageModelTool<ICreateNoteParameters> {
	private core: NoteManagementToolCore;
	private configProvider: VSCodeConfigProvider;

	constructor() {
		this.core = new NoteManagementToolCore(templateService);
		this.configProvider = new VSCodeConfigProvider();
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ICreateNoteParameters>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		try {
			const context = this.configProvider.getContext();
			const result = await this.core.createNote(context, options.input);

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
		options: vscode.LanguageModelToolInvocationPrepareOptions<ICreateNoteParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Creating note "${options.input.notePath}"`,
		};
	}
}

/**
 * VS Code Language Model Tool adapter for updating note content.
 */
export class UpdateNoteToolAdapter implements vscode.LanguageModelTool<IUpdateNoteParameters> {
	private core: NoteManagementToolCore;
	private configProvider: VSCodeConfigProvider;

	constructor() {
		this.core = new NoteManagementToolCore(templateService);
		this.configProvider = new VSCodeConfigProvider();
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IUpdateNoteParameters>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		try {
			const context = this.configProvider.getContext();
			const result = await this.core.updateNote(context, options.input);

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
		options: vscode.LanguageModelToolInvocationPrepareOptions<IUpdateNoteParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Updating note "${options.input.notePath}"`,
		};
	}
}

/**
 * VS Code Language Model Tool adapter for updating note frontmatter.
 */
export class UpdateNoteFrontmatterToolAdapter
	implements vscode.LanguageModelTool<IUpdateNoteFrontmatterParameters>
{
	private core: NoteManagementToolCore;
	private configProvider: VSCodeConfigProvider;

	constructor() {
		this.core = new NoteManagementToolCore(templateService);
		this.configProvider = new VSCodeConfigProvider();
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IUpdateNoteFrontmatterParameters>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		try {
			const context = this.configProvider.getContext();
			const result = await this.core.updateNoteFrontmatter(context, options.input);

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
		options: vscode.LanguageModelToolInvocationPrepareOptions<IUpdateNoteFrontmatterParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Updating frontmatter for "${options.input.notePath}"`,
		};
	}
}

/**
 * VS Code Language Model Tool adapter for deleting notes.
 *
 * @remarks
 * This adapter includes additional safety checks for the deletion operation:
 * - Checks VS Code configuration for allowNoteDeletion setting
 * - Returns error if deletion is disabled (default)
 * - Only proceeds if explicitly enabled by user
 */
export class DeleteNoteToolAdapter implements vscode.LanguageModelTool<IDeleteNoteParameters> {
	private core: NoteManagementToolCore;
	private configProvider: VSCodeConfigProvider;

	constructor() {
		this.core = new NoteManagementToolCore(templateService);
		this.configProvider = new VSCodeConfigProvider();
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<IDeleteNoteParameters>,
		token: vscode.CancellationToken
	): Promise<vscode.LanguageModelToolResult> {
		// Check if deletion is allowed (VS Code-specific safety check)
		const config = vscode.workspace.getConfiguration("personal-assistant");
		const allowDeletion = config.get<boolean>("allowNoteDeletion", false);

		if (!allowDeletion) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(
					'Note deletion is not allowed. Enable "personal-assistant.allowNoteDeletion" in settings to allow deletion.'
				),
			]);
		}

		try {
			const context = this.configProvider.getContext();
			const result = await this.core.deleteNote(context, options.input);

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
		options: vscode.LanguageModelToolInvocationPrepareOptions<IDeleteNoteParameters>,
		_token: vscode.CancellationToken
	) {
		return {
			invocationMessage: `Deleting note "${options.input.notePath}"`,
		};
	}
}
