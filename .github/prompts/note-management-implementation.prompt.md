---
name: note-management-system-implementation-plan
description: Comprehensive TDD-driven plan for implementing vault-wide markdown file operations with gray-matter frontmatter handling, file discovery, content search, and safe CRUD operations for the Personal Assistant VSCode extension.
---

# Note Management System Implementation Plan

## Overview

A Test-Driven Development (TDD) implementation of comprehensive note management tools for vault-wide markdown file operations using gray-matter for YAML frontmatter handling, with file discovery, content search, frontmatter manipulation, and safe CRUD operations.

## Architecture Decisions

### Vault Structure Philosophy
- **All markdown files are notes**: No separate "notes folder" concept
- **Vault root is the workspace**: All `.md` files under vault root are accessible
- **Journal entries are specialized notes**: Located in journal folder (configurable), but still markdown files like any other
- **Flexible organization**: Users can organize notes in any folder structure
- **System folders excluded**: `.obsidian`, `.git`, and other hidden folders are automatically skipped

### Technology Stack
- **Frontmatter Parser**: gray-matter (886k+ weekly downloads, battle-tested)
  - Simple API: `matter(content)` → `{data, content}`
  - Easy updates: `matter.stringify(newContent, frontmatterData)`
  - Minimal overhead, perfect for AI-driven operations
- **Search**: Substring matching (case-insensitive) for content and filename searches
- **Frontmatter Operations**: Support exact match + key existence checks
- **Efficiency**: Multiple frontmatter operations per tool call

### Why gray-matter over unified/mdast?
- **Simplicity**: Direct parse/stringify vs complex AST traversal
- **Performance**: Minimal overhead for CRUD operations
- **AI-Friendly**: Predictable behavior, simple programmatic interface
- **Right Tool**: unified/mdast excels at transformations; gray-matter excels at CRUD

## Implementation Steps

### Step 1: Install Dependencies
```powershell
npm install gray-matter
npm install --save-dev @types/gray-matter
```

### Step 2: Update Configuration (package.json)

Add to `contributes.configuration.properties`:

```json
"personal-assistant.allowNoteDeletion": {
  "default": false,
  "description": "Allow AI to delete notes. USE WITH CAUTION.",
  "type": "boolean"
},
"personal-assistant.defaultFrontmatterFields": {
  "default": ["title", "created", "modified", "tags"],
  "description": "Default frontmatter fields to include when creating new notes.",
  "type": "array",
  "items": {
    "type": "string"
  }
},
"personal-assistant.contentPreviewLength": {
  "default": 200,
  "description": "Number of characters to include in content previews when includeContent=true in search/list operations. Increase for more context with better models, decrease for efficiency.",
  "type": "number",
  "minimum": 50,
  "maximum": 2000
}
```

**Note**: No `notesPath` configuration needed. All markdown files in the vault are considered notes. Journal entries are just a specific type of note with structured formatting expectations.

### Step 3: Write Comprehensive Test Suite (TDD Red Phase)

Create `src/test/NoteManagementTools.test.ts` with 34+ tests covering:

#### Test Coverage Requirements

**ListFilesTool (4 tests)**
- List all markdown files in vault (recursive)
- Filter files by folder path
- Return message when no files found
- Include content preview when includeContent=true

**SearchFilesByNameTool (4 tests)**
- Find files by exact name match
- Find files by partial name match (case-insensitive)
- Return message when no matches found
- Include content preview when includeContent=true

**SearchFilesByContentTool (4 tests)**
- Find files containing search term in body
- Case-insensitive search
- Search in frontmatter content
- Return context snippets vs full content based on includeContent flag

**SearchNotesByFrontmatterTool (4 tests)**
- Find notes with specific frontmatter key-value pair (exact match)
- Find notes with key existence (no value specified)
- Handle notes without frontmatter gracefully
- Include content when includeContent=true vs frontmatter-only when false

**ReadNoteTool (3 tests)**
- Read note with frontmatter (parse and display both)
- Read note without frontmatter
- Return error for nonexistent note

**CreateNoteTool (4 tests)**
- Create note with frontmatter
- Create note without frontmatter
- Create note in subdirectory (auto-create folders)
- Return error if note already exists

