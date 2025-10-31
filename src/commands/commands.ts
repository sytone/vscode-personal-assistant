import { log } from 'console';
import * as vscode from 'vscode';

export function registerCommands(context: vscode.ExtensionContext) {

    context.subscriptions.push(vscode.commands.registerCommand(
        DisplayConfigurationCommand.commandId,
        () => {
            DisplayConfigurationCommand.execute();
        }
    ));
    context.subscriptions.push(vscode.commands.registerCommand(
        HelloWorldCommand.commandId,
        () => {
            HelloWorldCommand.execute();
        }
    ));
}

export class DisplayConfigurationCommand {
    // Unique identifier for the command
    static commandId = 'personal-assistant.displayConfiguration';

    // The function that gets executed when the command is invoked.
    static execute() {
        const vaultPath = vscode.workspace.getConfiguration().get<string>("personal-assistant.vaultPath") ?? "";
        console.log(`Vault Path: ${vaultPath}`);
        vscode.window.showInformationMessage(`Vault Path: ${vaultPath}`);
    }
}

export class HelloWorldCommand {
    // Unique identifier for the command
    static commandId = 'personal-assistant.helloWorld';

    // The function that gets executed when the command is invoked.
    static execute() {
        vscode.window.showInformationMessage('Hello World from Personal Assistant!');
    }
}   
