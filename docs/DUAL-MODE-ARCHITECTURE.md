# Dual-Mode Architecture: VS Code Extension + MCP Server

This document explains the architecture that enables Personal Assistant to run both as a VS Code extension and as a standalone MCP (Model Context Protocol) server.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Platform Adapters                       │
├──────────────────────────┬──────────────────────────────────┤
│   VS Code Extension      │       MCP Server                 │
│   (src/adapters/vscode/) │   (src/mcp-server.ts)            │
│                          │                                  │
│   - VSCodeConfigProvider │   - Environment Config           │
│   - Tool Adapters        │   - MCP Protocol Handler         │
│   - Language Model Tools │   - Tool Registry                │
└────────────┬─────────────┴────────────┬─────────────────────┘
             │                          │
             └──────────┬───────────────┘
                        │
             ┌──────────▼──────────┐
             │   Core Business     │
             │       Logic         │
             │  (src/core/)        │
             │                     │
             │  - JournalToolCore  │
             │  - DateService      │
             │  - TemplateService  │
             │  - Type Definitions │
             └─────────────────────┘
```

## Directory Structure

```
src/
├── core/                          # Platform-agnostic business logic
│   ├── tools/
│   │   └── JournalToolCore.ts    # Core journal operations
│   └── types/
│       ├── ToolContext.ts        # Shared interfaces
│       └── JournalParameters.ts  # Parameter types
│
├── adapters/                      # Platform-specific implementations
│   ├── vscode/
│   │   ├── VSCodeConfigProvider.ts
│   │   └── tools/
│   │       └── JournalToolAdapters.ts
│   └── mcp/                       # (Future: MCP-specific adapters)
│
├── services/                      # Shared services (already agnostic)
│   ├── DateService.ts
│   └── TemplateService.ts
│
├── tools/                         # Legacy VS Code tools (to be migrated)
│   └── JournalTools.ts
│
├── extension.ts                   # VS Code extension entry point
└── mcp-server.ts                  # MCP server entry point
```

## Key Components

### 1. Core Layer (`src/core/`)

**Purpose**: Contains all business logic independent of runtime environment.

**Key Files**:
- `JournalToolCore.ts`: Platform-agnostic journal operations
- `ToolContext.ts`: Shared type definitions for configuration and results
- `JournalParameters.ts`: Parameter interfaces for journal tools

**Benefits**:
- Testable without VS Code
- Reusable across platforms
- Single source of truth for business logic

### 2. VS Code Adapter (`src/adapters/vscode/`)

**Purpose**: Wraps core tools with VS Code-specific interfaces.

**Components**:
- `VSCodeConfigProvider`: Reads VS Code workspace settings
- `JournalToolAdapters`: Implements `vscode.LanguageModelTool` interface
- Converts `IToolResult` to `LanguageModelToolResult`

### 3. MCP Server (`src/mcp-server.ts`)

**Purpose**: Standalone server exposing tools via Model Context Protocol.

**Features**:
- Runs as independent process
- Communicates via stdio
- Configured through environment variables
- Implements MCP protocol for tool discovery and execution

## Usage

### As VS Code Extension

1. Install the extension in VS Code
2. Configure settings in VS Code preferences:
   ```json
   {
     "personal-assistant.vaultPath": "/path/to/vault",
     "personal-assistant.journalFolderName": "1 Journal"
   }
   ```
3. Use `@journal` chat participant in Copilot Chat

### As MCP Server

1. Build the MCP server:
   ```bash
   npm run build:mcp
   ```

2. Configure in MCP client (e.g., Claude Desktop):
   ```json
   {
     "mcpServers": {
       "personal-assistant": {
         "command": "node",
         "args": ["/path/to/dist/mcp-server.js"],
         "env": {
           "VAULT_ROOT": "/path/to/obsidian/vault",
           "JOURNAL_PATH": "1 Journal",
           "TASKS_HEADING": "## Tasks This Week"
         }
       }
     }
   }
   ```

3. Available tools will appear in your MCP client

## Configuration

### VS Code Extension Configuration

Settings are read from VS Code workspace configuration:
- `personal-assistant.vaultPath`
- `personal-assistant.journalFolderName`
- `personal-assistant.journalTasksHeading`
- `personal-assistant.templatesFolderName`
- `personal-assistant.journalTemplateName`

### MCP Server Configuration

Environment variables:
- `VAULT_ROOT` (required): Absolute path to vault
- `JOURNAL_PATH` (optional): Journal folder name (default: "1 Journal")
- `TASKS_HEADING` (optional): Tasks section heading (default: "## Tasks This Week")
- `TEMPLATES_FOLDER` (optional): Templates folder (default: "Templates")
- `JOURNAL_TEMPLATE` (optional): Journal template name (default: "journal-weekly")

## Migration Guide

### Converting Existing Tools

1. **Extract core logic** to `src/core/tools/ToolNameCore.ts`:
   ```typescript
   export class ToolNameCore {
     async operation(context: IToolContext, params: IParams): Promise<IToolResult> {
       // Business logic here
     }
   }
   ```

2. **Create VS Code adapter**:
   ```typescript
   export class ToolNameAdapter implements vscode.LanguageModelTool<IParams> {
     private core = new ToolNameCore(dependencies);
     private config = new VSCodeConfigProvider();
     
     async invoke(options, token): Promise<vscode.LanguageModelToolResult> {
       const context = this.config.getContext();
       const result = await this.core.operation(context, options.input);
       return new vscode.LanguageModelToolResult([
         new vscode.LanguageModelTextPart(result.message)
       ]);
     }
   }
   ```

3. **Register in MCP server**:
   ```typescript
   server.setRequestHandler(ListToolsRequestSchema, async () => {
     return {
       tools: [
         { name: "toolName", description: "...", inputSchema: {...} }
       ]
     };
   });
   ```

## Development Workflow

1. **Write tests for core logic** (TDD approach)
2. **Implement in core layer** (`src/core/tools/`)
3. **Create VS Code adapter** (`src/adapters/vscode/tools/`)
4. **Register in tools.ts** (VS Code)
5. **Add to MCP server** (tool list + handler)
6. **Test both modes**

## Build Configuration

The project uses dual build targets:

```bash
# Build VS Code extension
npm run build:extension

# Build MCP server
npm run build:mcp

# Build both
npm run build
```

## Testing

### Core Logic Tests
```typescript
// Test core without VS Code
const core = new JournalToolCore(dateService, templateService);
const result = await core.addEntry(context, params);
assert.ok(result.success);
```

### VS Code Integration Tests
```typescript
// Test VS Code adapter
const tool = new AddJournalEntryToolAdapter();
const result = await tool.invoke(options, token);
```

### MCP Server Tests
```bash
# Test MCP server manually
VAULT_ROOT=/path/to/vault node dist/mcp-server.js
```

## Benefits

1. **Code Reuse**: ~80% of business logic is shared
2. **Testability**: Core logic testable without VS Code
3. **Maintainability**: Single source of truth
4. **Flexibility**: Easy to add new platforms (CLI, web API, etc.)
5. **Independence**: MCP server runs standalone without VS Code

## Future Enhancements

- [ ] Extract remaining tools (Date Utilities, Note Management)
- [ ] Add CLI mode for direct command-line usage
- [ ] Create web API adapter for HTTP access
- [ ] Add configuration validation layer
- [ ] Implement tool result caching
- [ ] Add metrics and logging infrastructure

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [VS Code Language Model API](https://code.visualstudio.com/api/extension-guides/language-model)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
