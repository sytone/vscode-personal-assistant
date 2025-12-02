/**
 * Legacy Note Management Tools - DEPRECATED
 * 
 * This file now just re-exports the adapter-based implementations.
 * All new code should use:
 * - src/adapters/vscode/tools/NoteManagementToolAdapters.ts (VS Code Language Model Tools)
 * - src/core/tools/NoteManagementToolCore.ts (Platform-agnostic core logic)
 * 
 * These re-exports are kept for backward compatibility with existing tests
 * and will be removed in a future version.
 * 
 * @deprecated Use NoteManagementToolAdapters directly
 */

// Re-export adapter classes for backward compatibility
export {
	ListFilesToolAdapter as ListFilesTool,
	SearchFilesByNameToolAdapter as SearchFilesByNameTool,
	SearchFilesByContentToolAdapter as SearchFilesByContentTool,
	SearchNotesByFrontmatterToolAdapter as SearchNotesByFrontmatterTool,
	ReadNoteToolAdapter as ReadNoteTool,
	CreateNoteToolAdapter as CreateNoteTool,
	UpdateNoteToolAdapter as UpdateNoteTool,
	UpdateNoteFrontmatterToolAdapter as UpdateNoteFrontmatterTool,
	DeleteNoteToolAdapter as DeleteNoteTool,
} from "../adapters/vscode/tools/NoteManagementToolAdapters";

// ===== LEGACY TOOL CLASSES (REMOVED) =====
// All business logic has been migrated to the dual-mode architecture:
//
// OLD CLASSES (Removed):
// - ListFilesTool → ListFilesToolAdapter
// - SearchFilesByNameTool → SearchFilesByNameToolAdapter
// - SearchFilesByContentTool → SearchFilesByContentToolAdapter
// - SearchNotesByFrontmatterTool → SearchNotesByFrontmatterToolAdapter
// - ReadNoteTool → ReadNoteToolAdapter
// - CreateNoteTool → CreateNoteToolAdapter
// - UpdateNoteTool → UpdateNoteToolAdapter
// - UpdateNoteFrontmatterTool → UpdateNoteFrontmatterToolAdapter
// - DeleteNoteTool → DeleteNoteToolAdapter
//
// NEW ARCHITECTURE:
// - Core Logic: src/core/tools/NoteManagementToolCore.ts (platform-agnostic)
// - VS Code Adapter: src/adapters/vscode/tools/NoteManagementToolAdapters.ts
// - MCP Server: src/mcp-server.ts (uses core directly)
//
// BENEFITS:
// - Code reuse between VS Code extension and MCP server
// - Easier testing (core has no VS Code dependencies)
// - Single source of truth for business logic
// - Markdown utilities can be extracted to shared service
