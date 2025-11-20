import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  parseMarkdown,
  stringifyMarkdown,
  updateFrontmatter as updateFrontmatterUtil,
  removeFrontmatterKeys,
} from './MarkdownUtils';
import { getVaultRoot } from '../extension';
import { templateService } from '../services/TemplateService';

/**
 * Determines if a folder should be excluded from file operations.
 * System folders like .obsidian, .git, and node_modules are skipped for security and performance.
 *
 * @param folderName - The name of the folder to check
 * @returns True if the folder should be skipped, false otherwise
 *
 * @remarks
 * This prevents traversing into:
 * - Hidden folders (starting with '.')
 * - node_modules directory
 */
function shouldSkipSystemFolder(folderName: string): boolean {
  return folderName.startsWith('.') || folderName === 'node_modules';
}

/**
 * Retrieves the configured content preview length from workspace settings.
 * Ensures the value is clamped between 50 and 2000 characters.
 *
 * @returns The content preview length in characters (50-2000)
 *
 * @remarks
 * This reads from the 'personal-assistant.contentPreviewLength' setting.
 * Default value is 200 characters if not configured.
 * The value is automatically clamped to prevent excessive content loading.
 */
function getContentPreviewLength(): number {
  const config = vscode.workspace.getConfiguration('personal-assistant');
  const length = config.get<number>('contentPreviewLength', 200);
  return Math.max(50, Math.min(2000, length));
}

/**
 * Generates a truncated preview of content for efficiency.
 * If content exceeds maxLength, it's truncated with an ellipsis.
 *
 * @param content - The full content to preview
 * @param maxLength - Maximum length of the preview (defaults to configured value)
 * @returns The original content if short enough, otherwise truncated content with '...'
 *
 * @example
 * ```typescript
 * const preview = generateContentPreview('Long content here...', 50);
 * // Returns: 'Long content here...'
 * ```
 */
function generateContentPreview(content: string, maxLength: number = getContentPreviewLength()): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.slice(0, maxLength) + '...';
}

/**
 * Recursively finds all markdown files in a directory tree.
 * Skips system folders (.obsidian, .git, hidden folders) for security and performance.
 *
 * @param rootPath - The absolute path to the vault root
 * @param folderPath - Optional relative path to search within (relative to rootPath)
 * @returns Array of relative paths to markdown files (.md extension)
 *
 * @remarks
 * - All paths in the returned array are relative to rootPath
 * - System folders are automatically excluded via shouldSkipSystemFolder()
 * - Directory read errors are silently ignored to prevent permission issues from breaking searches
 *
 * @example
 * ```typescript
 * const files = await findMarkdownFiles('/vault', 'projects/2024');
 * // Returns: ['projects/2024/note1.md', 'projects/2024/subfolder/note2.md']
 * ```
 */
async function findMarkdownFiles(
  rootPath: string,
  folderPath?: string
): Promise<string[]> {
  const results: string[]= [];
  const searchPath = folderPath ? path.join(rootPath, folderPath) : rootPath;

  try {
    const entries = await fs.readdir(searchPath, { withFileTypes: true });

    for (const entry of entries) {
      if (shouldSkipSystemFolder(entry.name)) {
        continue;
      }

      const fullPath = path.join(searchPath, entry.name);
      const relativePath = path.relative(rootPath, fullPath);

      if (entry.isDirectory()) {
        const subFiles = await findMarkdownFiles(rootPath, relativePath);
        results.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Normalize path separators to forward slashes for cross-platform consistency
        results.push(relativePath.replace(/\\/g, '/'));
      }
    }
  } catch (err) {
    // Ignore errors reading directories (permissions, etc.)
  }

  return results;
}

/**
 * Validates and resolves a note path to prevent path traversal attacks.
 * Ensures the resolved path stays within the vault root directory.
 *
 * @param vaultRoot - The absolute path to the vault root
 * @param notePath - The relative path to validate (potentially from user input)
 * @returns The absolute resolved path if valid, null if path traversal detected
 *
 * @remarks
 * This function is critical for security. It prevents attacks like:
 * - `../../../etc/passwd`
 * - `..\..\Windows\System32`
 *
 * All file operations should use this function to validate user-provided paths.
 *
 * @example
 * ```typescript
 * const safe = resolveNotePath('/vault', 'notes/file.md');
 * // Returns: '/vault/notes/file.md'
 *
 * const malicious = resolveNotePath('/vault', '../../../etc/passwd');
 * // Returns: null
 * ```
 */
