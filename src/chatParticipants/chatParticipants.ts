import { renderPrompt } from '@vscode/prompt-tsx';
import * as vscode from 'vscode';
import { JournalPrompt } from './journal';

import { sendChatParticipantRequest } from '@vscode/chat-extension-utils';
import { PromptElementAndProps } from '@vscode/chat-extension-utils/dist/toolsPrompt';


const JOURNAL_NAMES_COMMAND_ID = 'journal.namesInEditor';
const JOURNAL_PARTICIPANT_ID = 'personal-assistant.journal';
const END_MEETING_BUTTON_COMMAND_ID = 'personal-assistant.journal.endMeetingButton';
const MEETING_USAGE_EXAMPLE = '`@journal /meeting 2:00 PM Weekly Team Sync`';

interface IJournalChatResult extends vscode.ChatResult {
    metadata: JournalChatMetadata;
}

/**
 * Metadata persisted between chat turns for the journal participant.
 *
 * @remarks
 * The meeting setup properties allow interactive prompts that gather the
 * required meeting details (time and title) across multiple user turns.
 */
interface JournalChatMetadata {
    /** Identifies which slash command produced the result. */
    command: string;
    /** Title of the active meeting once both values are captured. */
    meetingTitle?: string;
    /** Captured meeting time, normalized for consistent formatting. */
    meetingTime?: string;
    /** Accumulated meeting notes while a meeting is active. */
    meetingNotes?: string[];
    /** Indicates whether the chat is currently inside a meeting session. */
    inMeeting?: boolean;
    /** True when the agent still needs the meeting time from the user. */
    awaitingMeetingTime?: boolean;
    /** True when the agent still needs the meeting title from the user. */
    awaitingMeetingTitle?: boolean;
    /** Cached meeting time collected so far during setup. */
    pendingMeetingTime?: string;
    /** Cached meeting title collected so far during setup. */
    pendingMeetingTitle?: string;
    /** Signals that the user is mid-setup and the agent should keep prompting. */
    meetingSetupPending?: boolean;
}

interface MeetingButtonArguments {
    meetingLabel: string;
}

/** Represents the extracted meeting details from user input. */
interface MeetingDetailsParseResult {
    /** Parsed meeting time when present. */
    meetingTime?: string;
    /** Parsed meeting title when present. */
    meetingTitle?: string;
}

/** Controls parsing behavior for meeting prompts. */
interface MeetingDetailsParseOptions {
    /** Treat unmatched text as the meeting title when true. */
    fallbackTitle?: boolean;
}

const MEETING_WITH_TIME_REGEX = /^\s*(?:(?<time24>\d{1,2}:\d{2})|(?<time12>\d{1,2}(?::\d{2})?\s*(?:[AaPp][Mm])))\s+(?<title>.+)$/;
const MEETING_TIME_ONLY_REGEX = /^\s*(?:(?<time24>\d{1,2}:\d{2})|(?<time12>\d{1,2}(?::\d{2})?\s*(?:[AaPp][Mm])))\s*$/;

/**
 * Extracts meeting time and title from a user supplied string.
 *
 * @param input - Raw user prompt to parse.
 * @param options - Controls whether unmatched text is treated as a title.
 * @returns The parsed meeting time/title pair (if present).
 *
 * @remarks
 * The parser supports 24-hour times (e.g. `14:00`) and 12-hour times with or
 * without minutes (e.g. `2 PM`, `2:30pm`). When no time is detected and
 * `fallbackTitle` is true, the entire input becomes the tentative meeting title.
 */
function parseMeetingDetails(input: string, options: MeetingDetailsParseOptions = {}): MeetingDetailsParseResult {
    const trimmed = input.trim();
    if (!trimmed) {
        return {};
    }

    const match = trimmed.match(MEETING_WITH_TIME_REGEX);
    if (match && match.groups) {
        const timeSource = match.groups.time24 ?? match.groups.time12 ?? '';
        const normalizedTime = normalizeMeetingTime(timeSource);
        const meetingTitle = match.groups.title.trim();
        return {
            meetingTime: normalizedTime,
            meetingTitle
        };
    }

    const timeOnlyMatch = trimmed.match(MEETING_TIME_ONLY_REGEX);
    if (timeOnlyMatch && timeOnlyMatch.groups) {
        const timeSource = timeOnlyMatch.groups.time24 ?? timeOnlyMatch.groups.time12 ?? '';
        if (timeSource) {
            return { meetingTime: normalizeMeetingTime(timeSource) };
        }
    }

    if (options.fallbackTitle) {
        return { meetingTitle: trimmed };
    }

    return {};
}

