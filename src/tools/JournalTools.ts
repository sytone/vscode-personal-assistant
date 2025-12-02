/**
 * Legacy Journal Tools - DEPRECATED
 * 
 * This file now just re-exports the adapter-based implementations.
 * All new code should use:
 * - src/adapters/vscode/tools/JournalToolAdapters.ts (VS Code Language Model Tools)
 * - src/core/tools/JournalToolCore.ts (Platform-agnostic core logic)
 * 
 * These re-exports are kept for backward compatibility with existing tests
 * and will be removed in a future version.
 * 
 * @deprecated Use JournalToolAdapters directly
 */

// Re-export adapter classes for backward compatibility
export {
	AddJournalEntryToolAdapter as AddJournalEntryTool,
	ReadJournalEntriesToolAdapter as ReadJournalEntriesTool,
	AddJournalTaskToolAdapter as AddJournalTaskTool,
	CompleteJournalTaskToolAdapter as CompleteJournalTaskTool,
	ReadJournalTasksToolAdapter as ReadJournalTasksTool,
} from "../adapters/vscode/tools/JournalToolAdapters";

// ===== LEGACY TOOL CLASSES (REMOVED) =====
// All business logic has been migrated to the dual-mode architecture:
//
// OLD CLASSES (Removed):
// - AddJournalEntryTool → AddJournalEntryToolAdapter
// - ReadJournalEntriesTool → ReadJournalEntriesToolAdapter  
// - AddJournalTaskTool → AddJournalTaskToolAdapter
// - CompleteJournalTaskTool → CompleteJournalTaskToolAdapter
// - ReadJournalTasksTool → ReadJournalTasksToolAdapter
//
// NEW ARCHITECTURE:
// - Core Logic: src/core/tools/JournalToolCore.ts (platform-agnostic)
// - VS Code Adapter: src/adapters/vscode/tools/JournalToolAdapters.ts
// - MCP Server: src/mcp-server.ts (uses core directly)
//
// BENEFITS:
// - Code reuse between VS Code extension and MCP server
// - Easier testing (core has no VS Code dependencies)
// - Single source of truth for business logic
