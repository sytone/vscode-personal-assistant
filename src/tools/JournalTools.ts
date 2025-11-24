import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";
import { getJournalTemplateName, getVaultRoot } from "../extension";
import { dateService } from "../services/DateService";
import { templateService } from "../services/TemplateService";

// Constants
const TIME_FORMAT = "HH:mm";
const DEFAULT_JOURNAL_PATH = "1 Journal";
const DEFAULT_TASKS_HEADING = "## Tasks This Week";
const EOL = os.EOL; // Platform-specific line ending

// Regex patterns
const DAY_SECTION_HEADER_REGEX = /^##\s+\d{1,2}\s+\w+\s*$/;
const DAY_SECTION_HEADER_WITH_CAPTURE_REGEX = /^##\s+(\d{1,2})\s+\w+\s*$/;
const LEVEL2_HEADING_REGEX = /^##\s+/;
const TITLE_HEADING_REGEX = /^#\s+/;

// Task-related types and helpers

interface ParsedTask {
  line: string;
  description: string;
  completed: boolean;
  indent: number;
  lineIndex: number;
}

/**
 * Parses task lines from content and extracts task information.
 * @param content The markdown content containing tasks
 * @returns Array of parsed tasks with their metadata
 */
function parseTasksFromContent(content: string): ParsedTask[] {
  const lines = content.split(/\r?\n/);
  const tasks: ParsedTask[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const taskMatch = line.match(/^(\s*)- \[([ x])\] (.+)$/);
    if (taskMatch) {
      const [, indentStr, checkbox, description] = taskMatch;
      tasks.push({
        line: line,
        description: description.trim(),
        completed: checkbox === 'x',
        indent: indentStr.length,
        lineIndex: i
      });
    }
  }
  
  return tasks;
}

/**
 * Finds a task by partial description match.
 * @param tasks Array of parsed tasks
 * @param searchDescription Description to search for (supports partial matching)
 * @returns The matching task or undefined
 */
function findTaskByDescription(tasks: ParsedTask[], searchDescription: string): ParsedTask | undefined {
  const searchLower = searchDescription.toLowerCase().trim();
  
  // First try exact match
  const exactMatch = tasks.find(task => task.description.toLowerCase() === searchLower);
  if (exactMatch) {
    return exactMatch;
  }
  
  // Then try partial match
  return tasks.find(task => task.description.toLowerCase().includes(searchLower));
}

/**
 * Finds the tasks section in content and returns its boundaries.
 * @param content The markdown content
 * @param tasksHeading The heading to look for (e.g., "## Tasks This Week")
 * @returns Object with start and end indices, or null if not found
 */
function findTasksSection(content: string, tasksHeading: string): { startIndex: number; endIndex: number } | null {
  const lines = content.split(/\r?\n/);
  const tasksIndex = lines.findIndex((l) => l.trim() === tasksHeading);
  
  if (tasksIndex < 0) {
    return null;
  }
  
  // Find the end of the tasks section (next level 2 heading or end of file)
  let endIndex = lines.length;
  for (let i = tasksIndex + 1; i < lines.length; i++) {
    if (LEVEL2_HEADING_REGEX.test(lines[i])) {
      endIndex = i;
      break;
    }
  }
  
  return { startIndex: tasksIndex, endIndex };
}

/**
 * Formats tasks with proper hierarchy and completion status for display.
 * @param tasks Array of parsed tasks
 * @param showCompleted Whether to include completed tasks
 * @param showIncomplete Whether to include incomplete tasks
 * @returns Formatted task list as string
 */