function resolveNotePath(vaultRoot: string, notePath: string): string | null {
  const resolved = path.resolve(vaultRoot, notePath);
  const normalized = path.normalize(resolved);

  // Prevent path traversal attacks
  if (!normalized.startsWith(vaultRoot)) {
    return null;
  }

  return normalized;
}

// Parameter Interfaces

/** Parameters for listing markdown files in the vault. */
interface IListFilesParameters {
  /** Optional folder path relative to vault root to filter results. */
  folderPath?: string;
  /** Whether to include content previews for each file (default: false for efficiency). */
  includeContent?: boolean;
}

/** Parameters for searching files by filename pattern. */
interface ISearchFilesByNameParameters {
  /** Filename pattern to search for (case-insensitive substring match). */
  namePattern: string;
  /** Whether to include content previews for matching files (default: false). */
  includeContent?: boolean;
}

/** Parameters for searching files by content text. */
interface ISearchFilesByContentParameters {
  /** Text to search for within file contents (case-insensitive). */
  searchText: string;
  /** Whether to include full content for matching files (default: false). */
  includeContent?: boolean;
}

/** Parameters for searching notes by YAML frontmatter metadata. */
interface ISearchNotesByFrontmatterParameters {
  /** Frontmatter key to search for (e.g., 'tag', 'status'). */
  key: string;
  /** Optional value for exact match. If omitted, searches for key existence. */
  value?: string;
  /** Whether to include content previews for matching notes (default: false). */
  includeContent?: boolean;
}

/** Parameters for reading a specific note. */
interface IReadNoteParameters {
  /** Path to the note relative to vault root. */
  notePath: string;
}

/** Parameters for creating a new note. */
interface ICreateNoteParameters {
  /** Path for the new note relative to vault root. */
  notePath: string;
  /** Markdown content of the note (without frontmatter). */
  content: string;
  /** Optional YAML frontmatter as key-value pairs. */
  frontmatter?: Record<string, any>;
  /** Optional template identifier to seed the note content. */
  templateName?: string;
  /** Optional data passed to the template renderer. */
  templateData?: Record<string, unknown>;
}

/** Parameters for updating note content. */
interface IUpdateNoteParameters {
  /** Path to the note relative to vault root. */
  notePath: string;
  /** New markdown content (frontmatter preserved automatically). */
  content: string;
}

/** Parameters for updating note frontmatter metadata. */
interface IUpdateNoteFrontmatterParameters {
  /** Path to the note relative to vault root. */
  notePath: string;
  /** Array of operations to perform on frontmatter (set or delete keys). */
  operations: Array<{
    /** Operation type: 'set' to add/update, 'delete' to remove. */
    action: 'set' | 'delete';
    /** Frontmatter key to operate on. */
    key: string;
    /** Value to set (required for 'set', ignored for 'delete'). */
    value?: any;
  }>;
}

/** Parameters for deleting a note. */
interface IDeleteNoteParameters {
  /** Path to the note to delete relative to vault root. */
  notePath: string;
}

// Tool Implementations

/**
 * Language model tool for listing all markdown files in the vault.
 * Supports optional folder filtering and content preview inclusion.
 *
 * @remarks
 * This tool is useful for:
 * - Discovering available notes in the vault
 * - Getting an overview of a specific folder's contents
 * - Finding files before performing targeted operations
 *
 * For efficiency, set `includeContent=false` (default) when you only need file paths.
 * Use a two-phase workflow: list files first, then use readNote for specific files.
 *
 * @example
 * ```typescript
 * // List all files in vault
 * const tool = new ListFilesTool();
 * const result = await tool.invoke({ input: {}, options: {} }, token);
 *
 * // List files in specific folder with content preview
 * const result = await tool.invoke({
 *   input: { folderPath: 'projects', includeContent: true },
 *   options: {}
 * }, token);
 * ```
 */