**UpdateNoteTool (3 tests)**
- Update note content while preserving frontmatter
- Update note without frontmatter
- Return error for nonexistent note

**UpdateNoteFrontmatterTool (7 tests)**
- Add new frontmatter keys
- Modify existing frontmatter keys
- Delete frontmatter keys
- Handle multiple operations in one call (set + delete + set)
- Preserve content when updating frontmatter
- Create frontmatter if note has none
- Handle various data types (string, number, boolean, array)

**DeleteNoteTool (1 test)**
- Return error when deletion is not allowed by config (default)
- (Config-enabled test would require mocking)

**Total: 34+ tests**

### Step 4: Implement 9 Core Tools (TDD Green Phase)

Create `src/tools/NoteManagementTools.ts` with the following tools:

#### Tool 1: ListFilesTool
```typescript
interface IListFilesParameters {
  folderPath?: string; // Optional: filter by subfolder relative to vault root
  includeContent?: boolean; // Optional: include file content preview (default: false)
}
```
- Recursively list all `.md` files in vault
- Optional folder filter for scoped searches (e.g., 'projects', '1 Journal')
- Return relative paths from vault root
- Optional content preview (length from `contentPreviewLength` config) when `includeContent=true`
- Default returns only file paths for efficiency
- Sort alphabetically
- Exclude `.obsidian` folder and other system folders

#### Tool 2: SearchFilesByNameTool
```typescript
interface ISearchFilesByNameParameters {
  searchPattern: string; // Required: filename search term
  includeContent?: boolean; // Optional: include file content preview (default: false)
}
```
- Case-insensitive substring matching on filenames
- Search across entire vault (all markdown files)
- Exclude `.obsidian` and system folders
- Return matching file paths (relative to vault root) with relevance score
- Optional content preview (length from `contentPreviewLength` config) when `includeContent=true`
- Default returns only file paths for efficient context usage

#### Tool 3: SearchFilesByContentTool
```typescript
interface ISearchFilesByContentParameters {
  searchTerm: string; // Required: content to search for
  includeContent?: boolean; // Optional: include full content or just context snippet (default: false)
}
```
- Case-insensitive substring search in file content
- Searches both frontmatter and body content
- Default: Return file paths with matching line context snippet (configurable via `contentPreviewLength`)
- When `includeContent=true`: Return file paths with full content
- When `includeContent=false`: Return file paths with context snippets only (more efficient)

#### Tool 4: SearchNotesByFrontmatterTool
```typescript
interface ISearchNotesByFrontmatterParameters {
  key: string; // Required: frontmatter key to search
  value?: string; // Optional: if omitted, checks key existence
  includeContent?: boolean; // Optional: include file content (default: false)
}
```
- Exact match for key-value pairs
- Key existence check when value is omitted
- Handle notes without frontmatter gracefully
- Default: Return file paths with matching frontmatter data only
- When `includeContent=true`: Also include full note content
- When `includeContent=false`: Return only paths and frontmatter (more efficient)

#### Tool 5: ReadNoteTool
```typescript
interface IReadNoteParameters {
  notePath: string; // Required: relative path from vault root
}
```
- Use gray-matter to parse frontmatter
- Return JSON with: `{content, frontmatter, path}`
- Handle notes with and without frontmatter
- Clear error message for missing files
- Works with any markdown file in vault (including journal entries)

#### Tool 6: CreateNoteTool
```typescript
interface ICreateNoteParameters {
  notePath: string; // Required: relative path from vault root (e.g., 'note.md' or 'projects/project1.md')
  content: string; // Required: note body content
  frontmatter?: Record<string, any>; // Optional: frontmatter object
}
```
- Use `matter.stringify()` to create file with frontmatter
- Auto-create subdirectories if needed (e.g., 'projects/ideas/note.md' creates both folders)
- Add default frontmatter fields from config if not provided
- Error if file already exists (no overwrite)
- Can create notes anywhere in vault structure

#### Tool 7: UpdateNoteTool
```typescript
interface IUpdateNoteParameters {
  notePath: string; // Required: relative path from vault root
  content: string; // Required: new content (replaces old)
}
```
- Parse existing file with gray-matter
- Replace content while preserving frontmatter
- Use `matter.stringify()` to write back
- Update `modified` field in frontmatter if exists
- Works with any markdown file in vault

