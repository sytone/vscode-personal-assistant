import * as vscode from "vscode";
import { FindFilesTool } from "./FindFilesTool";
import { RunInTerminalTool } from "./RunInTerminalTool";
import { ReadJournalEntriesTool, AddJournalEntryTool, AddJournalTaskTool } from "./JournalTools";
import { CalculateRelativeDateTool, GetDateInfoTool, GetWeekDatesTool } from "./DateUtilityTools";

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
}