export class ListFilesTool implements vscode.LanguageModelTool<IListFilesParameters> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IListFilesParameters>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const params = options.input;
    const workspaceRoot = getVaultRoot();

    if (!workspaceRoot) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'No vault root configured. Please open a workspace or configure personal-assistant.vaultPath.'
        ),
      ]);
    }

    try {
      const files = await findMarkdownFiles(workspaceRoot, params.folderPath);

      if (files.length === 0) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `No markdown files found${params.folderPath ? ` in folder "${params.folderPath}"` : ''}.`
          ),
        ]);
      }

      const includeContent = params.includeContent ?? false;
      const results: string[] = [];

      for (const file of files) {
        let result = `- ${file}`;

        if (includeContent) {
          const fullPath = path.join(workspaceRoot, file);
          const content = await fs.readFile(fullPath, 'utf-8');
          const preview = generateContentPreview(content);
          result += `\n  ${preview}`;
        }

        results.push(result);
      }

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Found ${files.length} markdown file(s):\n\n${results.join('\n')}`
        ),
      ]);
    } catch (err) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error listing files: ${err}`),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<IListFilesParameters>,
    _token: vscode.CancellationToken
  ) {
    const params = options.input;
    return {
      invocationMessage: `Listing markdown files${params.folderPath ? ` in "${params.folderPath}"` : ' in vault'}`,
    };
  }
}

/**
 * Language model tool for searching markdown files by filename pattern.
 * Performs case-insensitive substring matching on filenames.
 *
 * @remarks
 * This tool is useful when:
 * - User mentions a specific file name
 * - Looking for files with a common naming pattern
 * - Finding files by partial name or keyword
 *
 * The search is case-insensitive and matches substrings anywhere in the filename.
 * For efficiency, use `includeContent=false` (default) unless previews are needed.
 *
 * @example
 * ```typescript
 * // Find all files with 'project' in the name
 * const tool = new SearchFilesByNameTool();
 * const result = await tool.invoke({
 *   input: { namePattern: 'project', includeContent: false },
 *   options: {}
 * }, token);
 * // Matches: 'project-notes.md', 'My-Project.md', 'projects/file.md'
 * ```
 */
export class SearchFilesByNameTool implements vscode.LanguageModelTool<ISearchFilesByNameParameters> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ISearchFilesByNameParameters>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const params = options.input;
    const workspaceRoot = getVaultRoot();

    if (!workspaceRoot) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'No vault root configured. Please open a workspace or configure personal-assistant.vaultPath.'
        ),
      ]);
    }

    if (!params.namePattern) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Error: namePattern is required.'),
      ]);
    }

    try {
      const allFiles = await findMarkdownFiles(workspaceRoot);
      const pattern = params.namePattern.toLowerCase();
      const matchingFiles = allFiles.filter(file =>
        path.basename(file).toLowerCase().includes(pattern)
      );

      if (matchingFiles.length === 0) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `No files found matching pattern "${params.namePattern}".`
          ),
        ]);
      }

      const includeContent = params.includeContent ?? false;
      const results: string[] = [];

      for (const file of matchingFiles) {
        let result = `- ${file}`;

        if (includeContent) {
          const fullPath = path.join(workspaceRoot, file);
          const content = await fs.readFile(fullPath, 'utf-8');
          const preview = generateContentPreview(content);
          result += `\n  ${preview}`;
        }

        results.push(result);
      }

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Found ${matchingFiles.length} file(s) matching "${params.namePattern}":\n\n${results.join('\n')}`
        ),
      ]);
    } catch (err) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error searching files by name: ${err}`),
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
 * Language model tool for searching markdown files by content text.
 * Performs case-insensitive full-text search across all markdown files.
 *
 * @remarks
 * This tool enables content-based discovery:
 * - Finding files containing specific keywords or phrases
 * - Searching for mentions of topics or concepts
 * - Locating files with specific text patterns
 *
 * **Best Practice**: Use two-phase workflow for efficiency:
 * 1. Search with `includeContent=false` to find matching files
 * 2. Use `readNote` to get full content of specific files
 *
 * This prevents loading excessive content into the AI context.
 *
 * @example
 * ```typescript
 * // Find files mentioning 'TypeScript'
 * const tool = new SearchFilesByContentTool();
 * const result = await tool.invoke({
 *   input: { searchText: 'TypeScript', includeContent: false },
 *   options: {}
 * }, token);
 * ```
 */
