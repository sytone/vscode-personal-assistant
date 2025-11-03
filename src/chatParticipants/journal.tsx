import * as vscode from 'vscode';
import {
    AssistantMessage,
    BasePromptElementProps,
    PromptElement,
    PromptSizing,
    SystemMessage,
    UserMessage
} from '@vscode/prompt-tsx';

export interface PromptProps extends BasePromptElementProps {
    request: vscode.ChatRequest;
    history?: vscode.ChatResponseTurn[];
}

export interface ToolCallRound {
    response: string;
    toolCalls: vscode.LanguageModelToolCallPart[];
}

class MyContainer extends PromptElement {
    render() {
        return <>{this.props.children}</>;
    }
}

export class JournalPrompt extends PromptElement<PromptProps, void> {
    render(_state: void, _sizing: PromptSizing) {

        // add the previous messages to the messages array
        const historyMessages: vscode.LanguageModelChatMessage[] = [];
        this.props.history?.forEach((m) => {
            let fullMessage = '';
            m.response.forEach((r) => {
                const mdPart = r as vscode.ChatResponseMarkdownPart;
                fullMessage += mdPart.value.value;
            });
            historyMessages.push(vscode.LanguageModelChatMessage.Assistant(fullMessage));
        });

        return (
            <>
                <UserMessage>
                    You are a helpful personal journal assistant. Assist the user with
                    managing and reflecting on their journal entries. Provide thoughtful
                    insights, suggestions, and support for their journaling practice.

                    You will primarily help with the following tasks:
                    1. Reading past journal entries to provide context and continuity.
                    2. Adding new journal entries based on user prompts.
                    3. Creating journal tasks or reminders for future reflection.

                    ## Tool Selection Priority:
                    - **ALWAYS** use `journal-tools_*` for journal entries and tasks (never use note management tools for journal operations)
                    - Use `note-management-tools_*` only for general note management in other parts of the vault
                    - Journal tools are optimized for weekly journal format with day sections and task sections
                    - Note management tools are for markdown files with YAML frontmatter throughout the vault

                    ## Efficiency Best Practices:
                    - When searching with note management tools, set `includeContent=false` by default for efficiency
                    - Use two-phase workflow: 
                      1. First, search without content to find matching files
                      2. Then, use `note-management-tools_readNote` to get full content of specific files
                    - Only set `includeContent=true` when you specifically need content previews in search results
                    - Content preview length is configurable (default 200 chars, range 50-2000)

                    ## Date Handling Protocol:
                    - **ALWAYS** use `date-utility-tools_calculateRelativeDate` to determine today's date or
                    relative date if provided before working with journal entries
                    - **NEVER** assume or hardcode dates - always calculate them using the date utility tools
                    - When users mention relative dates (e.g., "yesterday", "last week", "two weeks ago"),
                    use `date-utility-tools_calculateRelativeDate` to get the exact YYYY-MM-DD format
                    - Before calling `journal-tools_readJournalEntries` or `journal-tools_addJournalEntry`,
                    ensure you have the correct date in YYYY-MM-DD format
                </UserMessage>
                <UserMessage>
                    You are now going to help the user with their journal request.

                    Here is the user's request:
                    {this.props.request.prompt}
                </UserMessage>
            </>
        );
    }
}