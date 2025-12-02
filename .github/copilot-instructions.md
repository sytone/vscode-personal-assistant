# GitHub Copilot Instructions for Personal Assistant Extension

## Project Overview
This is a VSCode extension that provides tools for interacting with Obsidian vaults, journal entries, and date utilities through GitHub Copilot chat. It supports **dual-mode operation**: running as a VS Code extension AND as a standalone Model Context Protocol (MCP) server.

## Architecture

### Dual-Mode Architecture
The project uses a **platform-agnostic core** pattern with **platform-specific adapters**:

```
src/
├── core/                    # Platform-agnostic business logic
│   ├── types/              # Shared type definitions
│   │   ├── ToolContext.ts  # IToolContext, IToolResult, IConfigProvider
│   │   └── JournalParameters.ts  # Parameter interfaces
│   └── tools/              # Core tool implementations
│       └── JournalToolCore.ts  # Journal business logic
├── adapters/               # Platform-specific implementations
│   └── vscode/
│       ├── VSCodeConfigProvider.ts  # VS Code config adapter
│       └── tools/
│           └── JournalToolAdapters.ts  # VS Code tool wrappers
├── tools/                  # Legacy VS Code tools (being migrated)
├── services/               # Shared services (DateService, TemplateService)
├── mcp-server.ts          # MCP server entry point
└── extension.ts           # VS Code extension entry point
```

**Key Principles**:
- **Core layer**: No VS Code dependencies, uses dependency injection
- **Adapters**: Convert between platform APIs and core interfaces
- **Services**: Shared utilities (date operations, template rendering)
- **Result pattern**: Core methods return `IToolResult` instead of throwing exceptions

### When Adding New Tools
1. **Define parameter interface** in `src/core/types/` (e.g., `JournalParameters.ts`)
2. **Implement core logic** in `src/core/tools/` (platform-agnostic)
3. **Create VS Code adapter** in `src/adapters/vscode/tools/`
4. **Register in VS Code** via `src/tools/tools.ts`
5. **Register in MCP server** via `src/mcp-server.ts` (tool list + handler)
6. **Update package.json** with tool definition for VS Code

## Development Philosophy

### Test-Driven Development (TDD)
This project follows a **strict Test-Driven Development** approach:

1. **Write Tests First** - Before implementing any tool functionality, create comprehensive tests
2. **Red-Green-Refactor** - Follow the TDD cycle:
   - 🔴 **Red**: Write failing tests that define expected behavior
   - 🟢 **Green**: Write minimal code to make tests pass
   - 🔵 **Refactor**: Improve code quality while keeping tests green

### Testing Requirements
- **Every tool MUST have tests** before implementation
- Tests should cover:
  - ✅ Happy path scenarios
  - ✅ Edge cases (empty inputs, special characters, boundary conditions)
  - ✅ Error conditions and error messages
  - ✅ Formatting and spacing (especially for journal tools)
  - ✅ Integration between related tools
- Tests are located in `src/test/` directory
- Use Mocha test framework with `assert` module
- Run tests with: `npm test`

## Code Style and Conventions

### General Guidelines
- Use TypeScript with strict typing
- Use async/await for asynchronous operations
- Use clear, descriptive variable and function names
- **Include comprehensive JSDoc comments for all public APIs, classes, interfaces, and complex functions**
- Follow existing code patterns in the project

### Documentation Standards
All TypeScript code must include JSDoc documentation following these guidelines:

**Required Documentation**:
- **Classes**: Include class-level JSDoc with description, `@remarks` for usage patterns, and `@example` when helpful
- **Interfaces**: Document the interface purpose and all properties with inline comments
- **Public Functions**: Include description, `@param` for each parameter, `@returns` for return values, `@remarks` for important behavior
- **Helper Functions**: Document purpose, parameters, return values, and any security or performance considerations
- **Complex Logic**: Add inline comments explaining non-obvious algorithms or business rules