/**
 * Normalizes meeting time strings for consistent downstream usage.
 *
 * @param rawTime - Raw time string matched by {@link parseMeetingDetails}.
 * @returns A normalized time (e.g. `2:00 PM`, `14:30`).
 *
 * @remarks
 * The function pads minutes when omitted and uppercases AM/PM markers while
 * preserving 24-hour inputs as-is.
 */
function normalizeMeetingTime(rawTime: string): string {
    const compact = rawTime.replace(/\s+/g, ' ').trim();
    const twelveHourMatch = compact.match(/^(?<hour>\d{1,2})(?::(?<minutes>\d{2}))?\s*(?<meridiem>[AaPp][Mm])$/);
    if (twelveHourMatch && twelveHourMatch.groups) {
        const hour = parseInt(twelveHourMatch.groups.hour, 10);
        const minutes = twelveHourMatch.groups.minutes ?? '00';
        const meridiem = twelveHourMatch.groups.meridiem.toUpperCase();
        return `${hour}:${minutes.padStart(2, '0')} ${meridiem}`;
    }

    const twentyFourHourMatch = compact.match(/^(?<hour>\d{1,2}):(?<minutes>\d{2})$/);
    if (twentyFourHourMatch && twentyFourHourMatch.groups) {
        const hour = twentyFourHourMatch.groups.hour;
        const minutes = twentyFourHourMatch.groups.minutes;
        return `${hour}:${minutes}`;
    }

    return compact;
}

/**
 * Produces the user-facing meeting label that includes time when available.
 *
 * @param meetingTime - Optional meeting time.
 * @param meetingTitle - Meeting title, defaults to `Meeting` when omitted.
 * @returns A formatted label combining both fields.
 */
function formatMeetingLabel(meetingTime?: string, meetingTitle?: string): string {
    const resolvedTitle = meetingTitle?.trim() || 'Meeting';
    return meetingTime ? `${meetingTime} - ${resolvedTitle}` : resolvedTitle;
}

/**
 * Builds a prompt instructing the user which meeting fields are still required.
 *
 * @param awaitingTime - Indicates the agent is still missing the time.
 * @param awaitingTitle - Indicates the agent is still missing the title.
 * @returns A user-facing prompt string.
 */
function buildMeetingInfoPrompt(awaitingTime: boolean, awaitingTitle: boolean): string {
    if (awaitingTime && awaitingTitle) {
        return `Please provide the meeting time and title.\n\nExample: ${MEETING_USAGE_EXAMPLE}`;
    }

    if (awaitingTime) {
        return `Please provide the meeting time in HH:MM format (optionally with AM/PM).\n\nExample: ${MEETING_USAGE_EXAMPLE}`;
    }

    return `Please provide the meeting title.\n\nExample: ${MEETING_USAGE_EXAMPLE}`;
}