#### Tool 8: UpdateNoteFrontmatterTool
```typescript
interface IFrontmatterOperation {
  action: 'set' | 'delete'; // Required: operation type
  key: string; // Required: frontmatter key
  value?: any; // Required for 'set', ignored for 'delete'
}

interface IUpdateNoteFrontmatterParameters {
  notePath: string; // Required: relative path from vault root
  operations: IFrontmatterOperation[]; // Required: list of operations
}
```
- Support multiple operations in one call for efficiency
- `set`: Create or modify frontmatter key
- `delete`: Remove frontmatter key
- Create frontmatter section if note has none
- Preserve content unchanged
- Update `modified` field automatically
- Works with any markdown file in vault

#### Tool 9: DeleteNoteTool
```typescript
interface IDeleteNoteParameters {
  notePath: string; // Required: relative path from vault root
}
```
- Check `personal-assistant.allowNoteDeletion` config
- Return clear error if deletion disabled (default)
- Permanently delete file if enabled
- No recovery mechanism (intentionally dangerous)
- Works with any markdown file in vault (use extreme caution with journal files)

### Step 5: Register Tools in tools.ts

Add 9 tool registrations using naming pattern `note-management-tools_{toolName}`:

```typescript
import {
  ListFilesTool,
  SearchFilesByNameTool,
  SearchFilesByContentTool,
  SearchNotesByFrontmatterTool,
  ReadNoteTool,
  CreateNoteTool,
  UpdateNoteTool,
  UpdateNoteFrontmatterTool,
  DeleteNoteTool
} from "./NoteManagementTools";

// In registerChatTools():
context.subscriptions.push(
  vscode.lm.registerTool("note-management-tools_listFiles", new ListFilesTool())
);
context.subscriptions.push(
  vscode.lm.registerTool("note-management-tools_searchFilesByName", new SearchFilesByNameTool())
);
context.subscriptions.push(
  vscode.lm.registerTool("note-management-tools_searchFilesByContent", new SearchFilesByContentTool())
);
context.subscriptions.push(
  vscode.lm.registerTool("note-management-tools_searchNotesByFrontmatter", new SearchNotesByFrontmatterTool())
);
context.subscriptions.push(
  vscode.lm.registerTool("note-management-tools_readNote", new ReadNoteTool())
);
context.subscriptions.push(
  vscode.lm.registerTool("note-management-tools_createNote", new CreateNoteTool())
);
context.subscriptions.push(
  vscode.lm.registerTool("note-management-tools_updateNote", new UpdateNoteTool())
);
context.subscriptions.push(
  vscode.lm.registerTool("note-management-tools_updateNoteFrontmatter", new UpdateNoteFrontmatterTool())
);
context.subscriptions.push(
  vscode.lm.registerTool("note-management-tools_deleteNote", new DeleteNoteTool())
);
```

### Step 6: Define JSON Schemas in package.json

Add to `contributes.languageModelTools` array:

```json
{
  "name": "note-management-tools_listFiles",
  "tags": ["notes", "note-management", "personal-assistant", "search"],
  "toolReferenceName": "listFiles",
  "displayName": "List Notes",
  "modelDescription": "List all markdown files in the vault. Optionally filter by subfolder path. Returns relative paths from vault root. Set includeContent=true to get content previews. Excludes system folders like .obsidian.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "properties": {
      "folderPath": {
        "type": "string",
        "description": "Optional: subfolder path relative to vault root to filter results (e.g., 'projects', '1 Journal', or 'archive/2024')."
      },
      "includeContent": {
        "type": "boolean",
        "description": "Optional: include content preview (length configurable in settings, default 200 characters). Default false for efficiency. Use false for large listings, true when you need content overview."
      }
    },
    "required": []
  }
}
```

```json
{
  "name": "note-management-tools_searchFilesByName",
  "tags": ["notes", "note-management", "personal-assistant", "search"],
  "toolReferenceName": "searchFilesByName",
  "displayName": "Search Notes by Filename",
  "modelDescription": "Search for markdown files by filename using case-insensitive substring matching. Useful for finding notes when you know part of the filename. Set includeContent=true to get content previews.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "properties": {
      "searchPattern": {
        "type": "string",
        "description": "Filename search term (case-insensitive substring match, e.g., 'meeting' matches 'Meeting-Notes.md')."
      },
      "includeContent": {
        "type": "boolean",
        "description": "Optional: include content preview (length configurable in settings, default 200 characters). Default false for efficiency. Use false for quick searches, true when you need to see content."
      }
    },
    "required": ["searchPattern"]
  }
}
```

