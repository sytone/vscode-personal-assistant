/**
 * @deprecated Legacy export for backward compatibility.
 * This file now re-exports the adapter-based implementation.
 *
 * The RunInTerminalTool has been migrated to the dual-mode architecture:
 * - Core logic: src/core/tools/RunInTerminalToolCore.ts
 * - VS Code adapter: src/adapters/vscode/tools/RunInTerminalToolAdapter.ts
 * - MCP server: Registered in src/mcp-server.ts
 */
export { RunInTerminalToolAdapter as RunInTerminalTool } from "../adapters/vscode/tools/RunInTerminalToolAdapter.js";