**JSDoc Format**:
```typescript
/**
 * Brief one-line description of the function/class/interface.
 * More detailed explanation if needed (optional).
 *
 * @param paramName - Description of the parameter
 * @returns Description of return value
 *
 * @remarks
 * Additional context about usage patterns, best practices, or important behavior.
 * Use this section for warnings, performance notes, or security considerations.
 *
 * @example
 * ```typescript
 * // Usage example showing typical use case
 * const result = myFunction('input');
 * ```
 */
```

**Documentation Best Practices**:
- Write descriptions that explain *why* and *what*, not just *how*
- Include `@remarks` for non-obvious behavior, edge cases, or important context
- Add `@example` for complex functions or common usage patterns
- Document security considerations (path validation, input sanitization, etc.)
- Explain performance implications (recursive operations, large data sets, etc.)
- Reference related functions or tools when appropriate
- Keep documentation up-to-date when modifying code

### File Organization
- Tools are organized in `src/tools/` directory
- Each tool category has its own file (e.g., `JournalTools.ts`, `DateUtilityTools.ts`)
- All tools are registered in `src/tools/tools.ts`
- Extension activation logic is in `src/extension.ts`
- Tests are in `src/test/` directory with naming pattern `ToolName.test.ts`

## Adding and Updating Tools (TDD Approach)

### Overview
Tools in this extension follow the VSCode Language Model Tool pattern. Each tool is a class that implements `vscode.LanguageModelTool<T>` where `T` is the parameter interface.

**CRITICAL: Always write tests BEFORE implementing the tool.**

### Step 0: Write Tests First (TDD Red Phase)

**Important: Start here for EVERY new tool. Do not skip to implementation.**

1. **Create or update test file** in `src/test/`:
   - For new tool categories: Create `CategoryTools.test.ts`
   - For existing categories: Add to existing test file (e.g., `JournalTools.test.ts`)

2. **Write comprehensive test suite**:
```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';
import { MyTool } from '../tools/CategoryTools';

suite('MyTool Tests', () => {
  let testWorkspaceRoot: string;

  setup(async () => {
    // Setup test environment
    testWorkspaceRoot = await createTestWorkspace();
  });

  teardown(async () => {
    // Cleanup
    await cleanupTestWorkspace(testWorkspaceRoot);
  });

  test('should handle basic functionality', async () => {
    const tool = new MyTool();
    const result = await tool.invoke({
      input: { requiredParam: 'test' },
      options: {}
    } as any, {} as vscode.CancellationToken);

    const parts = result.content as vscode.LanguageModelTextPart[];
    assert.ok(parts[0].value.includes('expected output'));
  });

  test('should handle edge case: empty input', async () => {
    // Test edge cases
  });

  test('should handle error: invalid parameter', async () => {
    // Test error conditions
  });

  test('should maintain proper formatting and spacing', async () => {
    // For journal tools: verify spacing rules
  });
});
```

3. **Test coverage requirements**:
   - Basic happy path
   - Edge cases (empty, null, special characters)
   - Error conditions
   - Spacing/formatting (for content-generating tools)
   - Integration with related tools

4. **Run tests to verify they fail**:
```bash
npm test
```

5. **Review test failures** - Ensure tests fail for the right reasons (tool not implemented yet)

**🛑 STOP HERE - Confirm tests are written and failing before proceeding to Step 1**

---

### Step 1: Create the Tool Class (TDD Green Phase)

**Important: Create ONE tool at a time. Wait for confirmation before proceeding to the next tool.**

When creating a new tool:

1. **Choose or create the appropriate file** in `src/tools/`:
   - For journal-related tools: `JournalTools.ts`
   - For date-related tools: `DateUtilityTools.ts`
   - For new categories: Create a new file like `CategoryTools.ts`

2. **Define the parameter interface**:
```typescript
interface IMyToolParameters {
  requiredParam: string;
  optionalParam?: number;
}
```