```json
{
  "name": "note-management-tools_searchFilesByContent",
  "tags": ["notes", "note-management", "personal-assistant", "search"],
  "toolReferenceName": "searchFilesByContent",
  "displayName": "Search Notes by Content",
  "modelDescription": "Search for markdown files containing specific text in their content or frontmatter. Case-insensitive substring matching. Returns file paths with context snippets by default, or full content if includeContent=true.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "properties": {
      "searchTerm": {
        "type": "string",
        "description": "Text to search for in note content and frontmatter (case-insensitive)."
      },
      "includeContent": {
        "type": "boolean",
        "description": "Optional: include full file content. Default false (returns only context snippets around matches for efficiency). Use true when you need full content, false for quick searches."
      }
    },
    "required": ["searchTerm"]
  }
}
```

```json
{
  "name": "note-management-tools_searchNotesByFrontmatter",
  "tags": ["notes", "note-management", "personal-assistant", "search", "frontmatter", "metadata"],
  "toolReferenceName": "searchNotesByFrontmatter",
  "displayName": "Search Notes by Frontmatter",
  "modelDescription": "Find notes by frontmatter metadata. Search by exact key-value match OR check for key existence. Useful for filtering notes by status, tags, or other metadata fields. Set includeContent=true to get full note content.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "properties": {
      "key": {
        "type": "string",
        "description": "Frontmatter key to search for (e.g., 'status', 'tags', 'author')."
      },
      "value": {
        "type": "string",
        "description": "Optional: exact value to match. If omitted, returns notes that have this key (existence check)."
      },
      "includeContent": {
        "type": "boolean",
        "description": "Optional: include full note content. Default false (returns only paths and frontmatter for efficiency). Use true when you need to analyze content, false for quick filtering."
      }
    },
    "required": ["key"]
  }
}
```

```json
{
  "name": "note-management-tools_readNote",
  "tags": ["notes", "note-management", "personal-assistant", "read"],
  "toolReferenceName": "readNote",
  "displayName": "Read Note",
  "modelDescription": "Read any markdown file in the vault and parse its frontmatter. Returns the note content and frontmatter metadata separately. Works with all markdown files including journal entries. Use this to retrieve note information before editing.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "properties": {
      "notePath": {
        "type": "string",
        "description": "Path to the note relative to vault root (e.g., 'meeting-notes.md', 'projects/project1.md', or '1 Journal/2025/2025-W44.md')."
      }
    },
    "required": ["notePath"]
  }
}
```

```json
{
  "name": "note-management-tools_createNote",
  "tags": ["notes", "note-management", "personal-assistant", "create"],
  "toolReferenceName": "createNote",
  "displayName": "Create Note",
  "modelDescription": "Create a new markdown note anywhere in the vault with optional YAML frontmatter. Automatically creates subdirectories if needed. Fails if note already exists (use updateNote to modify existing notes). Can create notes in any folder structure.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "properties": {
      "notePath": {
        "type": "string",
        "description": "Path for the new note relative to vault root (e.g., 'new-note.md', 'projects/new-project.md', or 'ideas/2025/idea.md')."
      },
      "content": {
        "type": "string",
        "description": "The note content (body text, can include markdown formatting)."
      },
      "frontmatter": {
        "type": "object",
        "description": "Optional: frontmatter metadata as key-value pairs (e.g., {title: 'My Note', tags: ['work'], status: 'draft'})."
      }
    },
    "required": ["notePath", "content"]
  }
}
```