function formatTasksForDisplay(tasks: ParsedTask[], showCompleted = true, showIncomplete = true): string {
  const filteredTasks = tasks.filter(task => {
    if (task.completed && !showCompleted) {
      return false;
    }
    if (!task.completed && !showIncomplete) {
      return false;
    }
    return true;
  });
  
  if (filteredTasks.length === 0) {
    return '';
  }
  
  const taskLines = filteredTasks.map(task => {
    const indent = ' '.repeat(task.indent);
    const checkbox = task.completed ? '[x]' : '[ ]';
    return `${indent}- ${checkbox} ${task.description}`;
  });
  
  // Add summary statistics
  const total = filteredTasks.length;
  const completed = filteredTasks.filter(t => t.completed).length;
  const incomplete = total - completed;
  
  const summary = `Summary: ${total} total, ${completed} completed, ${incomplete} incomplete`;
  
  return `${summary}\n\n${taskLines.join('\n')}`;
}

// Helper functions

function getJournalPath(): string {
  const config = vscode.workspace.getConfiguration("personal-assistant");
  return config.get<string>("journalFolderName") || DEFAULT_JOURNAL_PATH;
}

function getTasksHeading(): string {
  const config = vscode.workspace.getConfiguration("personal-assistant");
  let heading = config.get<string>("journalTasksHeading") || DEFAULT_TASKS_HEADING;
  if (heading && !heading.startsWith("#")) {
    heading = `## ${heading}`;
  }
  return heading;
}

async function resolveWeeklyFilePath(journalPath: string, isoYear: number, isoWeek: number, workspaceRoot: string): Promise<string> {
  const weeklyFileName = `${isoYear}-W${isoWeek.toString().padStart(2, "0")}.md`;
  
  // Try common locations
  const candidatePaths = [
    path.join(workspaceRoot, journalPath, isoYear.toString(), weeklyFileName),
    path.join(workspaceRoot, journalPath, weeklyFileName),
  ];

  for (const filePath of candidatePaths) {
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      // File doesn't exist, continue
    }
  }

  // Return default path for creation
  return path.join(workspaceRoot, journalPath, isoYear.toString(), weeklyFileName);
}

async function loadOrCreateWeeklyContent(weeklyFilePath: string, isoYear: number, isoWeek: number): Promise<string> {
  try {
    return await fs.readFile(weeklyFilePath, "utf-8");
  } catch {
    const templated = await renderWeeklyTemplate(isoYear, isoWeek);
    if (templated) {
      return templated;
    }
    return createWeeklyStub(isoYear, isoWeek);
  }
}

/**
 * Attempts to seed a new weekly journal file from a vault template.
 *
 * @param isoYear - ISO year for the week
 * @param isoWeek - ISO week number
 * @returns Rendered template content or null if the template cannot be resolved
 */
async function renderWeeklyTemplate(isoYear: number, isoWeek: number): Promise<string | null> {
  try {
    const monday = dateService.getMonday(isoYear, isoWeek);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return {
        dayNumber: date.getDate(),
        dayName: date.toLocaleDateString("en-US", { weekday: "long" }),
        isoDate: dateService.formatDate(date)
      };
    });

    const templateName = getJournalTemplateName();
    return await templateService.renderTemplate(templateName, {
      year: isoYear,
      weekNumber: isoWeek,
      days
    });
  } catch {
    return null;
  }
}

function createWeeklyStub(isoYear: number, isoWeek: number): string {
  const monday = dateService.getMonday(isoYear, isoWeek);
  const lines: string[] = [];
  
  lines.push(`# Week ${isoWeek} in ${isoYear}`);
  lines.push("");
  
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(day.getDate() + i);
    lines.push(`## ${day.getDate()} ${day.toLocaleDateString("en-US", { weekday: "long" })}`);
    lines.push("");
  }
  
  return lines.join(EOL);
}

async function writeJournalContent(weeklyFilePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(weeklyFilePath), { recursive: true });
  await fs.writeFile(weeklyFilePath, content, "utf-8");
}