3. **Create the tool class**:
```typescript
export class MyTool implements vscode.LanguageModelTool<IMyToolParameters> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<IMyToolParameters>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const params = options.input;
    
    // Implementation here
    
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart("Result message"),
    ]);
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<IMyToolParameters>,
    _token: vscode.CancellationToken
  ) {
    return {
      invocationMessage: `Action description`,
    };
  }
}
```

4. **Key implementation guidelines**:
   - Always validate required parameters first
   - Use `getVaultRoot()` from `src/extension.ts` to get the vault path
   - Return clear error messages if vault root is not configured
   - Use local time for all date operations (never UTC)
   - For date strings in YYYY-MM-DD format, use `parseLocalDate()` helper
   - Handle errors gracefully with try-catch blocks

5. **Run tests to verify they pass**:
```bash
npm test
```

**🛑 STOP HERE - Confirm tests are passing before proceeding to Step 2**

---

### Step 2: Register the Tool in tools.ts

After the tool class is created and confirmed:

1. **Import the tool** in `src/tools/tools.ts`:
```typescript
import { MyTool } from "./CategoryTools";
```

2. **Register the tool** in the `registerChatTools()` function:
```typescript
context.subscriptions.push(
  vscode.lm.registerTool(
    "category-tools_myTool",  // Tool ID: category-tools_toolName
    new MyTool()
  )
);
```

3. **Naming convention for tool IDs**:
   - Format: `{category}-tools_{toolName}`
   - Examples: 
     - `journal-tools_addJournalEntry`
     - `date-utility-tools_calculateRelativeDate`
   - Use camelCase for the tool name portion
   - Use kebab-case with hyphens for the category portion

**🛑 STOP HERE - Wait for user confirmation before proceeding to Step 3**

---

### Step 3: Update package.json

After the tool is registered in tools.ts:

1. **Add the tool definition** to the `languageModelTools` array in `package.json`:

```json
{
  "name": "category-tools_myTool",
  "tags": [
    "category",
    "category-tools",
    "personal-assistant"
  ],
  "toolReferenceName": "myTool",
  "displayName": "My Tool Display Name",
  "modelDescription": "A clear description of what this tool does and when to use it.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "properties": {
      "requiredParam": {
        "type": "string",
        "description": "Description of what this parameter does."
      },
      "optionalParam": {
        "type": "number",
        "description": "Description of this optional parameter."
      }
    },
    "required": [
      "requiredParam"
    ]
  }
}
```

2. **Key fields to configure**:
   - `name`: Must match the tool ID from `tools.ts`
   - `tags`: Include relevant categories for discoverability
   - `toolReferenceName`: Short name without prefix (used in prompts)
   - `displayName`: Human-readable name shown in UI
   - `modelDescription`: Clear description for the AI model
   - `canBeReferencedInPrompt`: Usually `true` for tools users can reference
   - `inputSchema`: JSON Schema definition matching the parameter interface
   - `required`: Array of required parameter names

3. **Property types in inputSchema**:
   - `string` for text, dates (YYYY-MM-DD)
   - `number` for integers, decimals
   - `boolean` for true/false values
   - Add detailed `description` for each property

**🛑 STOP HERE - Tool is now complete. Ask if user wants to add another tool.**

---

## Tool Implementation Best Practices

### Date Handling
- **ALWAYS use local time, never UTC**
- Parse YYYY-MM-DD dates using the `parseLocalDate()` helper
- Format dates using `formatDate()` helper
- Use `new Date()` and `setHours(0, 0, 0, 0)` for local midnight
- Never use `toISOString()` for date input parsing

### Error Handling
```typescript
try {
  // Tool logic
  return new vscode.LanguageModelToolResult([
    new vscode.LanguageModelTextPart("Success message"),
  ]);
} catch (err) {
  return new vscode.LanguageModelToolResult([
    new vscode.LanguageModelTextPart(`Error: ${err}`),
  ]);
}
```