```json
{
  "name": "note-management-tools_updateNote",
  "tags": ["notes", "note-management", "personal-assistant", "update", "edit"],
  "toolReferenceName": "updateNote",
  "displayName": "Update Note Content",
  "modelDescription": "Update any markdown file's content (body text) in the vault while preserving its frontmatter metadata. For frontmatter-only changes, use updateNoteFrontmatter instead. This replaces the entire note body. WARNING: Do not use for journal entries - use journal-tools_addJournalEntry instead.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "properties": {
      "notePath": {
        "type": "string",
        "description": "Path to the note relative to vault root (e.g., 'meeting-notes.md', 'projects/plan.md')."
      },
      "content": {
        "type": "string",
        "description": "New content to replace the note body (frontmatter is preserved)."
      }
    },
    "required": ["notePath", "content"]
  }
}
```

```json
{
  "name": "note-management-tools_updateNoteFrontmatter",
  "tags": ["notes", "note-management", "personal-assistant", "update", "frontmatter", "metadata"],
  "toolReferenceName": "updateNoteFrontmatter",
  "displayName": "Update Note Frontmatter",
  "modelDescription": "Create, modify, or delete frontmatter metadata keys in any markdown file in the vault. Supports multiple operations in one call for efficiency. Use this for metadata-only changes (tags, status, etc.). Note content is preserved unchanged. Works with all files including journal entries.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "properties": {
      "notePath": {
        "type": "string",
        "description": "Path to the note relative to vault root (e.g., 'meeting-notes.md', 'projects/plan.md', or '1 Journal/2025/2025-W44.md')."
      },
      "operations": {
        "type": "array",
        "description": "List of frontmatter operations to perform in sequence.",
        "items": {
          "type": "object",
          "properties": {
            "action": {
              "type": "string",
              "enum": ["set", "delete"],
              "description": "'set' to create/modify a key, 'delete' to remove a key."
            },
            "key": {
              "type": "string",
              "description": "Frontmatter key to operate on (e.g., 'status', 'tags', 'author')."
            },
            "value": {
              "description": "Value to set (required for 'set' action, ignored for 'delete'). Can be string, number, boolean, or array."
            }
          },
          "required": ["action", "key"]
        }
      }
    },
    "required": ["notePath", "operations"]
  }
}
```

```json
{
  "name": "note-management-tools_deleteNote",
  "tags": ["notes", "note-management", "personal-assistant", "delete"],
  "toolReferenceName": "deleteNote",
  "displayName": "Delete Note",
  "modelDescription": "DANGEROUS: Permanently delete any markdown file in the vault. Disabled by default (requires personal-assistant.allowNoteDeletion config). No recovery mechanism. Use with extreme caution. NEVER use on journal files unless explicitly instructed.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "properties": {
      "notePath": {
        "type": "string",
        "description": "Path to the note to delete relative to vault root (e.g., 'old-note.md', 'archive/deprecated.md'). WARNING: This is permanent."
      }
    },
    "required": ["notePath"]
  }
}
```

### Step 7: Update Chat Participant Prompts

Modify `src/chatParticipants/journal.tsx` to add clear priority instructions:

```typescript
// Add to system prompt:
`
TOOL USAGE PRIORITY RULES:

1. JOURNAL OPERATIONS (Highest Priority)
   - ALWAYS use journal-tools_* for daily journal entries and weekly tasks
   - journal-tools_addJournalEntry: Add timestamped entries to daily sections
   - journal-tools_addJournalTask: Add tasks to weekly task section
   - journal-tools_readJournalEntries: Read journal history

2. NOTE METADATA OPERATIONS
   - Use note-management-tools_updateNoteFrontmatter for metadata-only changes
   - Use note-management-tools_searchNotesByFrontmatter to find notes by metadata

3. NOTE CONTENT OPERATIONS
   - Use note-management-tools_updateNote for content changes (preserves frontmatter)
   - Use note-management-tools_readNote to retrieve note content and metadata

4. NOTE DISCOVERY
   - Use note-management-tools_listFiles to browse notes
   - Use note-management-tools_searchFilesByName for filename searches
   - Use note-management-tools_searchFilesByContent for full-text searches
   - EFFICIENCY: Set includeContent=false (default) for quick searches, true only when you need content
   - WORKFLOW: Search without content first to find relevant files, then use readNote to get full content

5. NOTE LIFECYCLE
   - Use note-management-tools_createNote to create new notes
   - Use note-management-tools_deleteNote ONLY when explicitly requested (dangerous)

CRITICAL: Never use note-management-tools_* for journal entries. Journal tools have special formatting and date handling.
`
```