export function registerSimpleParticipant(context: vscode.ExtensionContext) {

    // Define a Journal chat handler.
    const handler: vscode.ChatRequestHandler = async (
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ) => {

        // To talk to an LLM in your subcommand handler implementation, your
        // extension can use VS Code's `requestChatAccess` API to access the Copilot API.
        // The GitHub Copilot Chat extension implements this provider.
        if (request.command === 'add') {
            // Add an entry to today's journal
            stream.progress('Adding entry to today\'s journal...');
            try {
                // Calculate today's date
                const dateTools = vscode.lm.tools.find(tool => tool.name === 'date-utility-tools_calculateRelativeDate');
                if (!dateTools) {
                    stream.markdown('Error: Date utility tools not available.');
                    return { metadata: { command: 'add' } };
                }

                const dateResult = await vscode.lm.invokeTool(
                    'date-utility-tools_calculateRelativeDate',
                    {
                        toolInvocationToken: request.toolInvocationToken,
                        input: { relativeDateDescription: 'today' }
                    },
                    token
                );

                let todayDate = '';
                for (const part of dateResult.content) {
                    if (part instanceof vscode.LanguageModelTextPart) {
                        todayDate = part.value.trim();
                    }
                }

                if (!todayDate) {
                    stream.markdown('Error: Could not calculate today\'s date.');
                    return { metadata: { command: 'add' } };
                }

                // Add the journal entry
                const journalTools = vscode.lm.tools.find(tool => tool.name === 'journal-tools_addJournalEntry');
                if (!journalTools) {
                    stream.markdown('Error: Journal tools not available.');
                    return { metadata: { command: 'add' } };
                }

                const addResult = await vscode.lm.invokeTool(
                    'journal-tools_addJournalEntry',
                    {
                        toolInvocationToken: request.toolInvocationToken,
                        input: {
                            date: todayDate,
                            entryContent: request.prompt
                        }
                    },
                    token
                );

                for (const part of addResult.content) {
                    if (part instanceof vscode.LanguageModelTextPart) {
                        stream.markdown(part.value);
                    }
                }

            } catch (err) {
                handleError(logger, err, stream);
            }

            logger.logUsage('request', { kind: 'add' });
            return { metadata: { command: 'add' } };
        } else if (request.command === 'meeting') {
            // Start tracking a meeting
            const userInput = request.prompt.trim();
            if (!userInput) {
                stream.markdown(buildMeetingInfoPrompt(true, true));
                return {
                    metadata: {
                        command: 'meeting',
                        meetingSetupPending: true,
                        awaitingMeetingTime: true,
                        awaitingMeetingTitle: true
                    }
                };
            }

            const parsedDetails = parseMeetingDetails(userInput, { fallbackTitle: true });
            let meetingTime = parsedDetails.meetingTime;
            let meetingTitle = parsedDetails.meetingTitle;

            const awaitingTime = !meetingTime;
            const awaitingTitle = !meetingTitle;

            if (!meetingTime || !meetingTitle) {
                stream.markdown(buildMeetingInfoPrompt(awaitingTime, awaitingTitle));
                return {
                    metadata: {
                        command: 'meeting',
                        meetingSetupPending: true,
                        awaitingMeetingTime: awaitingTime,
                        awaitingMeetingTitle: awaitingTitle,
                        pendingMeetingTime: meetingTime,
                        pendingMeetingTitle: meetingTitle
                    }
                };
            }

            const meetingLabel = formatMeetingLabel(meetingTime, meetingTitle);
            stream.markdown(`📝 Started tracking meeting: **${meetingLabel}**\n\nAdd notes by chatting without commands. Use \`/endMeeting\` when done.`);
            
            logger.logUsage('request', { kind: 'meeting', source: 'immediate' });
            return { 
                metadata: { 
                    command: 'meeting',
                    meetingTitle,
                    meetingTime,
                    meetingNotes: [],
                    inMeeting: true
                } 
            };
        } else if (request.command === 'endMeeting') {
            // End the current meeting and add to journal
            const previousTurns = context.history.filter(
                h => h instanceof vscode.ChatResponseTurn
            ) as vscode.ChatResponseTurn[];
            
            const lastResult = previousTurns.length > 0 
                ? previousTurns[previousTurns.length - 1].result as IJournalChatResult
                : undefined;

            if (!lastResult?.metadata?.inMeeting) {
                stream.markdown('No active meeting to end. Start a meeting with `/meeting <title>`');
                return { metadata: { command: 'endMeeting' } };
            }

            const meetingTitle = lastResult.metadata.meetingTitle || 'Untitled Meeting';
            const meetingLabel = formatMeetingLabel(lastResult.metadata.meetingTime, meetingTitle);
            const meetingNotes = lastResult.metadata.meetingNotes || [];

            if (meetingNotes.length === 0) {
                stream.markdown(`No notes recorded for **${meetingLabel}**.`);
                return { 
                    metadata: { 
                        command: 'endMeeting',
                        inMeeting: false
                    } 
                };
            }

            stream.progress('Ending meeting and adding notes to journal...');
            
            try {
                // Calculate today's date
                const dateResult = await vscode.lm.invokeTool(
                    'date-utility-tools_calculateRelativeDate',
                    {
                        toolInvocationToken: request.toolInvocationToken,
                        input: { relativeDateDescription: 'today' }
                    },
                    token
                );

                let todayDate = '';
                for (const part of dateResult.content) {
                    if (part instanceof vscode.LanguageModelTextPart) {
                        todayDate = part.value.trim();
                    }
                }

                if (!todayDate) {
                    stream.markdown('Error: Could not calculate today\'s date.');
                    return { metadata: { command: 'endMeeting', inMeeting: false } };
                }

                // Format meeting notes with indentation
                const formattedNotes = meetingNotes.map(note => `  - ${note}`).join('\n');
                const journalEntry = `${meetingLabel}\n${formattedNotes}`;

                // Add to journal
                const addResult = await vscode.lm.invokeTool(
                    'journal-tools_addJournalEntry',
                    {
                        toolInvocationToken: request.toolInvocationToken,
                        input: {
                            date: todayDate,
                            entryContent: journalEntry
                        }
                    },
                    token
                );

                for (const part of addResult.content) {
                    if (part instanceof vscode.LanguageModelTextPart) {
                        stream.markdown(part.value);
                    }
                }

                stream.markdown(`\n✅ Meeting ended. Added **${meetingNotes.length}** note(s) from **${meetingLabel}** to the journal.`);

            } catch (err) {
                handleError(logger, err, stream);
            }

            logger.logUsage('request', { kind: 'endMeeting' });
            return { 
                metadata: { 
                    command: 'endMeeting',
                    inMeeting: false
                } 
            };
        } else if (request.command === 'summarize') {
            // Summarize meeting notes or create a summary entry
            const previousTurns = context.history.filter(
                h => h instanceof vscode.ChatResponseTurn
            ) as vscode.ChatResponseTurn[];
            
            const lastResult = previousTurns.length > 0 
                ? previousTurns[previousTurns.length - 1].result as IJournalChatResult
                : undefined;

            const inMeeting = lastResult?.metadata?.inMeeting || false;

            stream.progress(inMeeting ? 'Summarizing meeting...' : 'Creating summary...');

            try {
                let contentToSummarize = request.prompt.trim();
                let summaryContext = '';

                if (inMeeting) {
                    const meetingTitle = lastResult?.metadata?.meetingTitle || 'Meeting';
                    const meetingLabel = formatMeetingLabel(lastResult?.metadata?.meetingTime, meetingTitle);
                    const meetingNotes = lastResult?.metadata?.meetingNotes || [];
                    
                    summaryContext = `You are summarizing a meeting titled "${meetingLabel}".`;
                    if (meetingNotes.length > 0) {
                        summaryContext += `\n\nPrevious notes:\n${meetingNotes.map(n => `- ${n}`).join('\n')}`;
                    }
                    if (contentToSummarize) {
                        summaryContext += `\n\nNew content to summarize:\n${contentToSummarize}`;
                    } else {
                        contentToSummarize = `Summarize all the meeting notes above into a concise summary with key points and action items.`;
                    }
                }

                const messages = [
                    vscode.LanguageModelChatMessage.User('You are a helpful assistant that creates clear, concise summaries. Focus on key points, decisions, and action items.'),
                    vscode.LanguageModelChatMessage.User(summaryContext || contentToSummarize)
                ];

                const chatResponse = await request.model.sendRequest(messages, {}, token);
                
                let summary = '';
                for await (const fragment of chatResponse.text) {
                    summary += fragment;
                    stream.markdown(fragment);
                }

                // If in meeting, add summary as a note
                if (inMeeting && summary) {
                    const updatedNotes = [...(lastResult?.metadata?.meetingNotes || []), `Summary: ${summary.trim()}`];
                    logger.logUsage('request', { kind: 'summarize', context: 'meeting' });
                    return {
                        metadata: {
                            command: 'summarize',
                            meetingTitle: lastResult?.metadata?.meetingTitle,
                            meetingTime: lastResult?.metadata?.meetingTime,
                            meetingNotes: updatedNotes,
                            inMeeting: true
                        }
                    };
                }

            } catch (err) {
                handleError(logger, err, stream);
            }

            logger.logUsage('request', { kind: 'summarize', context: inMeeting ? 'meeting' : 'standalone' });
            return { 
                metadata: { 
                    command: 'summarize',
                    inMeeting: inMeeting,
                    meetingTitle: lastResult?.metadata?.meetingTitle,
                    meetingTime: lastResult?.metadata?.meetingTime,
                    meetingNotes: lastResult?.metadata?.meetingNotes
                } 
            };
        } else if (request.command === 'randomTeach') {
            stream.progress('Picking the right topic to teach...');
            const topic = getTopic(context.history);
            try {
                const messages = [
                    vscode.LanguageModelChatMessage.User('You are a cat! Your job is to explain computer science concepts in the funny manner of a cat. Always start your response by stating what concept you are explaining. Always include code samples.'),
                    vscode.LanguageModelChatMessage.User(topic)
                ];

                const chatResponse = await request.model.sendRequest(messages, {}, token);
                for await (const fragment of chatResponse.text) {
                    stream.markdown(fragment);
                }

            } catch (err) {
                handleError(logger, err, stream);
            }

            stream.button({
                command: JOURNAL_NAMES_COMMAND_ID,
                title: vscode.l10n.t('Use Cat Names in Editor')
            });

            logger.logUsage('request', { kind: 'randomTeach' });
            return { metadata: { command: 'randomTeach' } };
        } else if (request.command === 'play') {
            stream.progress('Throwing away the computer science books and preparing to play with some Python code...');
            try {
                // Here's an example of how to use the prompt-tsx library to build a prompt
                const { messages } = await renderPrompt(
                    JournalPrompt,
                    { request },
                    { modelMaxPromptTokens: request.model.maxInputTokens },
                    request.model);
                const chatResponse = await request.model.sendRequest(messages, {}, token);
                for await (const fragment of chatResponse.text) {
                    stream.markdown(fragment);
                }

            } catch (err) {
                handleError(logger, err, stream);
            }

            logger.logUsage('request', { kind: 'play' });
            return { metadata: { command: 'play' } };
        } else {
            // Check if we're in a meeting
            const previousTurns = context.history.filter(
                h => h instanceof vscode.ChatResponseTurn
            ) as vscode.ChatResponseTurn[];
            
            const lastResult = previousTurns.length > 0 
                ? previousTurns[previousTurns.length - 1].result as IJournalChatResult
                : undefined;

            if (lastResult?.metadata?.meetingSetupPending) {
                const awaitingTime = lastResult.metadata.awaitingMeetingTime ?? false;
                const awaitingTitle = lastResult.metadata.awaitingMeetingTitle ?? false;
                const userResponse = request.prompt.trim();

                if (!userResponse) {
                    stream.markdown(buildMeetingInfoPrompt(awaitingTime, awaitingTitle));
                    return {
                        metadata: {
                            command: 'meeting',
                            meetingSetupPending: true,
                            awaitingMeetingTime: awaitingTime,
                            awaitingMeetingTitle: awaitingTitle,
                            pendingMeetingTime: lastResult.metadata.pendingMeetingTime,
                            pendingMeetingTitle: lastResult.metadata.pendingMeetingTitle
                        }
                    };
                }

                const parsed = parseMeetingDetails(userResponse, { fallbackTitle: awaitingTitle });
                const meetingTime = parsed.meetingTime ?? lastResult.metadata.pendingMeetingTime;
                const meetingTitle = parsed.meetingTitle ?? lastResult.metadata.pendingMeetingTitle;

                const stillAwaitingTime = !meetingTime;
                const stillAwaitingTitle = !meetingTitle;

                if (!meetingTime || !meetingTitle) {
                    stream.markdown(buildMeetingInfoPrompt(stillAwaitingTime, stillAwaitingTitle));
                    return {
                        metadata: {
                            command: 'meeting',
                            meetingSetupPending: true,
                            awaitingMeetingTime: stillAwaitingTime,
                            awaitingMeetingTitle: stillAwaitingTitle,
                            pendingMeetingTime: meetingTime,
                            pendingMeetingTitle: meetingTitle
                        }
                    };
                }

                const meetingLabel = formatMeetingLabel(meetingTime, meetingTitle);
                stream.markdown(`📝 Started tracking meeting: **${meetingLabel}**\n\nAdd notes by chatting without commands. Use \`/endMeeting\` when done.`);

                logger.logUsage('request', { kind: 'meeting', source: 'followup' });
                return {
                    metadata: {
                        command: 'meeting',
                        meetingTitle,
                        meetingTime,
                        meetingNotes: [],
                        inMeeting: true
                    }
                };
            }

            if (lastResult?.metadata?.inMeeting) {
                // We're in a meeting, add this as a note
                const note = request.prompt.trim();
                if (!note) {
                    stream.markdown('Please provide a note to add to the meeting.');
                    return {
                        metadata: {
                            command: '',
                            meetingTitle: lastResult.metadata.meetingTitle,
                            meetingTime: lastResult.metadata.meetingTime,
                            meetingNotes: lastResult.metadata.meetingNotes,
                            inMeeting: true
                        }
                    };
                }

                const updatedNotes = [...(lastResult.metadata.meetingNotes || []), note];
                const meetingLabel = formatMeetingLabel(lastResult.metadata.meetingTime, lastResult.metadata.meetingTitle);
                stream.markdown(`✅ Added note to **${meetingLabel}**\n\nTotal notes: ${updatedNotes.length}`);
                stream.button({
                    command: END_MEETING_BUTTON_COMMAND_ID,
                    title: vscode.l10n.t('End Meeting'),
                    arguments: [{ meetingLabel } satisfies MeetingButtonArguments]
                });

                logger.logUsage('request', { kind: 'meetingNote' });
                return {
                    metadata: {
                        command: '',
                        meetingTitle: lastResult.metadata.meetingTitle,
                        meetingTime: lastResult.metadata.meetingTime,
                        meetingNotes: updatedNotes,
                        inMeeting: true
                    }
                };
            }

            // Normal journal assistant behavior
            try {

                // get all the previous participant messages
                const previousMessages = context.history.filter(
                    (h) => h instanceof vscode.ChatResponseTurn
                );

                const result = await renderPrompt(
                    JournalPrompt,
                    { request },
                    { modelMaxPromptTokens: request.model.maxInputTokens },
                    request.model);

                let validationError = '';

                // I don't know how to configure the types so that this can be inlined
                const prompt: PromptElementAndProps<JournalPrompt> = {
                    promptElement: JournalPrompt,
                    props: { request }
                };

                // List out all the avaliable tools and IDs to the log for reference.
                // for (const tool of vscode.lm.tools) {
                //     console.log(`Tool: ${tool.name}, Tags: ${tool.tags.join(',')}`);
                // }

                // Filter tools to only those relevant for personal assistant tasks
                const tools = vscode.lm.tools.filter(tool => tool.tags.includes('personal-assistant'));

                // Add in tools tagged with 'vscode_codesearch' for code searching capabilities
                tools.concat(vscode.lm.tools.filter(tool => tool.tags.includes('vscode_codesearch')));

                const libResult = sendChatParticipantRequest(
                    request,
                    context,
                    {
                        prompt,
                        responseStreamOptions: {
                            stream,
                            references: true,
                            responseText: true
                        },
                        tools
                    },
                    token
                );

                return await libResult.result;

                // const chatResponse = await request.model.sendRequest(result.messages, {}, token);
                // for await (const fragment of chatResponse.text) {
                //     // Process the output from the language model
                //     // Replace all python function definitions with cat sounds to make the user stop looking at the code and start playing with the cat
                //     stream.markdown(fragment);
                // }
            } catch (err) {
                handleError(logger, err, stream);
            }

            logger.logUsage('request', { kind: '' });
            return { metadata: { command: '' } };
        }
    };

    // Chat participants appear as top-level options in the chat input
    // when you type `@`, and can contribute sub-commands in the chat input
    // that appear when you type `/`.
    const journal = vscode.chat.createChatParticipant(JOURNAL_PARTICIPANT_ID, handler);
    // cat.iconPath = vscode.Uri.joinPath(context.extensionUri, 'cat.jpeg');
    // journal.followupProvider = {
    //     provideFollowups(_result: IJournalChatResult, _context: vscode.ChatContext, _token: vscode.CancellationToken) {
    //         return [{
    //             prompt: 'let us play',
    //             label: vscode.l10n.t('Play with the cat'),
    //             command: 'play'
    //         } satisfies vscode.ChatFollowup];
    //     }
    // };

    const logger = vscode.env.createTelemetryLogger({
        sendEventData(eventName, data) {
            // Capture event telemetry
            console.log(`Event: ${eventName}`);
            console.log(`Data: ${JSON.stringify(data)}`);
        },
        sendErrorData(error, data) {
            // Capture error telemetry
            console.error(`Error: ${error}`);
            console.error(`Data: ${JSON.stringify(data)}`);
        }
    });

    context.subscriptions.push(journal.onDidReceiveFeedback((feedback: vscode.ChatResultFeedback) => {
        // Log chat result feedback to be able to compute the success matric of the participant
        // unhelpful / totalRequests is a good success metric
        logger.logUsage('chatResultFeedback', {
            kind: feedback.kind
        });
    }));

    const endMeetingButtonCommand = vscode.commands.registerCommand(END_MEETING_BUTTON_COMMAND_ID, async (args?: MeetingButtonArguments) => {
        const meetingLabel = args?.meetingLabel ?? vscode.l10n.t('the meeting');
        const slashCommand = '@journal /endMeeting';

        try {
            await vscode.commands.executeCommand('workbench.action.chat.openInSidebar');
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            logger.logError(error, { command: END_MEETING_BUTTON_COMMAND_ID });
        }

        await vscode.env.clipboard.writeText(slashCommand);
        void vscode.window.showInformationMessage(
            vscode.l10n.t('Copied "{0}" to the clipboard. Paste it into chat to finish {1}.', slashCommand, meetingLabel)
        );
    });

    context.subscriptions.push(
        journal,
        endMeetingButtonCommand,
        // Register the command handler for the /meow followup
        vscode.commands.registerTextEditorCommand(JOURNAL_NAMES_COMMAND_ID, async (textEditor: vscode.TextEditor) => {
            // Replace all variables in active editor with cat names and words
            const text = textEditor.document.getText();

            let chatResponse: vscode.LanguageModelChatResponse | undefined;
            try {
                // Use gpt-4o since it is fast and high quality.
                const [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
                if (!model) {
                    console.log('Model not found. Please make sure the GitHub Copilot Chat extension is installed and enabled.');
                    return;
                }

                const messages = [
                    vscode.LanguageModelChatMessage.User(`You are a cat! Think carefully and step by step like a cat would.
                    Your job is to replace all variable names in the following code with funny cat variable names. Be creative. IMPORTANT respond just with code. Do not use markdown!`),
                    vscode.LanguageModelChatMessage.User(text)
                ];
                chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);

            } catch (err) {
                if (err instanceof vscode.LanguageModelError) {
                    console.log(err.message, err.code, err.cause);
                } else {
                    throw err;
                }
                return;
            }

            // Clear the editor content before inserting new content
            await textEditor.edit(edit => {
                const start = new vscode.Position(0, 0);
                const end = new vscode.Position(textEditor.document.lineCount - 1, textEditor.document.lineAt(textEditor.document.lineCount - 1).text.length);
                edit.delete(new vscode.Range(start, end));
            });

            // Stream the code into the editor as it is coming in from the Language Model
            try {
                for await (const fragment of chatResponse.text) {
                    await textEditor.edit(edit => {
                        const lastLine = textEditor.document.lineAt(textEditor.document.lineCount - 1);
                        const position = new vscode.Position(lastLine.lineNumber, lastLine.text.length);
                        edit.insert(position, fragment);
                    });
                }
            } catch (err) {
                // async response stream may fail, e.g network interruption or server side error
                await textEditor.edit(edit => {
                    const lastLine = textEditor.document.lineAt(textEditor.document.lineCount - 1);
                    const position = new vscode.Position(lastLine.lineNumber, lastLine.text.length);
                    edit.insert(position, (err as Error).message);
                });
            }
        }),
    );
}