function insertNewSection(lines: string[], sectionHeading: string, contentLine: string): void {
  const titleIndex = lines.findIndex((l) => TITLE_HEADING_REGEX.test(l));
  
  if (titleIndex >= 0) {
    let insertIndex = titleIndex + 1;
    while (insertIndex < lines.length && !lines[insertIndex].trim()) {
      insertIndex++;
    }
    if (insertIndex > 0 && lines[insertIndex - 1].trim()) {
      lines.splice(insertIndex, 0, "");
      insertIndex++;
    }
    lines.splice(insertIndex, 0, sectionHeading, "", contentLine, "");
  } else {
    if (lines.length > 0 && lines[lines.length - 1].trim()) {
      lines.push("");
    }
    lines.push(sectionHeading, "", contentLine);
  }
}

/**
 * Formats markdown content using markdownlint to ensure proper spacing.
 * Rules applied:
 * - MD012: No multiple consecutive blank lines
 * - MD022: Headings should be surrounded by blank lines
 * - MD032: Lists should be surrounded by blank lines
 * @param content The markdown content to format
 * @returns The formatted content with proper spacing
 */
async function formatMarkdownContent(content: string): Promise<string> {
  try {
    // Dynamically import markdownlint modules and custom rule
    const [{ lint }, { applyFixes }, customRuleModule] = await Promise.all([
      import("markdownlint/async"),
      import("markdownlint"),
      import("./markdownlint-rules/no-blank-lines-in-lists.js")
    ]);

    const noBlankLinesInLists = customRuleModule.noBlankLinesInLists;

    const options = {
      strings: {
        content: content,
      },
      customRules: [noBlankLinesInLists],
      config: {
        // Disable all rules by default
        default: false,
        // Enable only spacing-related rules
        "MD012": true, // no-multiple-blanks: No multiple consecutive blank lines
        "MD022": { "lines_above": 1, "lines_below": 1 }, // blanks-around-headings: One blank line before/after headings
        // MD032 is disabled because it adds blank lines around lists, conflicting with our custom rule
        "MD047": true, // single-trailing-newline: Files should end with a single newline
        // Enable custom rule
        "no-blank-lines-in-lists": true,
      },
    };

    return new Promise((resolve) => {
      lint(options, (err: unknown, results?: any) => {
        if (err || !results) {
          console.error("Error linting markdown:", err);
          resolve(content);
          return;
        }

        const errors = results.content || [];
        console.log(`Found ${errors.length} formatting issues`);
        
        if (errors.length > 0) {
          // Apply all fixes
          const fixed = applyFixes(content, errors);
          console.log('Applied fixes');
          resolve(fixed);
        } else {
          resolve(content);
        }
      });
    });
  } catch (err) {
    // If import or linting fails, return original content
    console.error("Error formatting markdown:", err);
    return content;
  }
}

// ===== TOOL CLASSES =====

interface IReadJournalEntriesParameters {
  journalPath?: string;
  fromDate?: string;
  toDate?: string;
  maxEntries?: number;
  includeContent?: boolean;
}