### Step 8: Verify and Refactor (TDD Refactor Phase)

**Run Tests:**
```powershell
npm test
```

**Expected Results:**
- 19 existing tests (JournalTools + markdownlint-rules) ✅
- 34+ new tests (NoteManagementTools) ✅
- **Total: 53+ tests passing**

**Refactoring Checklist:**
- [ ] Extract common frontmatter operations into helper functions
- [ ] Ensure consistent error messages across all tools
- [ ] Validate path security (prevent directory traversal attacks)
- [ ] Add JSDoc comments for complex functions
- [ ] Ensure all file operations use try-catch blocks
- [ ] Test with various frontmatter data types (string, number, boolean, array, object)
- [ ] Verify gray-matter handles edge cases (empty frontmatter, malformed YAML)

## Implementation Best Practices

### File Operations
```typescript
import * as fs from "fs/promises";
import * as path from "path";
import matter from "gray-matter";
import { getVaultRoot } from "../extension";

// Always validate vault root
const workspaceRoot = getVaultRoot();
if (!workspaceRoot) {
  return new vscode.LanguageModelToolResult([
    new vscode.LanguageModelTextPart(
      "No vault root configured. Please open a workspace or configure personal-assistant.vaultPath."
    ),
  ]);
}

// All markdown files in vault are notes - work directly with vault root
const fullPath = path.join(workspaceRoot, params.notePath);

// Validate path security (prevent traversal)
const relativePath = path.relative(workspaceRoot, fullPath);
if (relativePath.startsWith('..')) {
  return new vscode.LanguageModelToolResult([
    new vscode.LanguageModelTextPart("Invalid path: cannot access files outside vault."),
  ]);
}

// Skip system folders when listing/searching
const shouldSkipFolder = (folderName: string): boolean => {
  return folderName === '.obsidian' || folderName === '.git' || folderName.startsWith('.');
};
```

### gray-matter Usage Patterns
```typescript
// Parse note
const fileContent = await fs.readFile(fullPath, 'utf-8');
const { data: frontmatter, content } = matter(fileContent);

// Create/update with frontmatter
const updatedContent = matter.stringify(newContent, frontmatterData);
await fs.writeFile(fullPath, updatedContent, 'utf-8');

// Update frontmatter only (preserve content)
const parsed = matter(fileContent);
const updatedFrontmatter = { ...parsed.data, newKey: 'value' };
const updatedContent = matter.stringify(parsed.content, updatedFrontmatter);

// Generate content preview (respecting user configuration)
function generateContentPreview(content: string): string {
  const previewLength = getContentPreviewLength();
  if (content.length <= previewLength) {
    return content;
  }
  return content.substring(0, previewLength) + '...';
}
```

### Error Handling
```typescript
try {
  // Tool operations
  return new vscode.LanguageModelToolResult([
    new vscode.LanguageModelTextPart("Success message"),
  ]);
} catch (err) {
  return new vscode.LanguageModelToolResult([
    new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
  ]);
}
```

## Configuration Helper Functions

Add to tool files or shared utilities:

```typescript
function isNoteDeletionAllowed(): boolean {
  const config = vscode.workspace.getConfiguration("personal-assistant");
  return config.get<boolean>("allowNoteDeletion") || false;
}

function getDefaultFrontmatterFields(): string[] {
  const config = vscode.workspace.getConfiguration("personal-assistant");
  return config.get<string[]>("defaultFrontmatterFields") || ["title", "created", "modified", "tags"];
}

function getContentPreviewLength(): number {
  const config = vscode.workspace.getConfiguration("personal-assistant");
  const length = config.get<number>("contentPreviewLength") || 200;
  // Enforce bounds
  return Math.max(50, Math.min(2000, length));
}

function shouldSkipSystemFolder(folderName: string): boolean {
  // Skip .obsidian, .git, and other hidden folders
  return folderName.startsWith('.');
}
```

## Security Considerations

### Path Traversal Prevention
```typescript
// CRITICAL: Always validate paths to prevent ../../../etc/passwd attacks
const workspaceRoot = getVaultRoot();
const fullPath = path.join(workspaceRoot, params.notePath);
const relativePath = path.relative(workspaceRoot, fullPath);

if (relativePath.startsWith('..') || path.isAbsolute(params.notePath)) {
  throw new Error("Invalid path: cannot access files outside vault");
}
```