export class SearchFilesByContentTool implements vscode.LanguageModelTool<ISearchFilesByContentParameters> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ISearchFilesByContentParameters>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const params = options.input;
    const workspaceRoot = getVaultRoot();

    if (!workspaceRoot) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'No vault root configured. Please open a workspace or configure personal-assistant.vaultPath.'
        ),
      ]);
    }

    if (!params.searchText) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Error: searchText is required.'),
      ]);
    }

    try {
      const allFiles = await findMarkdownFiles(workspaceRoot);
      const searchText = params.searchText.toLowerCase();
      const matchingFiles: Array<{ path: string; content: string }> = [];

      for (const file of allFiles) {
        const fullPath = path.join(workspaceRoot, file);
        const content = await fs.readFile(fullPath, 'utf-8');

        if (content.toLowerCase().includes(searchText)) {
          matchingFiles.push({ path: file, content });
        }
      }

      if (matchingFiles.length === 0) {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `No files found containing "${params.searchText}".`
          ),
        ]);
      }

      const includeContent = params.includeContent ?? false;
      const results: string[] = [];

      for (const match of matchingFiles) {
        let result = `- ${match.path}`;

        if (includeContent) {
          const preview = generateContentPreview(match.content);
          result += `\n  ${preview}`;
        }

        results.push(result);
      }

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Found ${matchingFiles.length} file(s) containing "${params.searchText}":\n\n${results.join('\n')}`
        ),
      ]);
    } catch (err) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error searching files by content: ${err}`),
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
 * Language model tool for searching notes by YAML frontmatter metadata.
 * Supports both key existence checks and exact value matching.
 *
 * @remarks
 * This tool enables metadata-based filtering:
 * - Finding notes with specific tags
 * - Filtering by status, category, or custom fields
 * - Discovering notes with specific metadata properties
 *
 * **Key existence**: Omit `value` parameter to find any note with the key
 * **Exact match**: Provide `value` parameter for precise filtering
 *
 * Frontmatter is parsed from YAML headers at the top of markdown files:
 * ```yaml
 * ---
 * tag: project
 * status: active
 * ---
 * ```
 *
 * @example
 * ```typescript
 * // Find all notes with 'tag' field
 * const tool = new SearchNotesByFrontmatterTool();
 * let result = await tool.invoke({
 *   input: { key: 'tag', includeContent: false },
 *   options: {}
 * }, token);
 *
 * // Find notes where tag equals 'project'
 * result = await tool.invoke({
 *   input: { key: 'tag', value: 'project', includeContent: false },
 *   options: {}
 * }, token);
 * ```
 */
export class SearchNotesByFrontmatterTool implements vscode.LanguageModelTool<ISearchNotesByFrontmatterParameters> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ISearchNotesByFrontmatterParameters>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const params = options.input;
    const workspaceRoot = getVaultRoot();

    if (!workspaceRoot) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'No vault root configured. Please open a workspace or configure personal-assistant.vaultPath.'
        ),
      ]);
    }

    if (!params.key) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Error: key is required.'),
      ]);
    }

    try {
      const allFiles = await findMarkdownFiles(workspaceRoot);
      const matchingFiles: Array<{ path: string; content: string }> = [];

      for (const file of allFiles) {
        const fullPath = path.join(workspaceRoot, file);
        const fileContent = await fs.readFile(fullPath, 'utf-8');
        const parsed = await parseMarkdown(fileContent);

        // Check if key exists
        if (parsed.data && params.key in parsed.data) {
          // If value is specified, check for exact match
          if (params.value !== undefined) {
            if (parsed.data[params.key] === params.value) {
              matchingFiles.push({ path: file, content: fileContent });
            }
          } else {
            // Just key existence check
            matchingFiles.push({ path: file, content: fileContent });
          }
        }
      }

      if (matchingFiles.length === 0) {
        const valueMsg = params.value !== undefined ? ` = "${params.value}"` : '';
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `No files found with frontmatter "${params.key}"${valueMsg}.`
          ),
        ]);
      }

      const includeContent = params.includeContent ?? false;
      const results: string[] = [];

      for (const match of matchingFiles) {
        let result = `- ${match.path}`;

        if (includeContent) {
          const preview = generateContentPreview(match.content);
          result += `\n  ${preview}`;
        }

        results.push(result);
      }

      const valueMsg = params.value !== undefined ? ` = "${params.value}"` : '';
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Found ${matchingFiles.length} file(s) with frontmatter "${params.key}"${valueMsg}:\n\n${results.join('\n')}`
        ),
      ]);
    } catch (err) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error searching by frontmatter: ${err}`),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<ISearchNotesByFrontmatterParameters>,
    _token: vscode.CancellationToken
  ) {
    const valueMsg = options.input.value !== undefined ? ` = "${options.input.value}"` : '';
    return {
      invocationMessage: `Searching for notes with frontmatter "${options.input.key}"${valueMsg}`,
    };
  }
}