export class ReadJournalEntriesTool implements vscode.LanguageModelTool<IReadJournalEntriesParameters> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IReadJournalEntriesParameters>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const params = options.input;
    const journalPath = params.journalPath || getJournalPath();
    const maxEntries = params.maxEntries || 10;
    const includeContent = params.includeContent !== false;
    
    const workspaceRoot = getVaultRoot();
    if (!workspaceRoot) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart("No vault root configured. Please open a workspace or configure personal-assistant.vaultPath."),
      ]);
    }

    const fullJournalPath = path.join(workspaceRoot, journalPath);
    
    try {
      // Check if directory exists
      try {
        await fs.access(fullJournalPath);
      } catch {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart("No journal entries found."),
        ]);
      }

      const fromDate = params.fromDate ? dateService.parseLocalDate(params.fromDate) || undefined : undefined;
      const toDate = params.toDate ? dateService.parseLocalDate(params.toDate) || undefined : undefined;

      // Enumerate all markdown files in the journal directory
      const entries: Array<{ relPath: string; date: Date }> = [];
      
      async function enumerateMarkdownFiles(dir: string): Promise<void> {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            await enumerateMarkdownFiles(fullPath);
          } else if (item.isFile() && item.name.toLowerCase().endsWith(".md")) {
            const relativePath = path.relative(fullJournalPath, fullPath);
            const stat = await fs.stat(fullPath);
            const extractedDate = dateService.extractDateFromPath(relativePath);
            const date = extractedDate || stat.mtime;
            entries.push({ relPath: relativePath, date });
          }
        }
      }

      await enumerateMarkdownFiles(fullJournalPath);

      const filteredEntries = entries
        .filter((e) => dateService.isDateInRange(e.date, fromDate, toDate))
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, Math.max(1, maxEntries));

      if (filteredEntries.length === 0) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart("No journal entries found."),
        ]);
      }

      if (!includeContent) {
        const list = filteredEntries.map((e) => {
          const dateStr = e.date.toISOString().split("T")[0];
          return `${dateStr} | ${e.relPath}`;
        });
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(list.join("\n")),
        ]);
      }

      const result: string[] = [];
      for (let i = 0; i < filteredEntries.length; i++) {
        const entry = filteredEntries[i];
        try {
          const filePath = path.join(fullJournalPath, entry.relPath);
          const content = await fs.readFile(filePath, "utf-8");
          if (i > 0) {
            result.push("\n---\n");
          }
          result.push(`Date: ${entry.date.toISOString().split("T")[0]}`);
          result.push(`File: ${entry.relPath}`);
          result.push("");
          result.push(content);
        } catch (err) {
          result.push(`<Error reading file: ${err}>`);
        }
      }

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(result.join("\n")),
      ]);
    } catch (err) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error reading journal entries: ${err}`),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<IReadJournalEntriesParameters>,
    _token: vscode.CancellationToken
  ) {
    const journalPath = options.input.journalPath || getJournalPath();
    return {
      invocationMessage: `Reading journal entries from "${journalPath}"`,
    };
  }
}

interface IAddJournalEntryParameters {
  entryContent: string;
  journalPath?: string;
  date?: string;
}

export class AddJournalEntryTool implements vscode.LanguageModelTool<IAddJournalEntryParameters> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IAddJournalEntryParameters>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const params = options.input;
    
    if (!params.entryContent || !params.entryContent.trim()) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart("No content provided."),
      ]);
    }

    const journalPath = params.journalPath || getJournalPath();
    const workspaceRoot = getVaultRoot();
    
    if (!workspaceRoot) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart("No vault root configured. Please open a workspace or configure personal-assistant.vaultPath."),
      ]);
    }

    try {
      const targetDate = params.date ? dateService.parseLocalDate(params.date) || new Date() : new Date();
      const { year: isoYear, week: isoWeek } = dateService.getISOWeek(targetDate);
      
      const weeklyFilePath = await resolveWeeklyFilePath(journalPath, isoYear, isoWeek, workspaceRoot);
      const content = await loadOrCreateWeeklyContent(weeklyFilePath, isoYear, isoWeek);
      
      const heading = `## ${targetDate.getDate()} ${targetDate.toLocaleDateString("en-US", { weekday: "long" })}`;
      const lines = content.split(/\r?\n/);
      const headingIndex = lines.findIndex((l) => l.trim() === heading);
      
      const timePrefix = dateService.formatTime(new Date());
      
      // Clean up the entry content:
      // 1. Remove leading dash if present
      // 2. Remove leading timestamp (HH:mm - format)
      let entryToInsert = params.entryContent.trimEnd();
      
      // Strip leading dash
      if (entryToInsert.startsWith("- ")) {
        entryToInsert = entryToInsert.substring(2);
      } else if (entryToInsert.startsWith("-")) {
        entryToInsert = entryToInsert.substring(1).trimStart();
      }
      
      // Strip leading timestamp pattern (HH:mm - )
      const timestampPattern = /^\d{1,2}:\d{2}\s*-\s*/;
      if (timestampPattern.test(entryToInsert)) {
        entryToInsert = entryToInsert.replace(timestampPattern, '');
      }
      
      if (headingIndex >= 0) {
        // Heading exists: Insert after the last line of this section
        let insertIndex = headingIndex + 1;
        
        // Skip the blank line after the heading (if present)
        if (insertIndex < lines.length && !lines[insertIndex].trim()) {
          insertIndex++;
        }
        
        // Find the end of this day's section (next day heading or end of file)
        let sectionEndIndex = insertIndex;
        while (sectionEndIndex < lines.length && !DAY_SECTION_HEADER_REGEX.test(lines[sectionEndIndex])) {
          sectionEndIndex++;
        }
        
        // Insert the new entry at the end of this section
        lines.splice(sectionEndIndex, 0, `- ${timePrefix} - ${entryToInsert}`);
      } else {
        // Heading not found: find correct insertion point to maintain sequential day order
        const targetDay = targetDate.getDate();
        let insertBeforeIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
          const match = DAY_SECTION_HEADER_WITH_CAPTURE_REGEX.exec(lines[i]);
          if (match) {
            const dayNum = parseInt(match[1]);
            if (dayNum > targetDay) {
              insertBeforeIndex = i;
              break;
            }
          }
        }
        
        if (insertBeforeIndex >= 0) {
          // Insert the new heading before the found heading
          if (insertBeforeIndex > 0 && lines[insertBeforeIndex - 1].trim()) {
            lines.splice(insertBeforeIndex, 0, "");
            insertBeforeIndex++;
          }
          // Add heading, blank line, then entry
          lines.splice(insertBeforeIndex, 0, heading, "", `- ${timePrefix} - ${entryToInsert}`);
        } else {
          // No later days found: append at end
          if (lines.length > 0 && lines[lines.length - 1].trim()) {
            lines.push("");
          }
          // Add heading, blank line, then entry
          lines.push(heading, "", `- ${timePrefix} - ${entryToInsert}`);
        }
      }
      
      const updatedContent = lines.join(EOL);
      const formattedContent = await formatMarkdownContent(updatedContent);
      await writeJournalContent(weeklyFilePath, formattedContent);
      
      const relativePath = path.relative(workspaceRoot, weeklyFilePath);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Added entry to ${relativePath} under '${heading}'.`),
      ]);
    } catch (err) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error adding journal entry: ${err}`),
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

