/**
 * @deprecated Legacy export for backward compatibility.
 * This file now re-exports the adapter-based implementation.
 *
 * The FindFilesTool has been migrated to the dual-mode architecture:
 * - Core logic: src/core/tools/FindFilesToolCore.ts
 * - VS Code adapter: src/adapters/vscode/tools/FindFilesToolAdapter.ts
 * - MCP server: Registered in src/mcp-server.ts
 */
export { FindFilesToolAdapter as FindFilesTool } from "../adapters/vscode/tools/FindFilesToolAdapter.js";