/**
 * Language model tool for reading the complete content and frontmatter of a note.
 * Returns both YAML frontmatter metadata and markdown content in a structured format.
 *
 * @remarks
 * This tool is the primary way to access full note content:
 * - Use after search tools to get complete content of specific files
 * - Returns both frontmatter and content in a structured, readable format
 * - Includes path validation to prevent security issues
 *
 * **Best Practice**: Prefer this over search tools with `includeContent=true`
 * to avoid loading excessive content into AI context.
 *
 * The returned format includes:
 * - Note path as a header
 * - Frontmatter section (if present) as YAML code block
 * - Content section with the markdown body
 *
 * @example
 * ```typescript
 * const tool = new ReadNoteTool();
 * const result = await tool.invoke({
 *   input: { notePath: 'projects/2024/meeting-notes.md' },
 *   options: {}
 * }, token);
 * ```
 */
export class ReadNoteTool implements vscode.LanguageModelTool<IReadNoteParameters> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IReadNoteParameters>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const params = options.input;
    const workspaceRoot = getVaultRoot();

    if (!workspaceRoot) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'No vault root configured. Please open a workspace or configure personal-assistant.vaultPath.'
        ),
      ]);
    }

    if (!params.notePath) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Error: notePath is required.'),
      ]);
    }

    const resolvedPath = resolveNotePath(workspaceRoot, params.notePath);
    if (!resolvedPath) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'Invalid note path. Path traversal is not allowed.'
        ),
      ]);
    }

    try {
      const content = await fs.readFile(resolvedPath, 'utf-8');
      const parsed = await parseMarkdown(content);

      let output = `# Note: ${params.notePath}\n\n`;

      if (parsed.data && Object.keys(parsed.data).length > 0) {
        output += '## Frontmatter\n```yaml\n';
        for (const [key, value] of Object.entries(parsed.data)) {
          output += `${key}: ${value}\n`;
        }
        output += '```\n\n';
      }

      output += '## Content\n';
      output += parsed.content;

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(output),
      ]);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(`Error: Note "${params.notePath}" not found.`),
        ]);
      }
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error reading note: ${err}`),
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
 * Language model tool for creating new markdown notes with optional YAML frontmatter.
 * Automatically creates parent directories and prevents overwriting existing files.
 *
 * @remarks
 * This tool enables note creation:
 * - Creates new markdown files with content and optional metadata
 * - Automatically creates parent directories (recursive)
 * - Returns error if file already exists (use UpdateNoteTool to modify)
 * - Supports YAML frontmatter for metadata (tags, status, custom fields)
 * - Seeds files from Templates/ when `templateName` is supplied
 *
 * Frontmatter is added as a YAML block at the top of the file:
 * ```yaml
 * ---
 * title: My Note
 * tag: project
 * created: 2024-10-31
 * ---
 * # Note content follows...
 * ```
 *
 * @example
 * ```typescript
 * const tool = new CreateNoteTool();
 * const result = await tool.invoke({
 *   input: {
 *     notePath: 'projects/2024/new-note.md',
 *     content: '# My New Note\n\nContent here...',
 *     frontmatter: { tag: 'project', status: 'draft' }
 *   },
 *   options: {}
 * }, token);
 * ```
 */
export class CreateNoteTool implements vscode.LanguageModelTool<ICreateNoteParameters> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ICreateNoteParameters>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const params = options.input;
    const workspaceRoot = getVaultRoot();

    if (!workspaceRoot) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'No vault root configured. Please open a workspace or configure personal-assistant.vaultPath.'
        ),
      ]);
    }

    if (!params.notePath) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Error: notePath is required.'),
      ]);
    }

    if (!params.content) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Error: content is required.'),
      ]);
    }

    const resolvedPath = resolveNotePath(workspaceRoot, params.notePath);
    if (!resolvedPath) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'Invalid note path. Path traversal is not allowed.'
        ),
      ]);
    }

    try {
      // Check if file already exists
      try {
        await fs.access(resolvedPath);
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Error: Note "${params.notePath}" already exists. Use updateNote to modify it.`
          ),
        ]);
      } catch {
        // File doesn't exist, proceed with creation
      }

      // Create directories if needed
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

      // Create file content
      const templatedContent = await this.renderFromTemplate(params);
      let fileContent: string;
      if (templatedContent) {
        fileContent = templatedContent;
      } else if (params.frontmatter && Object.keys(params.frontmatter).length > 0) {
        fileContent = await stringifyMarkdown(params.content, params.frontmatter);
      } else {
        fileContent = params.content;
      }

      await fs.writeFile(resolvedPath, fileContent, 'utf-8');

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Note "${params.notePath}" created successfully.`
        ),
      ]);
    } catch (err) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error creating note: ${err}`),
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

  /**
   * Renders content using a vault template when template metadata is provided.
   *
   * @param params - Invocation parameters supplied by the LM tool
   * @returns Rendered template output or null when templating is not requested/available
   */
  private async renderFromTemplate(params: ICreateNoteParameters): Promise<string | null> {
    if (!params.templateName) {
      return null;
    }

    const templatePayload = {
      ...(params.templateData ?? {}),
      content: params.content,
      notePath: params.notePath,
      frontmatter: params.frontmatter ?? {}
    };

    try {
      return await templateService.renderTemplate(params.templateName, templatePayload);
    } catch {
      return null;
    }
  }
}