interface IAddJournalTaskParameters {
  taskDescription: string;
  journalPath?: string;
  date?: string;
  completed?: boolean;
  parentTask?: string;
  childTasks?: string[];
}

interface ICompleteJournalTaskParameters {
  taskDescription: string;
  journalPath?: string;
  date?: string;
}

interface IReadJournalTasksParameters {
  journalPath?: string;
  date?: string;
  showCompleted?: boolean;
  showIncomplete?: boolean;
}

export class AddJournalTaskTool implements vscode.LanguageModelTool<IAddJournalTaskParameters> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IAddJournalTaskParameters>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const params = options.input;
    
    if (!params.taskDescription || !params.taskDescription.trim()) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart("No task description provided."),
      ]);
    }

    const journalPath = params.journalPath || getJournalPath();
    const tasksHeading = getTasksHeading();
    const workspaceRoot = getVaultRoot();
    
    if (!workspaceRoot) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart("No vault root configured. Please open a workspace or configure personal-assistant.vaultPath."),
      ]);
    }

    try {
      const targetDate = params.date ? dateService.parseLocalDate(params.date) || new Date() : new Date();
      const { year: isoYear, week: isoWeek } = dateService.getISOWeek(targetDate);
      
      const weeklyFilePath = await resolveWeeklyFilePath(journalPath, isoYear, isoWeek, workspaceRoot);
      const content = await loadOrCreateWeeklyContent(weeklyFilePath, isoYear, isoWeek);
      
      const lines = content.split(/\r?\n/);
      const tasksIndex = lines.findIndex((l) => l.trim() === tasksHeading);
      
      const checkbox = params.completed ? "[x]" : "[ ]";
      
      // Handle parent task scenario
      if (params.parentTask) {
        if (tasksIndex < 0) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart("No tasks section found to add child task."),
          ]);
        }
        
        // Find the parent task
        const tasksSection = findTasksSection(content, tasksHeading);
        if (!tasksSection) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart("No tasks section found to add child task."),
          ]);
        }
        
        const tasksContent = lines.slice(tasksSection.startIndex, tasksSection.endIndex).join('\n');
        const tasks = parseTasksFromContent(tasksContent);
        const parentTask = findTaskByDescription(tasks, params.parentTask);
        
        if (!parentTask) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Parent task not found: "${params.parentTask}".`),
          ]);
        }
        
        // Add child task after the parent (with proper indentation)
        const parentLineIndex = tasksSection.startIndex + parentTask.lineIndex;
        const childTaskLine = `  - ${checkbox} ${params.taskDescription.trim()}`;
        
        // Find where to insert child (after parent and any existing children)
        let insertIndex = parentLineIndex + 1;
        while (insertIndex < tasksSection.endIndex && 
               lines[insertIndex].match(/^\s{2,}- \[[x ]\]/)) {
          insertIndex++;
        }
        
        lines.splice(insertIndex, 0, childTaskLine);
      } else {
        // Handle standalone task or parent with children
        const taskLine = `- ${checkbox} ${params.taskDescription.trim()}`;
        const childTasks = params.childTasks || [];
        
        const taskLines = [taskLine];
        childTasks.forEach(childTask => {
          taskLines.push(`  - [ ] ${childTask.trim()}`);
        });
        
        if (tasksIndex >= 0) {
          // Tasks section exists: find where to insert the new task
          let insertIndex = tasksIndex + 1;
          
          // Skip the blank line after the heading (if present)
          if (insertIndex < lines.length && !lines[insertIndex].trim()) {
            insertIndex++;
          }
          
          // Insert all task lines (parent + children)
          lines.splice(insertIndex, 0, ...taskLines);
        } else {
          // Tasks section doesn't exist: create it after the title
          insertNewSection(lines, tasksHeading, taskLines[0]);
          
          // Add child tasks if any
          if (childTasks.length > 0) {
            const newTasksIndex = lines.findIndex((l) => l.trim() === tasksHeading);
            let insertIndex = newTasksIndex + 1;
            
            // Skip blank line after heading
            if (insertIndex < lines.length && !lines[insertIndex].trim()) {
              insertIndex++;
            }
            
            // Skip the parent task we just added
            if (insertIndex < lines.length && lines[insertIndex].includes(params.taskDescription)) {
              insertIndex++;
            }
            
            // Add child tasks
            lines.splice(insertIndex, 0, ...taskLines.slice(1));
          }
        }
      }
      
      const updatedContent = lines.join(EOL);
      const formattedContent = await formatMarkdownContent(updatedContent);
      await writeJournalContent(weeklyFilePath, formattedContent);
      
      const relativePath = path.relative(workspaceRoot, weeklyFilePath);
      
      let message = `Added task to ${relativePath} under '${tasksHeading}'.`;
      if (params.parentTask) {
        message = `Added child task to "${params.parentTask}" in ${relativePath}.`;
      } else if (params.childTasks && params.childTasks.length > 0) {
        message = `Added parent task with ${params.childTasks.length} child tasks to ${relativePath}.`;
      }
      
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(message),
      ]);
    } catch (err) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error adding journal task: ${err}`),
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