### Vault Root Access
```typescript
import { getVaultRoot } from "../extension";

const workspaceRoot = getVaultRoot();
if (!workspaceRoot) {
  return new vscode.LanguageModelToolResult([
    new vscode.LanguageModelTextPart(
      "No vault root configured. Please open a workspace or configure personalAssistant.vaultPath."
    ),
  ]);
}
```

### File Operations
- Use `fs/promises` for async file operations
- Always create directories recursively: `fs.mkdir(path.dirname(file), { recursive: true })`
- Use `path.join()` for cross-platform path construction
- Handle file not found errors gracefully

### Journal-Specific Guidelines
- Journal files follow ISO week format: `YYYY-Www.md` (e.g., `2025-W44.md`)
- Day sections use format: `## {day} {dayName}` (e.g., `## 30 Thursday`)
- Entries are bulleted lists with timestamps: `- HH:mm - content`
- Tasks section: `## Tasks This Week` with checkbox items: `- [ ] task` or `- [x] completed`
- Maintain one blank line after headings, no blank lines between list items, one blank line before next section
- Remove leading dashes from entry content (the format already includes them)

## Testing Guidelines

### Test Structure
- Tests are located in `src/test/` directory
- Use naming pattern: `ToolName.test.ts` (e.g., `JournalTools.test.ts`)
- Use Mocha's `suite()` and `test()` functions
- Use Node's `assert` module for assertions

### Test Helpers
Create helper functions for common test operations:

```typescript
// Create temporary test workspace
async function createTestWorkspace(): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-'));
  await fs.mkdir(path.join(tmpDir, '.obsidian'));
  return tmpDir;
}

// Clean up test workspace
async function cleanupTestWorkspace(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

// Read test file
async function readTestFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8');
}

// Write test file
async function writeTestFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}
```

### Running Tests
```bash
# Run all tests
npm test

# Compile and run tests
npm run pretest && npm test

# Watch mode (if configured)
npm run watch
```

### Test Coverage Requirements
Every tool must have tests for:

1. **Happy Path**: Basic successful operation
   ```typescript
   test('should create entry with correct content', async () => {
     // Test successful operation
   });
   ```

2. **Edge Cases**: Boundary conditions, empty inputs, special characters
   ```typescript
   test('should handle empty input gracefully', async () => {
     // Test with empty string
   });
   
   test('should strip leading dash from content', async () => {
     // Test special character handling
   });
   ```

3. **Error Conditions**: Invalid inputs, missing files, configuration errors
   ```typescript
   test('should return error when vault root not configured', async () => {
     // Test error handling
   });
   ```

4. **Formatting/Spacing**: For tools that generate content (journal entries, tasks)
   ```typescript
   test('should maintain one blank line after heading', async () => {
     const content = await readTestFile(filePath);
     const lines = content.split(/\r?\n/);
     // Verify spacing rules
   });
   
   test('should not have blank lines between list items', async () => {
     // Verify compact list formatting
   });
   ```

5. **Integration**: How tools work together
   ```typescript
   test('should handle workflow: add entry, add task, read', async () => {
     // Test multiple tool interactions
   });
   ```

### Manual Testing (After Automated Tests Pass)

After automated tests pass:

1. Compile the extension: `npm run compile`
2. Press F5 to launch Extension Development Host
3. Test the tool using GitHub Copilot chat:
   - Use `@journal` chat participant
   - Reference tools with `#toolReferenceName`
   - Test with various inputs including edge cases
4. Verify error handling with invalid inputs

## Common Patterns

### Helper Functions
Create helper functions for reusable logic:
- Date parsing and formatting
- Path resolution
- File existence checks
- Content transformation

Keep helpers private unless they're needed across multiple files.

### Configuration Access
```typescript
const config = vscode.workspace.getConfiguration("personalAssistant");
const value = config.get<string>("settingName") || DEFAULT_VALUE;
```

### Return Formats
- For simple results: Return plain text
- For structured data: Return JSON.stringify(object, null, 2)
- Always include success/error status in responses
- Provide helpful error messages with hints