### Deletion Protection
```typescript
// NEVER allow deletion by default
// Require explicit config opt-in
// Provide clear warnings in UI
if (!isNoteDeletionAllowed()) {
  return new vscode.LanguageModelToolResult([
    new vscode.LanguageModelTextPart(
      "Note deletion is disabled. Enable personal-assistant.allowNoteDeletion in settings to allow this operation. WARNING: Deleted notes cannot be recovered."
    ),
  ]);
}
```

## Testing Strategy

### Test Organization
- **Unit Tests**: Each tool tested independently
- **Integration Tests**: Tools working together (e.g., create → update → read)
- **Edge Cases**: Empty files, missing frontmatter, malformed YAML, path traversal attempts
- **Platform Tests**: Windows vs Unix path handling

### Test Data Patterns
```typescript
// Simple note
"Just content, no frontmatter"

// Note with frontmatter
matter.stringify("Content here", { title: "Test", tags: ["work"] })

// Frontmatter types
{
  string: "text",
  number: 42,
  boolean: true,
  array: ["tag1", "tag2"],
  object: { nested: "value" }
}
```

## Future Enhancements (Post-MVP)

### Phase 2 Features
- [ ] Regex support in content search
- [ ] Frontmatter merge mode (update specific keys without replacing all)
- [ ] Note templates system
- [ ] Backlinks detection and management
- [ ] Tag hierarchy and autocomplete
- [ ] Note history/versioning (git integration)
- [ ] Bulk operations (rename, move, batch frontmatter updates)

### Phase 3 Features
- [ ] Full-text search index for performance
- [ ] Advanced frontmatter queries (greater than, less than, contains)
- [ ] Note relationships graph
- [ ] AI-powered note summarization
- [ ] Duplicate note detection
- [ ] Orphaned note cleanup

## Success Metrics

### Implementation Complete When:
- ✅ All 53+ tests passing (19 existing + 34+ new)
- ✅ All 9 tools registered and schema-validated
- ✅ Configuration settings functional
- ✅ Chat participant prompts updated with priority rules
- ✅ Security validations in place (path traversal, deletion protection)
- ✅ Code refactored and documented
- ✅ Manual testing with various frontmatter formats
- ✅ Cross-platform path handling verified (Windows + Unix)

### User Experience Goals
- **Clarity**: AI understands when to use journal vs note tools
- **Safety**: Deletion protected by default, clear warnings
- **Efficiency**: Multiple frontmatter operations in single call
- **Reliability**: Frontmatter always preserved during content updates
- **Discoverability**: Clear tool names and descriptions in chat UI

## Rollout Plan

1. **Merge to main** after all tests pass
2. **Update README** with note management examples
3. **Create demo video** showing AI managing notes
4. **Update chat participant** with example queries
5. **Monitor usage** for common patterns
6. **Iterate** based on user feedback

## Critical Design Notes

- **No separate notes folder**: All markdown files in vault are notes (including journal entries)
- **Vault-wide operations**: Tools work with any `.md` file in the vault structure
- **Journal files are notes**: Journal tools add special structure, but underlying files are still accessible via note tools
- **Path references**: All paths are relative to vault root (e.g., '1 Journal/2025/2025-W44.md', 'projects/plan.md')
- **System folder exclusion**: `.obsidian`, `.git`, and hidden folders automatically skipped in list/search operations
- **Context efficiency**: Search tools default to `includeContent=false` to minimize token usage; only request content when needed
- **Configurable previews**: Content preview length controlled by `contentPreviewLength` setting (50-2000 chars, default 200)
- **Future-proof**: Users can increase preview length as models improve and context windows expand
- **Two-phase workflow**: Search for files first (without content), then read specific files for detailed analysis
- **TDD discipline**: Tests written FIRST, then implementation
- **gray-matter choice**: Simplicity and reliability over unified/mdast complexity
- **Tool granularity**: Separate read/update/updateFrontmatter for clarity of intent
- **Deletion protection**: Intentionally dangerous and disabled by default
- **Search simplicity**: Substring matching to start, regex can be added later
- **Frontmatter batching**: Multiple operations per call for AI efficiency