export class CompleteJournalTaskTool implements vscode.LanguageModelTool<ICompleteJournalTaskParameters> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ICompleteJournalTaskParameters>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const params = options.input;
    
    if (!params.taskDescription || !params.taskDescription.trim()) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart("No task description provided."),
      ]);
    }

    const journalPath = params.journalPath || getJournalPath();
    const tasksHeading = getTasksHeading();
    const workspaceRoot = getVaultRoot();
    
    if (!workspaceRoot) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart("No vault root configured. Please open a workspace or configure personal-assistant.vaultPath."),
      ]);
    }

    try {
      const targetDate = params.date ? dateService.parseLocalDate(params.date) || new Date() : new Date();
      const { year: isoYear, week: isoWeek } = dateService.getISOWeek(targetDate);
      
      const weeklyFilePath = await resolveWeeklyFilePath(journalPath, isoYear, isoWeek, workspaceRoot);
      const content = await loadOrCreateWeeklyContent(weeklyFilePath, isoYear, isoWeek);
      
      const tasksSection = findTasksSection(content, tasksHeading);
      if (!tasksSection) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart("No tasks section found in the weekly journal."),
        ]);
      }

      const lines = content.split(/\r?\n/);
      const tasksContent = lines.slice(tasksSection.startIndex, tasksSection.endIndex).join('\n');
      const tasks = parseTasksFromContent(tasksContent);
      
      const taskToComplete = findTaskByDescription(tasks, params.taskDescription);
      if (!taskToComplete) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`Task "${params.taskDescription}" not found.`),
        ]);
      }

      // Mark the task as completed
      const actualLineIndex = tasksSection.startIndex + taskToComplete.lineIndex;
      const updatedLine = lines[actualLineIndex].replace(/- \[ \]/, '- [x]');
      lines[actualLineIndex] = updatedLine;
      
      const updatedContent = lines.join(EOL);
      const formattedContent = await formatMarkdownContent(updatedContent);
      await writeJournalContent(weeklyFilePath, formattedContent);
      
      const relativePath = path.relative(workspaceRoot, weeklyFilePath);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Task "${taskToComplete.description}" marked as completed in ${relativePath}.`),
      ]);
    } catch (err) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error completing journal task: ${err}`),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<ICompleteJournalTaskParameters>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: `Marking journal task as completed`,
    };
  }
}