/**
 * Language model tool for updating the content of an existing note.
 * Preserves existing YAML frontmatter while replacing the markdown content.
 *
 * @remarks
 * This tool safely updates note content:
 * - Replaces markdown content while preserving frontmatter
 * - Returns error if note doesn't exist (use CreateNoteTool to create)
 * - Frontmatter is automatically preserved from the original file
 * - Use UpdateNoteFrontmatterTool to modify metadata instead
 *
 * The update process:
 * 1. Reads existing file and parses frontmatter
 * 2. Replaces content with new markdown
 * 3. Writes back with preserved frontmatter
 *
 * @example
 * ```typescript
 * const tool = new UpdateNoteTool();
 * const result = await tool.invoke({
 *   input: {
 *     notePath: 'projects/existing-note.md',
 *     content: '# Updated Content\n\nNew text here...'
 *   },
 *   options: {}
 * }, token);
 * // Frontmatter from original file is preserved
 * ```
 */
export class UpdateNoteTool implements vscode.LanguageModelTool<IUpdateNoteParameters> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IUpdateNoteParameters>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const params = options.input;
    const workspaceRoot = getVaultRoot();

    if (!workspaceRoot) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'No vault root configured. Please open a workspace or configure personal-assistant.vaultPath.'
        ),
      ]);
    }

    if (!params.notePath) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Error: notePath is required.'),
      ]);
    }

    if (!params.content) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Error: content is required.'),
      ]);
    }

    const resolvedPath = resolveNotePath(workspaceRoot, params.notePath);
    if (!resolvedPath) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'Invalid note path. Path traversal is not allowed.'
        ),
      ]);
    }

    try {
      // Read existing file to preserve frontmatter
      const existingContent = await fs.readFile(resolvedPath, 'utf-8');
      const parsed = await parseMarkdown(existingContent);

      // Create new content with preserved frontmatter
      const newContent = await stringifyMarkdown(params.content, parsed.data);
      await fs.writeFile(resolvedPath, newContent, 'utf-8');

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Note "${params.notePath}" updated successfully.`
        ),
      ]);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Error: Note "${params.notePath}" not found. Use createNote to create it.`
          ),
        ]);
      }
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error updating note: ${err}`),
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
 * Language model tool for updating YAML frontmatter metadata in notes.
 * Supports multiple operations (set/delete) in a single call while preserving content.
 *
 * @remarks
 * This tool enables metadata management:
 * - Add new frontmatter keys
 * - Update existing frontmatter values
 * - Delete frontmatter keys
 * - Execute multiple operations atomically
 * - Creates frontmatter section if none exists
 * - Preserves markdown content
 *
 * **Operations**:
 * - `set`: Adds a new key or updates existing value
 * - `delete`: Removes a key from frontmatter
 *
 * Multiple operations are applied in order, allowing complex updates like:
 * - Rename keys (delete old, set new)
 * - Update multiple fields at once
 * - Clean up unused metadata
 *
 * @example
 * ```typescript
 * const tool = new UpdateNoteFrontmatterTool();
 * const result = await tool.invoke({
 *   input: {
 *     notePath: 'projects/note.md',
 *     operations: [
 *       { action: 'set', key: 'status', value: 'completed' },
 *       { action: 'set', key: 'updated', value: '2024-10-31' },
 *       { action: 'delete', key: 'draft' }
 *     ]
 *   },
 *   options: {}
 * }, token);
 * ```
 */
export class UpdateNoteFrontmatterTool implements vscode.LanguageModelTool<IUpdateNoteFrontmatterParameters> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IUpdateNoteFrontmatterParameters>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const params = options.input;
    const workspaceRoot = getVaultRoot();

    if (!workspaceRoot) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'No vault root configured. Please open a workspace or configure personal-assistant.vaultPath.'
        ),
      ]);
    }

    if (!params.notePath) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Error: notePath is required.'),
      ]);
    }

    if (!params.operations || params.operations.length === 0) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Error: operations array is required and must not be empty.'),
      ]);
    }

    const resolvedPath = resolveNotePath(workspaceRoot, params.notePath);
    if (!resolvedPath) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'Invalid note path. Path traversal is not allowed.'
        ),
      ]);
    }

    try {
      // Read existing file
      const existingContent = await fs.readFile(resolvedPath, 'utf-8');
      const parsed = await parseMarkdown(existingContent);

      // Start with existing frontmatter or empty object
      const frontmatter = parsed.data || {};

      // Apply operations
      for (const op of params.operations) {
        if (op.action === 'set') {
          if (!op.key) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart('Error: "key" is required for set operation.'),
            ]);
          }
          frontmatter[op.key] = op.value;
        } else if (op.action === 'delete') {
          if (!op.key) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart('Error: "key" is required for delete operation.'),
            ]);
          }
          delete frontmatter[op.key];
        }
      }

      // Write updated file
      const newContent = await stringifyMarkdown(parsed.content, frontmatter);
      await fs.writeFile(resolvedPath, newContent, 'utf-8');

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Frontmatter for "${params.notePath}" updated successfully.`
        ),
      ]);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Error: Note "${params.notePath}" not found.`
          ),
        ]);
      }
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error updating frontmatter: ${err}`),
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
 * Language model tool for deleting notes from the vault.
 * Protected by configuration setting to prevent accidental data loss.
 *
 * @remarks
 * This tool provides safe note deletion:
 * - Requires `personal-assistant.allowNoteDeletion` setting enabled (default: false)
 * - Returns error if deletion is disabled (prevents accidental deletions)
 * - Validates path to prevent traversal attacks
 * - Permanently deletes the file (no undo)
 *
 * **Safety**: By default, deletion is DISABLED to protect against:
 * - Accidental AI-initiated deletions
 * - Malicious prompts attempting to delete files
 * - User mistakes
 *
 * Users must explicitly enable deletion in settings:
 * ```json
 * {
 *   "personal-assistant.allowNoteDeletion": true
 * }
 * ```
 *
 * @example
 * ```typescript
 * // This will fail unless allowNoteDeletion is enabled
 * const tool = new DeleteNoteTool();
 * const result = await tool.invoke({
 *   input: { notePath: 'old-notes/deprecated.md' },
 *   options: {}
 * }, token);
 * ```
 */
export class DeleteNoteTool implements vscode.LanguageModelTool<IDeleteNoteParameters> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IDeleteNoteParameters>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const params = options.input;
    const workspaceRoot = getVaultRoot();

    if (!workspaceRoot) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'No vault root configured. Please open a workspace or configure personal-assistant.vaultPath.'
        ),
      ]);
    }

    // Check if deletion is allowed
    const config = vscode.workspace.getConfiguration('personal-assistant');
    const allowDeletion = config.get<boolean>('allowNoteDeletion', false);

    if (!allowDeletion) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'Note deletion is not allowed. Enable "personal-assistant.allowNoteDeletion" in settings to allow deletion.'
        ),
      ]);
    }

    if (!params.notePath) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart('Error: notePath is required.'),
      ]);
    }

    const resolvedPath = resolveNotePath(workspaceRoot, params.notePath);
    if (!resolvedPath) {
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          'Invalid note path. Path traversal is not allowed.'
        ),
      ]);
    }

    try {
      await fs.unlink(resolvedPath);

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Note "${params.notePath}" deleted successfully.`
        ),
      ]);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            `Error: Note "${params.notePath}" not found.`
          ),
        ]);
      }
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error deleting note: ${err}`),
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
