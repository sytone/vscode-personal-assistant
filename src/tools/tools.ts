import * as vscode from "vscode";
import { FindFilesTool } from "./FindFilesTool";
import { RunInTerminalTool } from "./RunInTerminalTool";
import {
	AddJournalEntryToolAdapter,
	ReadJournalEntriesToolAdapter,
	AddJournalTaskToolAdapter,
	CompleteJournalTaskToolAdapter,
	ReadJournalTasksToolAdapter,
} from "../adapters/vscode/tools/JournalToolAdapters";
import {
	CalculateRelativeDateToolAdapter,
	GetDateInfoToolAdapter,
	GetWeekDatesToolAdapter,
} from "../adapters/vscode/tools/DateUtilityToolAdapters";
import {
	ListFilesToolAdapter,
	SearchFilesByNameToolAdapter,
	SearchFilesByContentToolAdapter,
	SearchNotesByFrontmatterToolAdapter,
	ReadNoteToolAdapter,
	CreateNoteToolAdapter,
	UpdateNoteToolAdapter,
	UpdateNoteFrontmatterToolAdapter,
	DeleteNoteToolAdapter,
} from "../adapters/vscode/tools/NoteManagementToolAdapters";

export function registerChatTools(context: vscode.ExtensionContext) {
  // context.subscriptions.push(vscode.lm.registerTool('chat-tools-sample_tabCount', new TabCountTool()));
  context.subscriptions.push(
    vscode.lm.registerTool("chat-tools-sample_findFiles", new FindFilesTool())
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "chat-tools-sample_runInTerminal",
      new RunInTerminalTool()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "journal-tools_readJournalEntries",
      new ReadJournalEntriesToolAdapter()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "journal-tools_addJournalEntry",
      new AddJournalEntryToolAdapter()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "journal-tools_addJournalTask",
      new AddJournalTaskToolAdapter()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "journal-tools_completeJournalTask",
      new CompleteJournalTaskToolAdapter()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "journal-tools_readJournalTasks",
      new ReadJournalTasksToolAdapter()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "date-utility-tools_calculateRelativeDate",
      new CalculateRelativeDateToolAdapter()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "date-utility-tools_getDateInfo",
      new GetDateInfoToolAdapter()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "date-utility-tools_getWeekDates",
      new GetWeekDatesToolAdapter()
    )
  );

  // Note Management Tools
  context.subscriptions.push(
    vscode.lm.registerTool(
      "note-management-tools_listFiles",
      new ListFilesToolAdapter()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "note-management-tools_searchFilesByName",
      new SearchFilesByNameToolAdapter()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "note-management-tools_searchFilesByContent",
      new SearchFilesByContentToolAdapter()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "note-management-tools_searchNotesByFrontmatter",
      new SearchNotesByFrontmatterToolAdapter()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "note-management-tools_readNote",
      new ReadNoteToolAdapter()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "note-management-tools_createNote",
      new CreateNoteToolAdapter()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "note-management-tools_updateNote",
      new UpdateNoteToolAdapter()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "note-management-tools_updateNoteFrontmatter",
      new UpdateNoteFrontmatterToolAdapter()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "note-management-tools_deleteNote",
      new DeleteNoteToolAdapter()
    )
  );
}