export class ReadJournalTasksTool implements vscode.LanguageModelTool<IReadJournalTasksParameters> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IReadJournalTasksParameters>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const params = options.input;
    const journalPath = params.journalPath || getJournalPath();
    const tasksHeading = getTasksHeading();
    const workspaceRoot = getVaultRoot();
    
    if (!workspaceRoot) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart("No vault root configured. Please open a workspace or configure personal-assistant.vaultPath."),
      ]);
    }

    try {
      const targetDate = params.date ? dateService.parseLocalDate(params.date) || new Date() : new Date();
      const { year: isoYear, week: isoWeek } = dateService.getISOWeek(targetDate);
      
      const weeklyFilePath = await resolveWeeklyFilePath(journalPath, isoYear, isoWeek, workspaceRoot);
      const content = await loadOrCreateWeeklyContent(weeklyFilePath, isoYear, isoWeek);
      
      const tasksSection = findTasksSection(content, tasksHeading);
      if (!tasksSection) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart("No tasks found for this week."),
        ]);
      }

      const tasksContent = content.split(/\r?\n/).slice(tasksSection.startIndex, tasksSection.endIndex).join('\n');
      const tasks = parseTasksFromContent(tasksContent);
      
      if (tasks.length === 0) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart("No tasks found for this week."),
        ]);
      }

      const showCompleted = params.showCompleted !== false;
      const showIncomplete = params.showIncomplete !== false;
      
      const formattedTasks = formatTasksForDisplay(tasks, showCompleted, showIncomplete);
      
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(formattedTasks),
      ]);
    } catch (err) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error reading journal tasks: ${err}`),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<IReadJournalTasksParameters>,
    _token: vscode.CancellationToken
  ) {
    const journalPath = options.input.journalPath || getJournalPath();
    return {
      invocationMessage: `Reading tasks from "${journalPath}"`,
    };
  }
}
