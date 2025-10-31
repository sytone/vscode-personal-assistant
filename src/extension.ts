// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

import { registerChatTools } from "./tools/tools";
import { registerCommands } from "./commands/commands";
import { registerSimpleParticipant } from "./chatParticipants/chatParticipants";

// Global vault root path
let vaultRootPath: string | null = null;

export function getVaultRoot(): string | null {
  return vaultRootPath;
}

// For testing purposes only
export function setVaultRootForTesting(path: string | null): void {
  vaultRootPath = path;
}

function determineVaultRoot(): string | null {
  // First, check if user has explicitly configured a vault path
  const configuredVaultPath = vscode.workspace
    .getConfiguration("personal-assistant")
    .get<string>("vaultPath");

  if (configuredVaultPath && configuredVaultPath.trim()) {
    console.log(`Using configured vault path: ${configuredVaultPath}`);
    return configuredVaultPath;
  }

  // Fall back to first workspace folder, but only if it's a valid Obsidian vault
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    console.warn("No workspace folder is open and no vault path configured.");
    return null;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // Check if .obsidian folder exists to validate this is an Obsidian vault
  const obsidianFolderPath = path.join(workspaceRoot, ".obsidian");
  if (!fs.existsSync(obsidianFolderPath)) {
    console.warn(
      `Workspace folder ${workspaceRoot} is not a valid Obsidian vault (no .obsidian folder found). ` +
      "Please configure personal-assistant.vaultPath or open an Obsidian vault."
    );
    return null;
  }

  console.log(`Using workspace root as vault path: ${workspaceRoot}`);
  return workspaceRoot;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "personal-assistant" is now active!'
  );

  // Determine vault root path
  vaultRootPath = determineVaultRoot();

  if (vaultRootPath) {
    console.log(`Vault Root Path: ${vaultRootPath}`);
  } else {
    console.warn("No vault root path available. Some features may not work.");
  }

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("personal-assistant.vaultPath")) {
        vaultRootPath = determineVaultRoot();
        console.log(`Vault root path updated: ${vaultRootPath}`);
      }
    })
  );

  // Listen for workspace folder changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      vaultRootPath = determineVaultRoot();
      console.log(`Vault root path updated after workspace change: ${vaultRootPath}`);
    })
  );

  // Add in all the custom tools.
  registerChatTools(context);

  // Register commands
  registerCommands(context);

  registerSimpleParticipant(context);

}

// This method is called when your extension is deactivated
export function deactivate() { }