## Architecture Notes

### Extension Lifecycle
1. Extension activates on VSCode startup
2. `activate()` in `extension.ts` runs once
3. Vault root is determined and cached
4. Tools are registered via `registerChatTools()`
5. Tools remain available until extension deactivates

### Vault Root Resolution
- Priority 1: `personalAssistant.vaultPath` configuration
- Priority 2: First workspace folder (if contains `.obsidian` folder)
- Updates automatically when configuration or workspace changes

### Tool Invocation Flow
1. User mentions tool in chat or AI decides to use it
2. `prepareInvocation()` called (shows user what's happening)
3. `invoke()` called with parameters
4. Result returned to chat

## File Structure Reference

```
src/
├── extension.ts              # VS Code extension entry point, vault root management
├── mcp-server.ts            # MCP server entry point (stdio transport)
├── core/                    # Platform-agnostic business logic
│   ├── types/
│   │   ├── ToolContext.ts   # IToolContext, IToolResult, IConfigProvider
│   │   └── JournalParameters.ts  # Journal tool parameter interfaces
│   └── tools/
│       └── JournalToolCore.ts  # Journal business logic (addEntry, readEntries, etc.)
├── adapters/                # Platform-specific adapters
│   └── vscode/
│       ├── VSCodeConfigProvider.ts  # VS Code configuration adapter
│       └── tools/
│           └── JournalToolAdapters.ts  # VS Code Language Model Tool wrappers
├── services/                # Shared services (platform-agnostic)
│   ├── DateService.ts       # Date calculations, ISO weeks, parsing
│   └── TemplateService.ts   # Markdown template rendering
├── tools/                   # Legacy VS Code tools (being phased out)
│   ├── tools.ts            # Tool registration
│   ├── JournalTools.ts     # Legacy journal tools (kept for reference)
│   ├── DateUtilityTools.ts # Date calculation tools
│   ├── NoteManagementTools.ts  # Note CRUD operations
│   ├── FindFilesTool.ts    # File search tool
│   └── RunInTerminalTool.ts  # Terminal execution
├── commands/
│   └── commands.ts         # VS Code commands
├── chatParticipants/       # Chat participant implementations
└── test/                   # Test suites
    ├── JournalTools.test.ts
    ├── TemplateService.test.ts
    └── ...
```

## TODO Management

**Important**: When identifying future work, create inline TODOs with clear prompts for delegation:

```typescript
// TODO: Extract markdown formatting logic to core layer
// Prompt: "Extract formatMarkdownContent from JournalTools.ts to JournalToolCore.ts. 
// Create a MarkdownFormatterService with formatContent(content: string): Promise<string>
// that applies markdownlint rules. Inject as dependency in JournalToolCore constructor.
// Update all callers to use the injected service."
async formatMarkdownContent(content: string): Promise<string> {
    return content; // Stub implementation
}
```

**TODO Format**:
- Start with `// TODO:` followed by brief description
- Add `// Prompt:` on next line with detailed instructions for an AI agent
- Include: what to extract, where to put it, interface/signature, dependencies, update steps
- Keep prompt self-contained and actionable

## Remember

- ✅ **ALWAYS write tests first** (TDD Red phase)
- ✅ **Verify tests fail** before implementing
- ✅ **Make tests pass** with minimal code (TDD Green phase)
- ✅ **Refactor** while keeping tests green (TDD Refactor phase)
- ✅ **Use core layer** for new tools (platform-agnostic)
- ✅ **Create adapters** for VS Code integration
- ✅ **Register in both** VS Code and MCP server
- ✅ Create one tool at a time
- ✅ Wait for confirmation between steps
- ✅ Test thoroughly before moving to next tool
- ✅ Use local time for all date operations
- ✅ Provide clear error messages
- ✅ Follow existing code patterns
- ✅ Keep tool IDs consistent across all three locations
- ✅ Document complex logic with JSDoc comments
- ✅ **Add TODOs with prompts** for future work
