import * as vscode from "vscode";
import { FindFilesTool } from "./FindFilesTool";
import { RunInTerminalTool } from "./RunInTerminalTool";
import { ReadJournalEntriesTool, AddJournalEntryTool, AddJournalTaskTool, CompleteJournalTaskTool, ReadJournalTasksTool } from "./JournalTools";
import { CalculateRelativeDateTool, GetDateInfoTool, GetWeekDatesTool } from "./DateUtilityTools";
import {
  ListFilesTool,
  SearchFilesByNameTool,
  SearchFilesByContentTool,
  SearchNotesByFrontmatterTool,
  ReadNoteTool,
  CreateNoteTool,
  UpdateNoteTool,
  UpdateNoteFrontmatterTool,
  DeleteNoteTool,
} from "./NoteManagementTools";

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
      new ReadJournalEntriesTool()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "journal-tools_addJournalEntry",
      new AddJournalEntryTool()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "journal-tools_addJournalTask",
      new AddJournalTaskTool()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "journal-tools_completeJournalTask",
      new CompleteJournalTaskTool()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "journal-tools_readJournalTasks",
      new ReadJournalTasksTool()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "date-utility-tools_calculateRelativeDate",
      new CalculateRelativeDateTool()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "date-utility-tools_getDateInfo",
      new GetDateInfoTool()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "date-utility-tools_getWeekDates",
      new GetWeekDatesTool()
    )
  );

  // Note Management Tools
  context.subscriptions.push(
    vscode.lm.registerTool(
      "note-management-tools_listFiles",
      new ListFilesTool()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "note-management-tools_searchFilesByName",
      new SearchFilesByNameTool()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "note-management-tools_searchFilesByContent",
      new SearchFilesByContentTool()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "note-management-tools_searchNotesByFrontmatter",
      new SearchNotesByFrontmatterTool()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "note-management-tools_readNote",
      new ReadNoteTool()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "note-management-tools_createNote",
      new CreateNoteTool()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "note-management-tools_updateNote",
      new UpdateNoteTool()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "note-management-tools_updateNoteFrontmatter",
      new UpdateNoteFrontmatterTool()
    )
  );
  context.subscriptions.push(
    vscode.lm.registerTool(
      "note-management-tools_deleteNote",
      new DeleteNoteTool()
    )
  );
}