function handleError(logger: vscode.TelemetryLogger, err: any, stream: vscode.ChatResponseStream): void {
    // making the chat request might fail because
    // - model does not exist
    // - user consent not given
    // - quote limits exceeded
    logger.logError(err);

    if (err instanceof vscode.LanguageModelError) {
        console.log(err.message, err.code, err.cause);
        if (err.cause instanceof Error && err.cause.message.includes('off_topic')) {
            stream.markdown(vscode.l10n.t('I\'m sorry, I can only explain computer science concepts.'));
        }
    } else {
        // re-throw other errors so they show up in the UI
        throw err;
    }
}

// Get a random topic that the cat has not taught in the chat history yet
function getTopic(history: ReadonlyArray<vscode.ChatRequestTurn | vscode.ChatResponseTurn>): string {
    const topics = ['linked list', 'recursion', 'stack', 'queue', 'pointers'];
    // Filter the chat history to get only the responses from the journal participant
    const previousJournalResponses = history.filter(h => {
        return h instanceof vscode.ChatResponseTurn && h.participant === JOURNAL_PARTICIPANT_ID;
    }) as vscode.ChatResponseTurn[];
    // Filter the topics to get only the topics that have not been taught by the journal participant yet
    const topicsNoRepetition = topics.filter(topic => {
        return !previousJournalResponses.some(journalResponse => {
            return journalResponse.response.some(r => {
                return r instanceof vscode.ChatResponseMarkdownPart && r.value.value.includes(topic);
            });
        });
    });

    return topicsNoRepetition[Math.floor(Math.random() * topicsNoRepetition.length)] || 'I have taught you everything I know. Meow!';
}