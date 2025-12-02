import * as vscode from "vscode";
import type { IToolContext, IConfigProvider } from "../../core/types/ToolContext";
import { getVaultRoot, getTemplatesFolderName, getJournalTemplateName } from "../../extension";

/**
 * VS Code-specific configuration provider.
 * Retrieves configuration from VS Code workspace settings.
 */
export class VSCodeConfigProvider implements IConfigProvider {
	/**
	 * Gets tool context from VS Code workspace configuration.
	 *
	 * @returns Tool context with configuration from VS Code settings
	 * @throws Error if vault root is not configured
	 */
	getContext(): IToolContext {
		const config = vscode.workspace.getConfiguration("personal-assistant");
		const vaultRoot = getVaultRoot();

		if (!vaultRoot) {
			throw new Error(
				"No vault root configured. Please open a workspace or configure personal-assistant.vaultPath."
			);
		}

		return {
			vaultRoot,
			journalPath: config.get<string>("journalFolderName") || "1 Journal",
			tasksHeading: this.getTasksHeading(config),
			templatesFolderName: getTemplatesFolderName(),
			journalTemplateName: getJournalTemplateName(),
		};
	}

	/**
	 * Gets tasks heading from configuration, ensuring it starts with ##.
	 */
	private getTasksHeading(config: vscode.WorkspaceConfiguration): string {
		let heading = config.get<string>("journalTasksHeading") || "## Tasks This Week";
		if (heading && !heading.startsWith("#")) {
			heading = `## ${heading}`;
		}
		return heading;
	}
}
